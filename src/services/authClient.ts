export type UserRole = 'Admin' | 'Customer';
export type AccountStatus = 'active' | 'suspended';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
}

export interface SystemSettings {
  intakeOpen: boolean;
  maintenanceBanner: string;
  autoEscalateCritical: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface SystemStatusInfo {
  adminClaimed: boolean;
  adminName: string | null;
  settings: SystemSettings;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface AdminOverviewPayload {
  users: AuthUser[];
  settings: SystemSettings;
  auditLog: AuditEntry[];
}

// Held strictly in JS memory (never stored in localStorage/sessionStorage)
let inMemoryToken: string | null = null;

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export function clearAuthToken(): void {
  inMemoryToken = null;
}

async function apiJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchSystemStatus(): Promise<SystemStatusInfo> {
  return apiJson<SystemStatusInfo>('/api/system/status');
}

export async function registerAccount(
  name: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  const res = await apiJson<{ token: string; user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  inMemoryToken = res.token;
  return res.user;
}

export async function loginAccount(email: string, password: string): Promise<AuthUser> {
  const res = await apiJson<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  inMemoryToken = res.token;
  return res.user;
}

export async function logoutAccount(): Promise<void> {
  try {
    await apiJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  } finally {
    inMemoryToken = null;
  }
}

export async function fetchAdminOverview(): Promise<AdminOverviewPayload> {
  return apiJson<AdminOverviewPayload>('/api/admin/overview');
}

export async function updateCustomerStatus(
  userId: string,
  status: AccountStatus,
): Promise<{ user: AuthUser; auditLog: AuditEntry[] }> {
  return apiJson<{ user: AuthUser; auditLog: AuditEntry[] }>(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteCustomerAccount(
  userId: string,
): Promise<{ ok: boolean; auditLog: AuditEntry[] }> {
  return apiJson<{ ok: boolean; auditLog: AuditEntry[] }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function updateAdminSettings(
  patch: Partial<Pick<SystemSettings, 'intakeOpen' | 'maintenanceBanner' | 'autoEscalateCritical'>>,
): Promise<{ settings: SystemSettings; auditLog: AuditEntry[] }> {
  return apiJson<{ settings: SystemSettings; auditLog: AuditEntry[] }>('/api/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function recordAdminAudit(
  action: string,
  target: string,
): Promise<{ auditLog: AuditEntry[] }> {
  return apiJson<{ auditLog: AuditEntry[] }>('/api/admin/audit', {
    method: 'POST',
    body: JSON.stringify({ action, target }),
  });
}
