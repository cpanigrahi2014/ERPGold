import { useAuth } from '@/auth/store';

export interface ApiOpts extends RequestInit {
  /** Skip Authorization header even when token is present. */
  noAuth?: boolean;
}

/** Error thrown by {@link api}; carries HTTP status + optional backend code. */
export class ApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;
  constructor(message: string, status: number, code?: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/**
 * Decode a JWT payload and return the expiry timestamp in ms, or 0 on error.
 * No crypto verification — used only for client-side expiry pre-check.
 */
function jwtExpMs(token: string): number {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Call once when a 401 is detected (either client-side or from server).
 * Clears the auth store — React's RequireAuth guard will redirect to /login.
 */
function handleExpired(): void {
  useAuth.getState().logout();
}

/**
 * Thin fetch wrapper. The first segment of `path` (e.g. /api/admin) is
 * proxied to the right backend by Vite (dev) and nginx (prod).
 *
 * Automatic token expiry handling:
 * - If the stored JWT is already expired (checked client-side), the session is
 *   cleared immediately and an ApiError(401) is thrown without making a network call.
 * - If the server responds with 401 (e.g. secret rotation), the session is also
 *   cleared so RequireAuth redirects the user to /login.
 */
export async function api<T = unknown>(path: string, opts: ApiOpts = {}): Promise<T> {
  const { noAuth, headers, ...rest } = opts;
  const token = useAuth.getState().user?.token;

  // Client-side expiry pre-check — avoids an unnecessary network round-trip.
  if (!noAuth && token) {
    const expMs = jwtExpMs(token);
    if (expMs > 0 && expMs <= Date.now()) {
      handleExpired();
      throw new ApiError('Session expired. Please log in again.', 401);
    }
  }

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (!noAuth && token) finalHeaders['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...rest, headers: finalHeaders });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    // 401 = invalid or expired token as judged by the server (covers secret rotation).
    if (res.status === 401) handleExpired();

    const msg = (data && (data.message || data.error)) || `${res.status} ${res.statusText}`;
    const code = data && typeof data === 'object' ? (data.code as string | undefined) : undefined;
    throw new ApiError(typeof msg === 'string' ? msg : JSON.stringify(msg), res.status, code, data);
  }
  return data as T;
}

/** Try to detect whether the admin service runs in standalone (no-auth) mode. */
export async function probeStandalone(): Promise<boolean> {
  try {
    const r = await fetch('/api/admin/actuator/health', { method: 'GET' });
    if (!r.ok) return false;
    // Standalone mode lets unauthenticated calls through. We simply check
    // an authenticated-ish endpoint; if it answers without a token we treat
    // the deployment as standalone.
    const probe = await fetch('/api/admin/api/v1/admin/branches?page=0&size=1');
    return probe.status !== 401 && probe.status !== 403;
  } catch {
    return false;
  }
}
