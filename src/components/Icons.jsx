/** All inline SVG icons used by the app, matching the original artwork. */

const stroke = { strokeLinecap: 'round', strokeLinejoin: 'round' };

export const TAB_ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  rooms: 'M4 21V7l8-4 8 4v14M9 21v-5h6v5',
  book: 'M6 3h9l5 5v13H6zM15 3v5h5M9 13h7M9 17h5',
  food: 'M7 3v8a3 3 0 006 0V3M10 11v10M17 3c-1.5 2-2 4-2 6h4c0-2-.5-4-2-6zM17 9v12',
  more: 'M4 6h16M4 12h16M4 18h16'
};

export function TabIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d={TAB_ICONS[name]} />
    </svg>
  );
}

const BADGE_PATHS = {
  vacant: 'M14 7a3 3 0 100 6 3 3 0 000-6zM11.2 11.2L4 18.4V21h2.6l.8-.8v-1.6h1.6l.8-.8v-1.6h1.6l1.6-1.6',
  occupied: 'M12 12a4 4 0 100-8 4 4 0 000 8zM5 21v-1.5C5 16.5 8 15 12 15s7 1.5 7 4.5V21',
  dirty: 'M14 3l-2 2 5 5 2-2-5-5zM11 6L4 13v5h5l7-7M5 5l1 2 2-1-2-1-1 0z',
  maintenance: 'M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.4 2.4-2.1-.6-.6-2.1z',
  ooo: 'M12 8v5M12 16.5v.5M10.3 4.2L2.8 17.5A1.5 1.5 0 004.1 20h15.8a1.5 1.5 0 001.3-2.5L13.7 4.2a1.5 1.5 0 00-2.6 0z'
};

/** Key / person / broom / warning, by room status. */
export function StatusBadgeIcon({ status }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={BADGE_PATHS[status] || BADGE_PATHS.vacant} {...stroke} />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M8 3v3M16 3v3M4 9h16M5 5h14v15H5z" />
    </svg>
  );
}

const KPI_PATHS = {
  users: 'M16 20v-2a4 4 0 00-8 0v2M12 12a4 4 0 100-8 4 4 0 000 8',
  broom: 'M14 3l-2 2 5 5 2-2-5-5zM11 6L4 13v5h5l7-7',
  bell: 'M6 9a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 21h4',
  food: 'M7 3v8a3 3 0 006 0V3M10 11v10M17 3c-1.5 2-2 4-2 6h4c0-2-.5-4-2-6zM17 9v12',
  calendar: 'M8 3v3M16 3v3M4 9h16M5 5h14v15H5z',
  bank: 'M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18',
  down: 'M12 4v14M6 12l6 6 6-6',
  up: 'M12 20V6M6 12l6-6 6 6',
  wallet: 'M3 7h18v11H3zM3 11h18M7 15h3',
  check: 'M5 13l4 4L19 7'
};

/** Line icon used inside stat cards. */
export function KpiIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d={KPI_PATHS[name]} />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
