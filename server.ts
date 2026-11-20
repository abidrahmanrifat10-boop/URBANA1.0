import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.urbana-data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SHEET_PREFS_FILE = path.join(DATA_DIR, 'sheet-prefs.json');

const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: 'Coordinator' | 'Member';
  salt: string;
  passwordHash: string;
  createdAt: string;
}

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: 'Coordinator' | 'Member';
  createdAt: string;
}

interface SheetPref {
  spreadsheetId: string;
  spreadsheetTitle: string;
  autoSync: boolean;
  updatedAt: string;
}

interface SessionPayload {
  sub: string;
  email: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: PublicUser;
}

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

function toPublicUser(u: StoredUser): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
  };
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
  req.authUser = toPublicUser(user);
  next();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

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

    const salt = crypto.randomBytes(16).toString('hex');
    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      name: rawName,
      email: rawEmail,
      role: users.length === 0 ? 'Coordinator' : 'Member',
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

    const token = signToken({
      sub: user.id,
      email: user.email,
      exp: Date.now() + TOKEN_TTL_MS,
    });

    res.json({ token, user: toPublicUser(user) });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.authUser });
  });

  app.get('/api/user/sheet-config', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const prefs = readJsonFile<Record<string, SheetPref>>(SHEET_PREFS_FILE, {});
    const pref = req.authUser ? prefs[req.authUser.id] ?? null : null;
    res.json({ config: pref });
  });

  app.put('/api/user/sheet-config', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const spreadsheetId =
      typeof req.body?.spreadsheetId === 'string' ? req.body.spreadsheetId.trim() : '';
    const spreadsheetTitle =
      typeof req.body?.spreadsheetTitle === 'string' ? req.body.spreadsheetTitle.trim().slice(0, 120) : 'URBANA Smart City Sheet';
    const autoSync = Boolean(req.body?.autoSync);

    if (spreadsheetId && !/^[a-zA-Z0-9-_]{10,120}$/.test(spreadsheetId)) {
      res.status(400).json({ error: 'Invalid Google Spreadsheet ID format.' });
      return;
    }

    const prefs = readJsonFile<Record<string, SheetPref>>(SHEET_PREFS_FILE, {});
    if (!spreadsheetId) {
      delete prefs[req.authUser.id];
      writeJsonFile(SHEET_PREFS_FILE, prefs);
      res.json({ config: null });
      return;
    }

    const updated: SheetPref = {
      spreadsheetId,
      spreadsheetTitle: spreadsheetTitle || 'URBANA Smart City Sheet',
      autoSync,
      updatedAt: new Date().toISOString(),
    };
    prefs[req.authUser.id] = updated;
    writeJsonFile(SHEET_PREFS_FILE, prefs);
    res.json({ config: updated });
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
