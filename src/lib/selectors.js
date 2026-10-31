/** Derived figures read off the hotel state. Pure functions — no side effects. */

export const countRooms = (db, status) => db.rooms.filter((r) => r.status === status).length;

export const occupancyPct = (db) =>
  db.rooms.length ? Math.round((countRooms(db, 'occupied') / db.rooms.length) * 100) : 0;

export const totalReceipt = (db) =>
  db.cash.txns.filter((t) => t.dc === 'credit').reduce((s, t) => s + t.amount, 0);

export const totalPayout = (db) =>
  db.cash.txns.filter((t) => t.dc === 'debit').reduce((s, t) => s + t.amount, 0);

/** Net collected on one payment mode (credits minus debits). */
export const byMode = (db, mode) =>
  db.cash.txns
    .filter((t) => t.mode === mode)
    .reduce((s, t) => s + (t.dc === 'credit' ? t.amount : -t.amount), 0);

export const closingBalance = (db) => db.cash.opening + totalReceipt(db) - totalPayout(db);

export const cashInHand = (db) => db.cash.opening + byMode(db, 'Cash');

export const occupiedRooms = (db) => db.rooms.filter((r) => r.status === 'occupied');

export const lowStock = (db) => db.stock.filter((s) => s.qty < s.min);

export const floors = (db) => [...new Set(db.rooms.map((r) => r.floor))].sort((a, b) => a - b);

/** Average rate of the rooms actually sold today. */
export const averageRoomRate = (db) => {
  const sold = occupiedRooms(db);
  if (!sold.length) return 0;
  return Math.round(sold.reduce((s, r) => s + r.rate, 0) / sold.length);
};

/** Revenue per available room. */
export const revPar = (db) => {
  if (!db.rooms.length) return 0;
  return Math.round(occupiedRooms(db).reduce((s, r) => s + r.rate, 0) / db.rooms.length);
};

export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank'];
