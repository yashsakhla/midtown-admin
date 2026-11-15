/**
 * Translates between backend payloads and the shapes the screens use.
 * Every reader is defensive: the UI keeps working if a field is missing.
 */
import { today } from '../lib/format';
import { categoryOf } from '../lib/rooms';

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
export const roomStatusIn = (s) => ({ VACANT: 'vacant', OCCUPIED: 'occupied', DIRTY: 'dirty', OOO: 'ooo', MAINTENANCE: 'maintenance' }[String(s).toUpperCase()] || 'vacant');
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

export const mapShift = (s) => ({
  id: s.id, from: String(s.fromRoomNumber ?? s.fromRoom ?? ''), to: String(s.toRoomNumber ?? s.toRoom ?? ''),
  fromRate: n(s.fromRate), toRate: n(s.toRate), kind: String(s.kind || '').toLowerCase(),
  date: dateOnly(s.date ?? s.createdAt), nightsBefore: n(s.nightsBefore), adjustment: n(s.adjustment)
});

export function mapRoom(r, typeById) {
  const t = typeById[r.roomTypeId ?? r.roomType?.id] || {};
  const stay = r.currentStay || r.stay || null;
  const nights = n(stay?.nights) || 1;
  const rate = n(stay?.rate ?? r.rate ?? r.roomType?.tariff ?? t.tariff);
  const paid = n(stay?.paid ?? stay?.advance ?? stay?.totalPaid);
  const type = r.roomType?.name ?? r.roomTypeName ?? t.name ?? 'AC Standard';
  const singleRate = n(r.singleRate ?? r.rate ?? t.tariff);
  const doubleRate = n(r.doubleRate) || singleRate;
  return {
    id: r.id,
    no: String(r.number ?? r.roomNumber ?? r.no),
    floor: n(r.floor) || 1,
    type,
    category: r.category ?? categoryOf(type),
    singleRate,
    doubleRate,
    guests: n(stay?.guests) || 1,
    stayRate: rate,
    features: Array.isArray(r.features) ? r.features : [],
    description: r.description ?? '',
    beds: r.beds ?? '', blurb: r.blurb ?? '', size: r.size ?? '',
    sizeSqft: r.sizeSqft == null || r.sizeSqft === '' ? null : n(r.sizeSqft),
    sleeps: r.sleeps == null || r.sleeps === '' ? null : n(r.sleeps),
    additionalGuestPrice: r.additionalGuestPrice == null || r.additionalGuestPrice === '' ? null : n(r.additionalGuestPrice),
    images: (r.images ?? r.photos ?? []).map((i, k) => (typeof i === 'string' ? { id: String(k), url: i } : { id: i.id ?? String(k), url: i.url ?? i.photoUrl ?? '' })).filter((i) => i.url),
    maintenance: { reason: r.maintenanceReason ?? r.maintenance?.reason ?? '', until: dateOnly(r.maintenanceUntil ?? r.maintenance?.until) },
    shifts: (stay?.shifts ?? []).map(mapShift),
    roomCharges: stay?.roomCharges ?? null,
    roomTypeId: r.roomTypeId ?? r.roomType?.id,
    status: roomStatusIn(r.status),
    stayId: stay?.id ?? null,
    guest: stay ? stay.guestName ?? stay.guest ?? '' : null,
    phone: stay?.phone ?? '',
    vehicle: stay?.vehicle || '—',
    checkIn: dateOnly(stay?.checkInDate ?? stay?.checkIn ?? stay?.checkedInAt),
    checkOut: dateOnly(stay?.checkOutDate ?? stay?.checkOut ?? stay?.expectedCheckOut),
    nights,
    rate: singleRate,
    folio: stay ? n(stay.balance ?? stay.folioBalance ?? Math.max(0, rate * nights - paid)) : 0
  };
}

/* --------------------------------------------------------------- entries */

/** Where a money line came from; anything not MANUAL was posted by the system. */
export const SOURCES = {
  MANUAL: 'Manual', CHECKIN: 'Check-in', CHECKOUT: 'Checkout', STAY_PAYMENT: 'Stay payment',
  RESTAURANT: 'Restaurant', ROOM_SERVICE: 'Room service', ONLINE: 'Online order',
  REQUEST: 'Guest request', EXPENSE: 'Expense', REFUND: 'Refund', OTHER: 'Other'
};
export const sourceLabel = (s) => SOURCES[String(s || 'MANUAL').toUpperCase()] || title(s);

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
    narration: e.narration ?? '',
    source: String(e.source || 'MANUAL').toUpperCase(),
    shortfall: n(e.shortfall)
  };
}

