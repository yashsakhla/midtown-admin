import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getSession, login, logout, setAuthLostHandler } from '../api/client';
import {
  buildCash, dcOut, dec, emptyDb, list, mapBooking, mapEntry, mapExpense, mapInvoice, mapMenu,
  mapOnline, mapRequest, mapRoom, mapRoomTypes, mapStaff, mapStock, modeOut, one, roomStatusOut
} from '../api/mappers';
import { addDays, now, today } from '../lib/format';
import { REQUEST_EXTRAS } from '../lib/requests';

const HotelContext = createContext(null);

const PAY_KIND = { Advance: 'ADVANCE', 'Part payment': 'PART_PAYMENT', Refund: 'REFUND' };
const errCode = (e) => e?.data?.code ?? e?.data?.error?.code;
const errEntryId = (e) => e?.data?.entryId ?? e?.data?.error?.entryId ?? e?.data?.details?.entryId;

export function HotelProvider({ children }) {
  const [db, setDb] = useState(emptyDb);
  const [kots, setKots] = useState([]);           // no list endpoint yet: session-only kitchen queue
  const [att, setAtt] = useState({});             // attendance has PUT only: remembered per session
  const [authed, setAuthed] = useState(() => !!getSession());
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null);       // { type, props }
  const [toastMsg, setToastMsg] = useState('');
  const dateRef = useRef(today());
  const dbRef = useRef(db);
  dbRef.current = db;

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => setToastMsg(''), 2400);
  }, []);

  const openSheet = useCallback((type, props = {}) => setSheet({ type, props }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  /* ------------------------------------------------------------- loading */

  /** Guest requests are polled separately so new ones appear without a full reload. */
  const loadRequests = useCallback(async () => {
    try {
      const raw = list(await api.get('/service-requests'));
      setDb((prev) => {
        const byStay = Object.fromEntries(prev.rooms.filter((r) => r.stayId).map((r) => [r.stayId, r]));
        return { ...prev, requests: raw.map((r) => mapRequest(r, byStay)) };
      });
    } catch { /* keep the previous list */ }
  }, []);

  /** Pulls every list the screens show. A failing slice keeps its previous data. */
  const reload = useCallback(async () => {
    const date = dateRef.current;
    const guard = (p) => p.then((v) => ({ ok: true, v }), () => ({ ok: false }));

    const [roomsR, typesR] = await Promise.all([guard(api.get('/rooms')), guard(api.get('/guest/room-types'))]);
    const [entriesR, daybookR, menuR, onlineR, bookingsR, stockR, staffR, expensesR, invoicesR] = await Promise.all([
      guard(api.get('/entries', { date })),
      guard(api.get('/daybook', { date })),
      guard(api.get('/menu')),
      guard(api.get('/online-orders', { date })),
      guard(api.get('/bookings')),
      guard(api.get('/stock')),
      guard(api.get('/staff')),
      guard(api.get('/expenses', { date })),
      guard(api.get('/invoices', { date }))
    ]);

    setDb((prev) => {
      const next = { ...prev, date };

      const rawRooms = roomsR.ok ? list(roomsR.v) : null;
      const types = mapRoomTypes(typesR.ok ? typesR.v : [], rawRooms || []);
      if (types.length) {
        next.roomTypes = types;
        next.tariff = Object.fromEntries(types.map((t) => [t.name, t.tariff]));
      }
      const typeById = Object.fromEntries(next.roomTypes.map((t) => [t.id, t]));

      if (rawRooms) {
        next.rooms = rawRooms.map((r) => mapRoom(r, typeById))
          .sort((a, b) => a.floor - b.floor || a.no.localeCompare(b.no, undefined, { numeric: true }));
      }
      const roomById = Object.fromEntries(next.rooms.map((r) => [r.id, r]));

      if (entriesR.ok) next.entries = list(entriesR.v).map((e) => mapEntry(e, roomById));
      if (expensesR.ok) next.expenses = list(expensesR.v).map(mapExpense);
      if (entriesR.ok || daybookR.ok || expensesR.ok) {
        next.cash = buildCash(daybookR.ok ? (daybookR.v?.data ?? daybookR.v) : null, next.entries, next.expenses);
      }
      if (menuR.ok) next.menu = mapMenu(menuR.v);
      if (onlineR.ok) next.online = list(onlineR.v).map(mapOnline);
      if (bookingsR.ok) next.bookings = list(bookingsR.v).map((b) => mapBooking(b, typeById));
      if (stockR.ok) next.stock = list(stockR.v).map(mapStock);
      if (staffR.ok) next.staff = list(staffR.v).map(mapStaff);
      if (invoicesR.ok) next.invoices = list(invoicesR.v).map(mapInvoice);
      return next;
    });
    loadRequests();
    if (!roomsR.ok) toast('Could not load rooms — check the server');
  }, [toast, loadRequests]);

  const signOut = useCallback(() => {
    logout();
    setAuthed(false);
    setDb(emptyDb());
    setSheet(null);
  }, []);

  useEffect(() => { setAuthLostHandler(() => { setAuthed(false); setDb(emptyDb()); }); }, []);

  useEffect(() => {
    if (!authed) return undefined;
    let live = true;
    setLoading(true);
    reload().finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [authed, reload]);

  useEffect(() => {
    if (!authed) return undefined;
    const t = window.setInterval(loadRequests, 30000);
    return () => window.clearInterval(t);
  }, [authed, loadRequests]);

  const signIn = useCallback(async (identifier, password) => {
    await login(identifier, password);
    setAuthed(true);
  }, []);

  /** Runs an API change, refreshes the data, and reports the outcome. */
  const run = useCallback(async (fn, okMsg, { close = true } = {}) => {
    try {
      const out = await fn();
      await reload();
      if (close) closeSheet();
      if (okMsg) toast(okMsg);
      return out ?? true;
    } catch (e) {
      toast(e.message || 'Something went wrong');
      return false;
    }
  }, [reload, closeSheet, toast]);

  const roomOf = (no) => dbRef.current.rooms.find((r) => r.no === no);
  const businessDate = () => dateRef.current;

  /* ------------------------------------------------------------------ rooms */

  const setRoomStatus = useCallback((no, status) => {
    const r = roomOf(no);
    if (!r) return false;
    return run(() => api.patch(`/rooms/${r.id}/status`, { status: roomStatusOut(status) }), `Room ${no} updated`);
  }, [run]);

  const markAllClean = useCallback(
    () => run(() => api.post('/rooms/mark-all-clean'), 'All rooms marked ready', { close: false }), [run]);

  const addRoom = useCallback((room) => {
    if (!room.no) { toast('Room number is needed'); return false; }
    const type = dbRef.current.roomTypes.find((t) => t.name === room.type);
    if (!type) { toast('Pick a room type'); return false; }
    return run(() => api.post('/rooms', {
      number: String(room.no), floor: Number(room.floor) || 1,
      roomTypeId: type.id, rate: dec(room.rate || type.tariff)
    }), `Room ${room.no} added`);
  }, [run, toast]);

  /* ------------------------------------------------------- check in / out */

  const postPayment = (stayId, kind, amount, mode, narration, extra = {}) =>
    api.patch(`/stays/${stayId}`, {
      ...extra,
      payment: { kind, amount: dec(amount), mode: modeOut(mode), businessDate: businessDate(), time: now(), narration }
    });

  const checkIn = useCallback((form) => {
    const room = roomOf(form.room);
    const name = (form.guest || '').trim();
    if (!room || !name) { toast('Room and guest name are needed'); return false; }
    const nights = Number(form.nights) || 1;
    const amount = Number(form.amount) || 0;

    return run(async () => {
      const res = await api.post('/stays', {
        roomId: room.id, guestName: name, phone: form.phone,
        vehicle: form.vehicle && form.vehicle !== '—' ? form.vehicle : undefined,
        checkOut: form.checkOut || addDays(form.date, nights), nights,
        rate: dec(room.rate), bookingId: null
      });
      const stay = one(res, 'stay');
      if (amount > 0 && stay?.id) {
        await postPayment(stay.id, 'ADVANCE', amount, form.mode, form.narration || 'Advance at check-in');
      }
    }, `Room ${form.room} checked in`);
  }, [run, toast]);

  const checkOut = useCallback((no, form) => {
    const room = roomOf(no);
    if (!room?.stayId) return false;
    const amount = Number(form.amount) || 0;
    return run(async () => {
      if (amount > 0) await postPayment(room.stayId, 'PART_PAYMENT', amount, form.mode, form.narration || 'Final settlement');
      await api.post(`/stays/${room.stayId}/checkout`, { businessDate: businessDate() });
    }, 'Checked out — sent to housekeeping');
  }, [run]);

  const updateGuestStay = useCallback((no, form) => {
    const room = roomOf(no);
    if (!room?.stayId) return false;
    const kind = PAY_KIND[form.payType];
    const amount = Number(form.payAmount) || 0;
    const body = {
      guestName: form.guest, vehicle: form.vehicle && form.vehicle !== '—' ? form.vehicle : undefined,
      checkOut: form.checkOut || addDays(form.checkIn, Number(form.nights) || 1)
    };
    if (kind && amount) {
      body.payment = {
        kind, amount: dec(amount), mode: modeOut(form.payMode), businessDate: businessDate(),
        time: now(), narration: form.payNarration || `${form.payType} — room ${no}`
      };
    }
    return run(() => api.patch(`/stays/${room.stayId}`, body),
      kind && amount ? `${form.payType} posted · stay updated` : 'Stay updated — no duplicate entry');
  }, [run]);

  /* ------------------------------------------------------------- day book */

  const setDate = useCallback(async (date) => {
    dateRef.current = date;
    closeSheet();
    await reload();
    toast('Date changed');
  }, [reload, closeSheet, toast]);

  const setOpening = useCallback((amount) =>
    run(() => api.patch('/daybook/opening', { businessDate: businessDate(), openingBalance: dec(amount) }),
      'Opening balance updated'), [run]);

  const entryBody = (form, room) => ({
    roomId: room?.id ?? null,
    guestName: (form.guest || '').trim(),
    phone: form.phone, vehicle: form.vehicle,
    type: form.type, mode: modeOut(form.mode), dc: dcOut(form.dc),
    amount: dec(form.amount), narration: form.narration
  });

  /** A duplicate line is rejected by the server; we then open the original for editing. */
  const addEntry = useCallback(async (form) => {
    const amount = Number(form.amount) || 0;
    const name = (form.guest || '').trim();
    if (!name && !amount) { toast('Enter a name or amount'); return { ok: false }; }
    try {
      await api.post('/entries', { businessDate: businessDate(), time: now(), ...entryBody(form, roomOf(form.room)) });
      await reload();
      closeSheet();
      toast('Entry saved');
      return { ok: true };
    } catch (e) {
      if (errCode(e) === 'DUPLICATE_ENTRY' && errEntryId(e)) {
        openSheet('editEntry', { id: errEntryId(e) });
        toast('Matching entry found — edit it instead of adding again');
        return { ok: false, duplicate: errEntryId(e) };
      }
      toast(e.message);
      return { ok: false };
    }
  }, [reload, openSheet, closeSheet, toast]);

  const updateEntry = useCallback((id, form) =>
    run(() => api.patch(`/entries/${id}`, entryBody(form, roomOf(form.room))), 'Entry corrected — day book updated'), [run]);

  const deleteEntry = useCallback((id) =>
    run(() => api.del(`/entries/${id}`), 'Entry deleted'), [run]);

  const closeDay = useCallback(() =>
    run(() => api.post('/daybook/close', { businessDate: businessDate() }), 'Day closed'), [run]);

  /* ---------------------------------------------------------- restaurant */

  const settleBill = useCallback(async (cart, table, mode) => {
    const total = cart.reduce((s, c) => s + c.p * c.q, 0);
    const ok = await run(async () => {
      const res = await api.post('/kots', {
        tableLabel: table, billTo: 'PAY_NOW',
        items: cart.map((c) => ({ menuItemId: c.id, qty: c.q, note: '' }))
      });
      const kot = one(res, 'kot');
      await api.post('/bills/settle', {
        kotIds: [kot.id], mode: modeOut(mode === 'Room charge' ? 'Cash' : mode),
        businessDate: businessDate(), time: now()
      });
    }, 'Bill settled and posted', { close: false });
    return ok ? total : false;
  }, [run]);

  const sendKot = useCallback((room, items, waiter) => {
    const r = roomOf(room);
    if (!r?.stayId) { toast('That room has no active stay'); return false; }
    const waiterId = dbRef.current.staff.find((s) => s.name === waiter)?.id;
    return run(async () => {
      const res = await api.post('/kots', {
        stayId: r.stayId, tableLabel: null, billTo: 'ROOM', waiterId, note: '',
        items: items.map((c) => ({ menuItemId: c.id, qty: c.q, note: '' }))
      });
      const kot = one(res, 'kot');
      setKots((prev) => [{
        id: kot?.id ?? Math.random().toString(36).slice(2), room, waiter,
        items: items.map((c) => ({ n: c.n, q: c.q, p: c.p })), time: now(), status: 'Preparing'
      }, ...prev]);
    }, 'Slip printed, charge added to folio');
  }, [run, toast]);

  const addOnlineOrder = useCallback((form) => {
    const amount = Number(form.amount) || 0;
    if (!amount) { toast('Enter the order value'); return false; }
    return run(() => api.post('/online-orders', {
      businessDate: businessDate(), platform: form.plat, orderId: form.oid || `ORD-${Date.now().toString().slice(-6)}`,
      items: [{ name: form.items || 'Order', qty: 1, price: dec(amount) }],
      amount: dec(amount), commissionPct: dec(form.commission)
    }), 'Order added');
  }, [run, toast]);

  /* ---------------------------------------------------------- back office */

  const addBooking = useCallback((form) => {
    const guest = (form.guest || '').trim();
    if (!guest) { toast('Guest name is needed'); return false; }
    const type = dbRef.current.roomTypes.find((t) => t.name === form.type);
    if (!type) { toast('Pick a room type'); return false; }
    return run(() => api.post('/bookings', {
      source: form.src, ref: form.ref || `REF${Date.now().toString().slice(-7)}`,
      guestName: guest, phone: form.phone, roomTypeId: type.id,
      rooms: Number(form.rooms) || 1, pax: Number(form.pax) || 2,
      arrivalDate: form.inD, departureDate: addDays(form.inD, 1),
      amount: dec(form.amount), payment: form.pay, note: ''
    }), 'Booking added');
  }, [run, toast]);

  const adjustStock = useCallback(async (index, delta) => {
    const s = dbRef.current.stock[index];
    if (!s) return;
    setDb((d) => ({ ...d, stock: d.stock.map((x, i) => (i === index ? { ...x, qty: Math.max(0, x.qty + delta) } : x)) }));
    try {
      await api.post(`/stock/${s.id}/adjust`, { delta: dec(delta), reason: 'Manual adjustment' });
    } catch (e) {
      toast(e.message);
      reload();
    }
  }, [reload, toast]);

  const setAttendance = useCallback(async (staffId, mark) => {
    const prev = att[staffId];
    setAtt((a) => ({ ...a, [staffId]: mark }));
    try {
      await api.put('/attendance', { staffId, businessDate: businessDate(), mark });
    } catch (e) {
      setAtt((a) => ({ ...a, [staffId]: prev }));
      toast(e.message);
    }
  }, [att, toast]);

  const updateRequest = useCallback(async (id, { status, remark, price }) => {
    try {
      const body = { status };
      if (REQUEST_EXTRAS) {
        if (remark) body.remark = remark;
        if (Number(price) > 0) body.price = dec(price);
      }
      await api.patch(`/service-requests/${id}`, body);
      await Promise.all([loadRequests(), Number(price) > 0 ? reload() : null]);
      closeSheet();
      toast('Request updated');
      return true;
    } catch (e) {
      toast(e.message);
      return false;
    }
  }, [toast, loadRequests, reload, closeSheet]);

  const addExpense = useCallback((form) => {
    const amount = Number(form.amount) || 0;
    if (!amount) { toast('Enter the amount'); return false; }
    return run(() => api.post('/expenses', {
      businessDate: businessDate(), head: form.head, vendor: form.vendor,
      mode: modeOut(form.mode), amount: dec(amount), narration: form.narration
    }), 'Expense recorded');
  }, [run, toast]);

  const saveInvoice = useCallback((inv) =>
    run(() => api.post('/invoices', {
      businessDate: inv.date || businessDate(), party: inv.party, partyGstin: inv.gstin || null, stayId: null,
      lines: [{ description: inv.desc, kind: 'ROOM', qty: Number(inv.qty) || 1, rate: dec(inv.rate) }]
    }), 'Invoice saved'), [run]);

  const fullDb = useMemo(() => ({ ...db, kots, att }), [db, kots, att]);

  const value = useMemo(() => ({
    db: fullDb, tab, setTab, sheet, openSheet, closeSheet, toastMsg, toast,
    authed, loading, signIn, signOut, reload,
    actions: {
      setDate, setOpening,
      addRoom, setRoomStatus, markAllClean,
      checkIn, checkOut,
      addEntry, updateEntry, deleteEntry, closeDay,
      settleBill, sendKot, addOnlineOrder,
      addBooking, adjustStock, setAttendance, addExpense,
      updateGuestStay, saveInvoice, updateRequest
    }
  }), [
    fullDb, tab, sheet, toastMsg, openSheet, closeSheet, toast, authed, loading, signIn, signOut, reload,
    setDate, setOpening, addRoom, setRoomStatus, markAllClean, checkIn, checkOut,
    addEntry, updateEntry, deleteEntry, closeDay, settleBill, sendKot,
    addOnlineOrder, addBooking, adjustStock, setAttendance, addExpense,
    updateGuestStay, saveInvoice, updateRequest
  ]);

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel() {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error('useHotel must be used inside <HotelProvider>');
  return ctx;
}
