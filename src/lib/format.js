/** Formatting and small value helpers shared across the app. */

export const today = () => new Date().toISOString().slice(0, 10);

/** ₹ with Indian digit grouping, no decimals. */
export const money = (n) => {
  const v = Number(n || 0);
  return (v < 0 ? '-' : '') + '₹' + Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

/** Add n days to an ISO date string and return an ISO date string. */
export const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + (Number(n) || 0));
  return d.toISOString().slice(0, 10);
};

/** Short, readable id with a type prefix — E for entry, C for cash line, etc. */
export const uid = (prefix) => prefix + Math.random().toString(36).slice(2, 7).toUpperCase();

/** Current clock time as HH:MM. */
export const now = () => new Date().toTimeString().slice(0, 5);

export const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** 12 Nov 2026 */
export const fmtDate = (iso) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** "2026-11-12T10:05:00Z" or "10:05" -> "10:05 AM"; empty when unknown. */
export const fmtClock = (v) => {
  if (!v) return '';
  const d = /T|\d{4}-/.test(String(v)) ? new Date(v) : new Date(`1970-01-01T${v}`);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
};