/** One line of the unified day register (entries, expenses, system postings). */
const mapLine = (l, roomById = {}) => ({
  ...mapEntry(l, roomById),
  id: l.id ?? l.entryId,
  kind: String(l.kind || (String(l.source).toUpperCase() === 'EXPENSE' ? 'expense' : 'entry')).toLowerCase()
});

/**
 * Builds the register shown in the day book. Prefers the server's unified
 * /daybook/register; otherwise merges entries and expenses itself.
 * Any gap against the server totals appears as one balancing line.
 */
export function buildRegister(daybook, entries, expenses, rawRegister, roomById) {
  let lines;
  if (Array.isArray(rawRegister)) {
    lines = rawRegister.map((l) => mapLine(l, roomById));
  } else {
    lines = [
      ...entries.map((e) => ({ ...e, kind: 'entry' })),
      ...expenses.map((x) => ({
        id: 'x-' + x.id, kind: 'expense', time: x.time, room: '', guest: x.vendor || '', phone: '', vehicle: '',
        type: 'Expense', mode: x.mode, dc: 'debit', amount: x.amount, narration: x.head + (x.narration ? ` · ${x.narration}` : ''),
        source: 'EXPENSE', shortfall: 0
      }))
    ];
    if (daybook) {
      const sum = (dc) => lines.filter((t) => t.dc === dc).reduce((s, t) => s + t.amount, 0);
      const dCr = n(daybook.credits) - sum('credit');
      const dDr = n(daybook.debits) - sum('debit');
      const gap = (id, dc, amount, type) => ({
        id, kind: 'entry', time: '', room: '', guest: '', phone: '', vehicle: '', type, mode: dc === 'credit' ? 'Bank' : 'Cash',
        dc, amount, narration: 'Posted by other modules', source: 'OTHER', shortfall: 0
      });
      if (dCr > 0.5) lines.push(gap('oth-cr', 'credit', dCr, 'Other receipt'));
      if (dDr > 0.5) lines.push(gap('oth-dr', 'debit', dDr, 'Other payment'));
    }
  }
  return lines.sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

export function buildCash(daybook, register) {
  const txns = register.map((l) => ({
    id: l.id, head: l.type, mode: l.mode, dc: l.dc, amount: l.amount, narration: l.narration || l.guest
  }));
  const d = daybook || {};
  return {
    opening: n(d.openingBalance), closed: !!(d.closedByUserId || d.closedAt || String(d.status).toUpperCase() === 'CLOSED'),
    txns,
    startedAt: d.openedAt ?? '', startedBy: d.openedByName ?? '',
    closedAt: d.closedAt ?? '', closedBy: d.closedByName ?? '',
    counted: d.countedCash == null ? null : n(d.countedCash),
    expectedCash: d.expectedCash == null ? null : n(d.expectedCash),
    shortage: n(d.shortage), note: d.closeNote ?? ''
  };
}

/** The business day currently open (a shift can run past midnight, so this is not the clock date). */
export const mapDay = (d) => {
  if (!d) return null;
  const x = d.data ?? d;
  return {
    status: String(x.status || (x.openedAt && !x.closedAt ? 'OPEN' : 'NONE')).toUpperCase(),
    businessDate: dateOnly(x.businessDate),
    openedAt: x.openedAt ?? '', openedBy: x.openedByName ?? '',
    openingBalance: n(x.openingBalance),
    lastClosing: n(x.lastClosingBalance ?? x.suggestedOpening),
    lastClosedDate: dateOnly(x.lastClosedDate),
    suggestedDate: dateOnly(x.suggestedNextDate)
  };
};

/* ------------------------------------------------------------- customers */

export const mapDoc = (d) => ({
  id: d.id, type: title(d.type), number: d.number ?? d.documentNumber ?? '',
  url: d.url ?? d.fileUrl ?? '', name: d.fileName ?? '', at: dateOnly(d.createdAt ?? d.uploadedAt)
});

const mapStayHistory = (s) => ({
  id: s.id, room: String(s.roomNumber ?? s.room ?? ''), roomType: s.roomType?.name ?? s.roomTypeName ?? s.roomType ?? '',
  checkIn: dateOnly(s.checkInDate ?? s.checkIn), checkOut: dateOnly(s.checkOutDate ?? s.checkOut),
  nights: n(s.nights), guests: n(s.guests) || 1, amount: n(s.total ?? s.amount),
  paid: n(s.paid), balance: n(s.balance), status: title(s.status)
});

/** Same shape for the list and the detail view; the detail adds stays and payments. */
export const mapCustomer = (c) => {
  const documents = (c.documents ?? []).map(mapDoc);
  return {
    id: c.id, name: c.name ?? c.fullName ?? '', phone: c.phone ?? '', email: c.email ?? '',
    visits: n(c.visits ?? c.stayCount), spend: n(c.totalSpent ?? c.totalSpend),
    firstVisit: dateOnly(c.firstVisitAt ?? c.createdAt), lastVisit: dateOnly(c.lastVisitAt ?? c.lastStayDate),
    hasDoc: !!(c.hasDocument ?? documents.length), documents,
    credit: n(c.creditBalance ?? c.dueBalance ?? c.outstanding),
    ledger: (c.creditEntries ?? c.ledger ?? []).map((l) => ({
      id: l.id, date: dateOnly(l.businessDate ?? l.createdAt), kind: String(l.kind || l.type || 'CHARGE').toUpperCase(),
      amount: n(l.amount), mode: l.mode ? modeIn(l.mode) : '', narration: l.narration ?? ''
    })),
    docType: c.documentType ? title(c.documentType) : documents[0]?.type ?? '',
    stays: (c.stays ?? []).map(mapStayHistory),
    payments: (c.payments ?? []).map((p) => ({
      id: p.id, date: dateOnly(p.businessDate ?? p.createdAt), type: title(p.type ?? p.kind), mode: modeIn(p.mode),
      dc: dcIn(p.dc), amount: n(p.amount), narration: p.narration ?? ''
    }))
  };
};

/* ------------------------------------------------------------ the rest */

export const mapMenu = (raw) =>
  list(raw).filter((m) => m.available !== false).map((m) => ({
    id: m.id, n: m.name, p: n(m.price), c: m.category || 'Main', veg: m.isVeg, img: m.photoUrl || m.imageUrl || null,
    desc: m.description ?? ''
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
  inD: dateOnly(b.arrivalDate), outD: dateOnly(b.departureDate), note: b.note ?? '', amount: n(b.amount),
  pay: b.payment ?? '', status: title(b.status)
});

export const mapStock = (s) => ({
  id: s.id, item: s.item, cat: s.category, unit: s.unit, qty: n(s.qty), min: n(s.minQty), rate: n(s.rate)
});

export const mapStaff = (s) => ({
  id: s.id, name: s.name, role: s.role, shift: s.shift, salary: n(s.salary), phone: s.phone ?? ''
});

export const mapExpense = (x) => ({
  id: x.id, head: x.head, vendor: x.vendor ?? '', mode: x.mode ? modeIn(x.mode) : '', amount: n(x.amount), narration: x.narration ?? '',
  onCredit: !!(x.onCredit ?? x.isCredit), paid: n(x.paidAmount ?? (x.onCredit ? 0 : x.amount)),
  due: n(x.dueAmount ?? x.balance ?? 0), dueDate: dateOnly(x.dueDate),
  time: hhmm(x.time ?? x.createdAt), date: dateOnly(x.businessDate)
});

export const mapInvoice = (i) => ({
  id: i.number ?? i.id, party: i.party, date: dateOnly(i.businessDate)
});

/** A request belongs to a stay; once that stay is no longer a room's current stay the guest has left. */
export const mapRequest = (r, roomByStay) => {
  const room = roomByStay[r.stayId];
  const created = r.createdAt ? new Date(r.createdAt) : null;
  return {
    id: r.id, stayId: r.stayId, key: r.key, label: r.label || title(r.key), note: r.note ?? '',
    status: r.status, handledBy: r.handledByUserId, handledByName: r.handledByName ?? '',
    remark: r.remark ?? r.statusRemark ?? '', price: n(r.price),
    room: room?.no ?? r.roomNumber ?? null, guest: room?.guest ?? r.guestName ?? '', phone: room?.phone ?? r.phone ?? '',
    checkIn: room?.checkIn ?? '', checkOut: room?.checkOut ?? '',
    stayActive: !!room && r.stayStatus !== 'CHECKED_OUT',
    expired: r.status === 'EXPIRED' || ((!room || r.stayStatus === 'CHECKED_OUT') && ['SENT', 'IN_PROGRESS'].includes(r.status)),
    time: created ? created.toTimeString().slice(0, 5) : '',
    date: created ? created.toISOString().slice(0, 10) : ''
  };
};

export const emptyDb = () => ({
  date: today(), day: null, tariff: {}, roomTypes: [], rooms: [], entries: [], register: [], customers: [],
  cash: { opening: 0, closed: false, txns: [], shortage: 0, counted: null },
  bookings: [], online: [], stock: [], staff: [], att: {}, expenses: [], payables: [],
  kots: [], invoices: [], menu: [], requests: []
});
