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
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (auth && session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  let res;
  try {
    res = await fetch(BASE + path + qs(params), {
      method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body)
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

/* Global in-flight request counter so the UI can show a loader for any API call. */
let pending = 0;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(pending));
export const subscribePending = (fn) => { listeners.add(fn); fn(pending); return () => listeners.delete(fn); };

async function request(method, path, opts = {}) {
  pending += 1; emit();
  try { return await doRequest(method, path, opts); }
  finally { pending -= 1; emit(); }
}

async function doRequest(method, path, opts = {}) {
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
  /** Multipart upload (documents). The browser sets the boundary header. */
  upload: (path, form) => request('POST', path, { body: form }),
  put: (path, body) => request('PUT', path, { body: body ?? {} }),
  del: (path) => request('DELETE', path)
};

const MEDIA_BASE = (import.meta.env.VITE_MEDIA_URL || 'https://midtown-media.sgp1.cdn.digitaloceanspaces.com/images').replace(/\/$/, '');

const newFileId = (file) => {
  const ext = (file.name?.match(/\.([a-z0-9]{1,5})$/i)?.[1] || (file.type || '').split('/')[1] || 'bin').toLowerCase();
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${id}.${ext}`;
};

/**
 * Uploads one file to the media store at <MEDIA_BASE>/<fileId> and returns its public URL.
 * Uses the URL from the response when it has one, otherwise the upload address itself.
 * No auth header is sent: this is a third-party host, not our API.
 */
export async function uploadImage(file) {
  const target = `${MEDIA_BASE}/${newFileId(file)}`;
  pending += 1; emit();
  try {
    let res;
    try {
      res = await fetch(target, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-amz-acl': 'public-read' }, body: file });
    } catch {
      throw new ApiError('Cannot reach the image server', 0);
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) throw new ApiError(messageOf(data, res.status).replace(/^Request failed/, 'Image upload failed'), res.status, data);
    return data?.url ?? data?.fileUrl ?? data?.data?.url ?? res.headers.get('location') ?? target;
  } finally { pending -= 1; emit(); }
}

/** Reads the role from the login response, falling back to the JWT payload. Returns 'ADMIN' | 'MANAGER' | ''. */
function roleFrom(data) {
  let role = data?.user?.role ?? data?.staff?.role ?? data?.role;
  if (!role && data?.accessToken) {
    try {
      const b64 = data.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      role = JSON.parse(atob(b64)).role;
    } catch { /* no readable role */ }
  }
  return String(role || '').toUpperCase();
}

/** UI-only convenience: the server must enforce the same rules. Unknown role is treated as MANAGER (restricted). */
export const getRole = () => session?.role || '';
export const isAdminSession = () => getRole() === 'ADMIN';

export async function login(identifier, password) {
  const data = await request('POST', '/auth/staff/login', { body: { identifier, password }, auth: false });
  saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, role: roleFrom(data) });
  return data;
}

export const logout = () => saveSession(null);
