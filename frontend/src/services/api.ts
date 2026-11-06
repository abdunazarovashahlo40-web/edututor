/**
 * API mijozi: HttpOnly cookie sessiya, CSRF (double-submit), avtomatik token yangilash,
 * ilova qulfi (423) hodisasi va yagona xato formati.
 */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) {
    super(message);
  }
}

export interface ApiResult<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; pages: number; unread?: number; hasMore?: boolean };
}

const BASE = '/api/v1';

function readCookie(name: string) {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(name + '='))
    ?.split('=')[1];
}

let csrfPromise: Promise<void> | null = null;
async function ensureCsrf() {
  if (readCookie('et_csrf')) return;
  csrfPromise ??= fetch(`${BASE}/auth/csrf`, { credentials: 'include' }).then(() => undefined);
  await csrfPromise;
  csrfPromise = null;
}

let refreshPromise: Promise<boolean> | null = null;
async function refresh() {
  refreshPromise ??= (async () => {
    await ensureCsrf();
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': decodeURIComponent(readCookie('et_csrf') ?? '') },
    });
    return r.ok;
  })();
  const ok = await refreshPromise;
  refreshPromise = null;
  return ok;
}

export function deviceId() {
  try {
    return localStorage.getItem('et_device');
  } catch {
    return null;
  }
}

type Opts = { method?: string; body?: unknown; form?: FormData; query?: Record<string, unknown>; noRefresh?: boolean };

export async function api<T = any>(path: string, opts: Opts = {}): Promise<ApiResult<T>> {
  const method = opts.method ?? (opts.body || opts.form ? 'POST' : 'GET');
  let url = BASE + path;
  if (opts.query) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    const s = q.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    await ensureCsrf();
    headers['X-CSRF-Token'] = decodeURIComponent(readCookie('et_csrf') ?? '');
  }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  // Shu telefonda PIN o'rnatilgan bo'lsa — qayta kirishda ham ilova qulfi saqlanadi
  if (path.startsWith('/auth/')) {
    const dev = deviceId();
    if (dev) headers['X-Device-Id'] = dev;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error');
  }

  if (res.status === 401 && !opts.noRefresh && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    const j = await res.clone().json().catch(() => ({}));
    if (['TOKEN_EXPIRED', 'NO_TOKEN'].includes(j?.error?.code) && (await refresh())) {
      return api<T>(path, { ...opts, noRefresh: true });
    }
  }
  if (res.status === 423) window.dispatchEvent(new CustomEvent('et:locked'));

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    const e = json?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'HTTP_' + res.status, e.message ?? res.statusText, e.details);
  }
  return { data: json.data as T, meta: json.meta };
}

export const get = <T = any>(path: string, query?: Record<string, unknown>) => api<T>(path, { query }).then((r) => r.data);
export const post = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} }).then((r) => r.data);
export const patch = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body }).then((r) => r.data);
export const put = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body }).then((r) => r.data);
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' }).then((r) => r.data);
export const upload = <T = any>(path: string, form: FormData) => api<T>(path, { method: 'POST', form }).then((r) => r.data);
