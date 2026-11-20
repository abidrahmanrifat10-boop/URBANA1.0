import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.urbana-data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SYSTEM_FILE = path.join(DATA_DIR, 'system-settings.json');

const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type UserRole = 'Admin' | 'Customer';
type AccountStatus = 'active' | 'suspended';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: UserRole | 'Coordinator' | 'Member';
  status?: AccountStatus;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
}

interface SystemSettings {
  intakeOpen: boolean;
  maintenanceBanner: string;
  autoEscalateCritical: boolean;
  updatedAt: string;
  updatedBy: string;
}

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
}

interface SystemStore {
  settings: SystemSettings;
  auditLog: AuditEntry[];
}

interface SessionPayload {
  sub: string;
  email: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: PublicUser;
}

const DEFAULT_SYSTEM_STORE: SystemStore = {
  settings: {
    intakeOpen: true,
    maintenanceBanner: '',
    autoEscalateCritical: true,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System',
  },
  auditLog: [],
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    ensureDataDir();
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, data: unknown) {
  ensureDataDir();
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function normalizeRole(role: StoredUser['role']): UserRole {
  return role === 'Admin' || role === 'Coordinator' ? 'Admin' : 'Customer';
}

function normalizeStatus(status: StoredUser['status'], role: UserRole): AccountStatus {
  if (role === 'Admin') return 'active';
  return status === 'suspended' ? 'suspended' : 'active';
}

function toPublicUser(u: StoredUser): PublicUser {
  const role = normalizeRole(u.role);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role,
    status: normalizeStatus(u.status, role),
    createdAt: u.createdAt,
  };
}

function readSystemStore(): SystemStore {
  const stored = readJsonFile<Partial<SystemStore>>(SYSTEM_FILE, {});
  return {
    settings: {
      ...DEFAULT_SYSTEM_STORE.settings,
      ...(stored.settings ?? {}),
    },
    auditLog: Array.isArray(stored.auditLog) ? stored.auditLog : [],
  };
}

