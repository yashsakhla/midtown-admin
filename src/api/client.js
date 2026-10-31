/**
 * Thin fetch wrapper for the Midtown backend.
 * Keeps the access/refresh tokens, retries once through /auth/refresh on 401,
 * and throws ApiError with the server's message so the UI can toast it.
 */
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const KEY = 'midtown.session';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let session = (() => {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
})();
let onAuthLost = () => {};

export const getSession = () => session;
export const setAuthLostHandler = (fn) => { onAuthLost = fn; };

function saveSession(next) {
  session = next;
  if (next) localStorage.setItem(KEY, JSON.stringify(next));
  else localStorage.removeItem(KEY);
}

const qs = (params) => {
  const p = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? '?' + new URLSearchParams(p).toString() : '';
};

async function raw(method, path, { body, params, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  let res;
  try {
    res = await fetch(BASE + path + qs(params), {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError('Cannot reach the server', 0);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { res, data };
}

const messageOf = (data, status) =>
  (data && (data.message || data.error?.message || (typeof data.error === 'string' ? data.error : null) || data.code))
  || `Request failed (${status})`;

let refreshing = null;
async function refresh() {
  if (!session?.refreshToken) return false;
  refreshing = refreshing || raw('POST', '/auth/refresh', { body: { refreshToken: session.refreshToken }, auth: false })
    .then(({ res, data }) => {
      if (!res.ok || !data?.accessToken) return false;
      saveSession({ ...session, ...data });
      return true;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function request(method, path, opts = {}) {
  let { res, data } = await raw(method, path, opts);
  if (res.status === 401 && opts.auth !== false && await refresh()) {
    ({ res, data } = await raw(method, path, opts));
  }
  if (res.status === 401 && opts.auth !== false) {
    saveSession(null);
    onAuthLost();
  }
  if (!res.ok) throw new ApiError(messageOf(data, res.status), res.status, data);
  return data;
}

export const api = {
  get: (path, params, opts) => request('GET', path, { ...opts, params }),
  post: (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} }),
  patch: (path, body) => request('PATCH', path, { body: body ?? {} }),
  put: (path, body) => request('PUT', path, { body: body ?? {} }),
  del: (path) => request('DELETE', path)
};

export async function login(identifier, password) {
  const data = await request('POST', '/auth/staff/login', { body: { identifier, password }, auth: false });
  saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data;
}

export const logout = () => saveSession(null);
