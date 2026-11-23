/** Attendance marks and small calendar helpers (all dates are plain YYYY-MM-DD strings, no time zones). */

export const MARKS = [
  { code: 'P', label: 'Present', tone: 'g' },
  { code: 'A', label: 'Absent', tone: 'r' },
  { code: 'L', label: 'Leave', tone: 'o' }
];

const NORM = { P: 'P', PRESENT: 'P', A: 'A', ABSENT: 'A', L: 'L', LEAVE: 'L', ON_LEAVE: 'L' };
export const normMark = (m) => NORM[String(m || '').toUpperCase()] || '';
export const markLabel = (code) => MARKS.find((m) => m.code === code)?.label || 'Not marked';

const pad = (n) => String(n).padStart(2, '0');
export const monthOf = (date) => String(date).slice(0, 7);
export const daysInMonth = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
export const monthRange = (ym) => [`${ym}-01`, `${ym}-${pad(daysInMonth(ym))}`];

export function shiftMonth(ym, n) {
  const t = Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

export const monthTitle = (ym) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

/** Cells for a Monday-first month grid: leading blanks, then every day of the month. */
export function monthCells(ym) {
  const lead = (new Date(`${ym}-01T00:00:00`).getDay() + 6) % 7;
  return [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(ym) }, (_, i) => `${ym}-${pad(i + 1)}`)];
}