function appendAudit(store: SystemStore, actor: string, action: string, target: string): SystemStore {
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    actor,
    action,
    target,
    timestamp: new Date().toISOString(),
  };
  return {
    ...store,
    auditLog: [entry, ...store.auditLog].slice(0, 80),
  };
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHex: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function signToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.sub || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const token = header.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  const users = readJsonFile<StoredUser[]>(USERS_FILE, []);
  const user = users.find((u) => u.id === payload.sub);
  if (!user) {
    res.status(401).json({ error: 'Account no longer exists.' });
    return;
  }
  const publicUser = toPublicUser(user);
  if (publicUser.status === 'suspended') {
    res.status(403).json({ error: 'Your customer account has been suspended by the Admin.' });
    return;
  }
  req.authUser = publicUser;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || req.authUser.role !== 'Admin') {
    res.status(403).json({ error: 'Single-Admin authorization required for this control.' });
    return;
  }
  next();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/system/status', (_req: Request, res: Response) => {
    const users = readJsonFile<StoredUser[]>(USERS_FILE, []);
    const admin = users.find((u) => normalizeRole(u.role) === 'Admin');
    const store = readSystemStore();
    res.json({
      adminClaimed: Boolean(admin),
      adminName: admin ? admin.name : null,
      settings: store.settings,
    });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (rawName.length < 2 || rawName.length > 60) {
      res.status(400).json({ error: 'Full name must be between 2 and 60 characters.' });
      return;
    }
    if (!EMAIL_RE.test(rawEmail) || rawEmail.length > 120) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (rawPassword.length < 6 || rawPassword.length > 128) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const users = readJsonFile<StoredUser[]>(USERS_FILE, []);
    if (users.some((u) => u.email === rawEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    // Strict Single-Admin Rule: only 1 Admin account may ever exist in the app
    const adminExists = users.some((u) => normalizeRole(u.role) === 'Admin');
    const assignedRole: UserRole = adminExists ? 'Customer' : 'Admin';

    const salt = crypto.randomBytes(16).toString('hex');
    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      name: rawName,
      email: rawEmail,
      role: assignedRole,
      status: 'active',
      salt,
      passwordHash: hashPassword(rawPassword, salt),
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    writeJsonFile(USERS_FILE, users);

    const token = signToken({
      sub: newUser.id,
      email: newUser.email,
      exp: Date.now() + TOKEN_TTL_MS,
    });

    res.status(201).json({ token, user: toPublicUser(newUser) });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!EMAIL_RE.test(rawEmail) || !rawPassword) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const users = readJsonFile<StoredUser[]>(USERS_FILE, []);
    const user = users.find((u) => u.email === rawEmail);
    if (!user || !verifyPassword(rawPassword, user.salt, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const pub = toPublicUser(user);
    if (pub.status === 'suspended') {
      res.status(403).json({ error: 'This customer account is currently suspended by the Admin.' });
      return;
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      exp: Date.now() + TOKEN_TTL_MS,
    });

    res.json({ token, user: pub });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.authUser });
  });

  // ---------------- SINGLE-ADMIN ENDPOINTS ----------------

  app.get('/api/admin/overview', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const users = readJsonFile<StoredUser[]>(USERS_FILE, []).map(toPublicUser);
    const store = readSystemStore();
    res.json({
      users,
      settings: store.settings,
      auditLog: store.auditLog,
    });
  });

  app.patch(
    '/api/admin/users/:id/status',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const targetId = req.params.id;
      const nextStatus = req.body?.status === 'suspended' ? 'suspended' : 'active';
      const users = readJsonFile<StoredUser[]>(USERS_FILE, []);
      const idx = users.findIndex((u) => u.id === targetId);
      if (idx === -1) {
        res.status(404).json({ error: 'Customer account not found.' });
        return;
      }
      if (normalizeRole(users[idx].role) === 'Admin') {
        res.status(400).json({ error: 'The sole Admin account cannot be suspended.' });
        return;
      }

      users[idx].status = nextStatus;
      writeJsonFile(USERS_FILE, users);

      const store = appendAudit(
        readSystemStore(),
        req.authUser!.name,
        nextStatus === 'suspended' ? 'Suspended customer' : 'Reactivated customer',
        users[idx].email,
      );
      writeJsonFile(SYSTEM_FILE, store);

      res.json({ user: toPublicUser(users[idx]), auditLog: store.auditLog });
    },
  );

  app.delete(
    '/api/admin/users/:id',
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const targetId = req.params.id;
      const users = readJsonFile<StoredUser[]>(USERS_FILE, []);
      const target = users.find((u) => u.id === targetId);
      if (!target) {
        res.status(404).json({ error: 'Customer account not found.' });
        return;
      }
      if (normalizeRole(target.role) === 'Admin') {
        res.status(400).json({ error: 'The sole Admin account cannot be deleted.' });
        return;
      }

      const nextUsers = users.filter((u) => u.id !== targetId);
      writeJsonFile(USERS_FILE, nextUsers);

      const store = appendAudit(
        readSystemStore(),
        req.authUser!.name,
        'Removed customer account',
        target.email,
      );
      writeJsonFile(SYSTEM_FILE, store);

      res.json({ ok: true, auditLog: store.auditLog });
    },
  );

  app.patch('/api/admin/settings', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const current = readSystemStore();
    const intakeOpen =
      typeof req.body?.intakeOpen === 'boolean' ? req.body.intakeOpen : current.settings.intakeOpen;
    const autoEscalateCritical =
      typeof req.body?.autoEscalateCritical === 'boolean'
        ? req.body.autoEscalateCritical
        : current.settings.autoEscalateCritical;
    const maintenanceBanner =
      typeof req.body?.maintenanceBanner === 'string'
        ? req.body.maintenanceBanner.trim().slice(0, 180)
        : current.settings.maintenanceBanner;

    const updatedSettings: SystemSettings = {
      intakeOpen,
      autoEscalateCritical,
      maintenanceBanner,
      updatedAt: new Date().toISOString(),
      updatedBy: req.authUser!.name,
    };

    const nextStore = appendAudit(
      { ...current, settings: updatedSettings },
      req.authUser!.name,
      'Updated system governance',
      `Intake ${intakeOpen ? 'Open' : 'Paused'} · Auto-Escalate ${autoEscalateCritical ? 'On' : 'Off'}`,
    );
    writeJsonFile(SYSTEM_FILE, nextStore);

    res.json({ settings: nextStore.settings, auditLog: nextStore.auditLog });
  });

  app.post('/api/admin/audit', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const action = typeof req.body?.action === 'string' ? req.body.action.trim().slice(0, 80) : '';
    const target = typeof req.body?.target === 'string' ? req.body.target.trim().slice(0, 120) : '';
    if (!action) {
      res.status(400).json({ error: 'Audit action label is required.' });
      return;
    }
    const nextStore = appendAudit(readSystemStore(), req.authUser!.name, action, target || 'System');
    writeJsonFile(SYSTEM_FILE, nextStore);
    res.json({ auditLog: nextStore.auditLog });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get(/^(?!\/api\/).*/, (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`URBANA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start URBANA server:', err);
  process.exit(1);
});
