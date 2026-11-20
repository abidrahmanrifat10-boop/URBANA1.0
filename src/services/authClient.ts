export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Coordinator' | 'Member';
  createdAt: string;
}

export interface UserSheetConfig {
  spreadsheetId: string;
  spreadsheetTitle: string;
  autoSync: boolean;
  updatedAt?: string;
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

export async function fetchUserSheetConfig(): Promise<UserSheetConfig | null> {
  if (!inMemoryToken) return null;
  const res = await apiJson<{ config: UserSheetConfig | null }>('/api/user/sheet-config');
  return res.config;
}

export async function saveUserSheetConfig(
  config: Pick<UserSheetConfig, 'spreadsheetId' | 'spreadsheetTitle' | 'autoSync'>,
): Promise<UserSheetConfig | null> {
  if (!inMemoryToken) return null;
  const res = await apiJson<{ config: UserSheetConfig | null }>('/api/user/sheet-config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
  return res.config;
}
