/**
 * Translates between backend payloads and the shapes the screens use.
 * Every reader is defensive: the UI keeps working if a field is missing.
 */
import { today } from '../lib/format';

export const list = (d) => (Array.isArray(d) ? d : d?.data ?? d?.items ?? d?.results ?? []);
export const one = (d, key) => d?.[key] ?? d?.data?.[key] ?? d?.data ?? d;

export const dec = (n) => (Number(n) || 0).toFixed(2);
const n = (v) => Number(v) || 0;
const title = (s) => {
  const t = String(s || '').replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const hhmm = (v) => {
  if (!v) return '';
  const s = String(v);
  const m = s.match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : s;
};
const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');

const MODE_IN = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', BANK: 'Bank', ROOM_CHARGE: 'Room charge' };
export const modeIn = (m) => MODE_IN[String(m || '').toUpperCase()] || title(m) || 'Cash';
export const modeOut = (m) => String(m || 'Cash').toUpperCase().replace(/\s+/g, '_');
export const dcIn = (d) => (String(d || '').toUpperCase() === 'DEBIT' ? 'debit' : 'credit');
export const dcOut = (d) => (d === 'debit' ? 'DEBIT' : 'CREDIT');
export const roomStatusIn = (s) => ({ VACANT: 'vacant', OCCUPIED: 'occupied', DIRTY: 'dirty', OOO: 'ooo' }[String(s).toUpperCase()] || 'vacant');
export const roomStatusOut = (s) => String(s).toUpperCase();

/* ----------------------------------------------------------- room types */

export function mapRoomTypes(raw, rooms = []) {
  const types = list(raw).map((t) => ({ id: t.id, name: t.name, tariff: n(t.tariff ?? t.rate) }));
  if (types.length) return types;
  const seen = new Map();
  rooms.forEach((r) => {
    const id = r.roomTypeId ?? r.roomType?.id;
    if (id && !seen.has(id)) {
      seen.set(id, { id, name: r.roomType?.name ?? r.roomTypeName ?? 'Room', tariff: n(r.roomType?.tariff ?? r.rate) });
    }
  });
  return [...seen.values()];
}

/* ----------------------------------------------------------------- rooms */

export function mapRoom(r, typeById) {
  const t = typeById[r.roomTypeId ?? r.roomType?.id] || {};
  const stay = r.currentStay || r.stay || null;
  const nights = n(stay?.nights) || 1;
  const rate = n(stay?.rate ?? r.rate ?? r.roomType?.tariff ?? t.tariff);
  const paid = n(stay?.paid ?? stay?.advance ?? stay?.totalPaid);
  return {
    id: r.id,
    no: String(r.number ?? r.roomNumber ?? r.no),
    floor: n(r.floor) || 1,
    type: r.roomType?.name ?? r.roomTypeName ?? t.name ?? 'Standard',
    roomTypeId: r.roomTypeId ?? r.roomType?.id,
    status: roomStatusIn(r.status),
    stayId: stay?.id ?? null,
    guest: stay ? stay.guestName ?? stay.guest ?? '' : null,
    phone: stay?.phone ?? '',
    vehicle: stay?.vehicle || '—',
    checkIn: dateOnly(stay?.checkInDate ?? stay?.checkIn ?? stay?.checkedInAt),
    checkOut: dateOnly(stay?.checkOutDate ?? stay?.checkOut ?? stay?.expectedCheckOut),
    nights,
    rate: n(r.rate ?? t.tariff ?? stay?.rate),
    folio: stay ? n(stay.balance ?? stay.folioBalance ?? Math.max(0, rate * nights - paid)) : 0
  };
}

/* --------------------------------------------------------------- entries */

export function mapEntry(e, roomById) {
  const room = roomById[e.roomId];
  return {
    id: e.id,
    txnId: e.cashTxnId ?? e.txnId ?? e.id,
    time: hhmm(e.time),
    room: room?.no ?? String(e.roomNumber ?? e.room ?? ''),
    guest: e.guestName ?? '',
    phone: e.phone ?? '',
    vehicle: e.vehicle ?? '',
    type: e.type ?? '',
    mode: modeIn(e.mode),
    dc: dcIn(e.dc ?? e.do),
    amount: n(e.amount),
    narration: e.narration ?? ''
  };
}

/** Day-book lines come from the entries and expenses; any gap against the server totals is shown as one balancing line. */
export function buildCash(daybook, entries, expenses) {
  const txns = [
    ...entries.filter((e) => e.amount).map((e) => ({
      id: e.txnId || e.id, head: e.type, mode: e.mode, dc: e.dc, amount: e.amount,
      narration: e.narration || e.guest || (e.room ? `Room ${e.room}` : '')
    })),
    ...expenses.map((x) => ({
      id: 'x-' + x.id, head: 'Expense', mode: x.mode, dc: 'debit', amount: x.amount, narration: x.head
    }))
  ];
  const sum = (dc) => txns.filter((t) => t.dc === dc).reduce((s, t) => s + t.amount, 0);
  if (daybook) {
    const dCr = n(daybook.credits) - sum('credit');
    const dDr = n(daybook.debits) - sum('debit');
    if (dCr > 0.5) txns.push({ id: 'oth-cr', head: 'Other receipt', mode: 'Bank', dc: 'credit', amount: dCr, narration: 'Online orders & other receipts' });
    if (dDr > 0.5) txns.push({ id: 'oth-dr', head: 'Other payment', mode: 'Cash', dc: 'debit', amount: dDr, narration: 'Other payments' });
  }
  return { opening: n(daybook?.openingBalance), closed: !!daybook?.closedByUserId, txns };
}

/* ------------------------------------------------------------ the rest */

export const mapMenu = (raw) =>
  list(raw).filter((m) => m.available !== false).map((m) => ({
    id: m.id, n: m.name, p: n(m.price), c: m.category || 'Main', veg: m.isVeg, img: m.photoUrl || null
  }));

export function mapOnline(o) {
  const items = Array.isArray(o.items)
    ? o.items.map((i) => `${i.qty ?? 1}× ${i.name}`).join(', ')
    : String(o.items ?? '');
  return {
    id: o.id, plat: o.platform, oid: o.orderId, items,
    amount: n(o.amount), payout: n(o.payout), status: title(o.status) || 'Preparing',
    time: hhmm(o.time ?? o.createdAt)
  };
}

export const mapBooking = (b, typeById) => ({
  id: b.id, src: b.source, ref: b.ref, guest: b.guestName, phone: b.phone ?? '',
  type: typeById[b.roomTypeId]?.name ?? b.roomType?.name ?? '—',
  rooms: n(b.rooms) || 1, pax: n(b.pax) || 1,
  inD: dateOnly(b.arrivalDate), amount: n(b.amount),
  pay: b.payment ?? '', status: title(b.status)
});

export const mapStock = (s) => ({
  id: s.id, item: s.item, cat: s.category, unit: s.unit, qty: n(s.qty), min: n(s.minQty), rate: n(s.rate)
});

export const mapStaff = (s) => ({
  id: s.id, name: s.name, role: s.role, shift: s.shift, salary: n(s.salary)
});

export const mapExpense = (x) => ({
  id: x.id, head: x.head, vendor: x.vendor ?? '', mode: modeIn(x.mode), amount: n(x.amount), narration: x.narration ?? ''
});

export const mapInvoice = (i) => ({
  id: i.number ?? i.id, party: i.party, date: dateOnly(i.businessDate)
});

export const emptyDb = () => ({
  date: today(), tariff: {}, roomTypes: [], rooms: [], entries: [],
  cash: { opening: 0, closed: false, txns: [] },
  bookings: [], online: [], stock: [], staff: [], att: {}, expenses: [],
  kots: [], invoices: [], menu: []
});
