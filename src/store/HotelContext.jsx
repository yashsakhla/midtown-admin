import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getSession, login, logout, setAuthLostHandler } from '../api/client';
import {
  buildCash, buildRegister, mapDay, dcOut, dec, emptyDb, list, mapBooking, mapCustomer, mapEntry, mapExpense, mapInvoice, mapMenu,
  mapOnline, mapRequest, mapRoom, mapRoomTypes, mapStaff, mapStock, modeOut, one, roomStatusOut
} from '../api/mappers';
import { addDays, now, today } from '../lib/format';
import { REQUEST_EXTRAS } from '../lib/requests';
import { DOC_API_TYPE } from '../lib/customers';
import { rateFor } from '../lib/rooms';

/** Optional room details: blank text is sent as empty, blank numbers as null. */
const roomDetails = (f) => ({
  beds: (f.beds || '').trim(), blurb: (f.blurb || '').trim(), size: (f.size || '').trim(),
  sizeSqft: f.sizeSqft === '' || f.sizeSqft == null ? null : Number(f.sizeSqft),
  sleeps: f.sleeps === '' || f.sleeps == null ? null : Number(f.sleeps),
  additionalGuestPrice: f.additionalGuestPrice === '' || f.additionalGuestPrice == null ? null : dec(f.additionalGuestPrice)
});

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
  const pickedRef = useRef(false);            // the user chose a date to look at; otherwise follow the open business day
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
    const guard = (p) => p.then((v) => ({ ok: true, v }), () => ({ ok: false }));

    const [roomsR, typesR, dayR] = await Promise.all([
      guard(api.get('/rooms')), guard(api.get('/guest/room-types')), guard(api.get('/business-day/current'))
    ]);
    const day = dayR.ok ? mapDay(dayR.v) : null;
    if (!pickedRef.current && day?.businessDate) dateRef.current = day.businessDate;
    const date = dateRef.current;
    const [entriesR, daybookR, registerR, menuR, onlineR, bookingsR, stockR, staffR, expensesR, invoicesR, customersR, payablesR] = await Promise.all([
      guard(api.get('/entries', { date })),
      guard(api.get('/daybook', { date })),
      guard(api.get('/daybook/register', { date })),
      guard(api.get('/menu')),
      guard(api.get('/online-orders', { date })),
      guard(api.get('/bookings')),
      guard(api.get('/stock')),
      guard(api.get('/staff')),
      guard(api.get('/expenses', { date })),
      guard(api.get('/invoices', { date })),
      guard(api.get('/customers', { limit: 500 })),
      guard(api.get('/expenses', { status: 'DUE' }))
    ]);

    setDb((prev) => {
      const next = { ...prev, date, day: dayR.ok ? day : prev.day };

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
      if (entriesR.ok || daybookR.ok || expensesR.ok || registerR.ok) {
        const book = daybookR.ok ? (daybookR.v?.data ?? daybookR.v) : null;
        next.register = buildRegister(book, next.entries, next.expenses, registerR.ok ? list(registerR.v) : null, roomById);
        next.cash = buildCash(book, next.register);
      }
      if (menuR.ok) next.menu = mapMenu(menuR.v);
      if (onlineR.ok) next.online = list(onlineR.v).map(mapOnline);
      if (bookingsR.ok) next.bookings = list(bookingsR.v).map((b) => mapBooking(b, typeById));
      if (stockR.ok) next.stock = list(stockR.v).map(mapStock);
      if (staffR.ok) next.staff = list(staffR.v).map(mapStaff);
      if (customersR.ok) next.customers = list(customersR.v).map(mapCustomer);
      if (payablesR.ok) next.payables = list(payablesR.v).map(mapExpense).filter((x) => x.due > 0);
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
  /** Money is stamped with the OPEN business day, not the clock date or the date being viewed. */
  const businessDate = () => {
    const d = dbRef.current.day;
    return d?.status === 'OPEN' && d.businessDate ? d.businessDate : dateRef.current;
  };
  /** True (and tells the user) when money cannot be posted because no day is open. */
  const dayBlocked = () => {
    const d = dbRef.current.day;
    if (d && d.status !== 'OPEN') { toast('Start the day first — no business day is open'); return true; }
    return false;
  };

  /* ------------------------------------------------------------------ rooms */

  /** Uploads photos one by one (multipart, field "file"). */
  const uploadAll = async (path, files = []) => {
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      await api.upload(path, fd);
    }
  };

  /** `extra` carries the maintenance reason / expected-back date. */
  const setRoomStatus = useCallback((no, status, extra = {}) => {
    const r = roomOf(no);
    if (!r) return false;
    return run(() => api.patch(`/rooms/${r.id}/status`, { status: roomStatusOut(status), ...extra }), `Room ${no} updated`);
  }, [run]);

  /** Edits a room's category, type, floor, prices and features. Running stays keep their own price. */
  const updateRoom = useCallback((no, form) => {
    const r = roomOf(no);
    if (!r) return false;
    const single = Number(form.singleRate) || 0;
    const double = Number(form.doubleRate) || 0;
    if (!single || !double) { toast('Set both the single and double price'); return false; }
    const type = dbRef.current.roomTypes.find((t) => t.name === form.type);
    return run(async () => {
      await api.patch(`/rooms/${r.id}`, {
      floor: Number(form.floor) || r.floor,
      category: form.category === 'AC' ? 'AC' : 'NON_AC',
      roomType: form.type, roomTypeId: type?.id,
      singleRate: dec(single), doubleRate: dec(double), rate: dec(single),
      features: form.features, description: form.description || '', ...roomDetails(form)
      });
      for (const img of form.removeImages || []) await api.del(`/rooms/${r.id}/images/${img.id}`);
      await uploadAll(`/rooms/${r.id}/images`, form.images);
    }, `Room ${no} updated`);
  }, [run, toast]);

  const markAllClean = useCallback(
    () => run(() => api.post('/rooms/mark-all-clean'), 'All rooms marked ready', { close: false }), [run]);

  const addRoom = useCallback((room) => {
    if (!room.no) { toast('Room number is needed'); return false; }
    const single = Number(room.singleRate) || 0;
    const double = Number(room.doubleRate) || 0;
    if (!single || !double) { toast('Set both the single and double price'); return false; }
    const type = dbRef.current.roomTypes.find((t) => t.name === room.type);
    return run(async () => {
      const res = await api.post('/rooms', {
      number: String(room.no), floor: Number(room.floor) || 1,
      category: room.category === 'AC' ? 'AC' : 'NON_AC',
      roomType: room.type, roomTypeId: type?.id,
      singleRate: dec(single), doubleRate: dec(double),
      features: room.features || [], ...roomDetails(room),
      rate: dec(single)                       // legacy field: single-occupancy price
      });
      await uploadAll(`/rooms/${one(res, 'room')?.id}/images`, room.images);
    }, `Room ${room.no} added`);
  }, [run, toast]);

  /* ------------------------------------------------------- check in / out */

  const postPayment = (stayId, kind, amount, mode, narration, extra = {}) =>
    api.patch(`/stays/${stayId}`, {
      ...extra,
      payment: { kind, amount: dec(amount), mode: modeOut(mode), businessDate: businessDate(), time: now(), narration }
    });

  /** Sends one identity document for a customer (multipart). */
  const sendDocument = (customerId, doc) => {
    if (!customerId) throw new Error('Customer was not created');
    const fd = new FormData();
    fd.append('type', DOC_API_TYPE[doc.type] || 'OTHER');
    if (doc.number) fd.append('number', doc.number.trim());
    fd.append('file', doc.file);
    return api.upload(`/customers/${customerId}/documents`, fd);
  };

  /** Finds a customer by phone: the server first, then the loaded list. */
  const lookupCustomer = useCallback(async (phone) => {
    const p = String(phone || '').replace(/\D/g, '').slice(-10);
    if (p.length < 10) return null;
    try {
      const res = await api.get('/customers/lookup', { phone: p });
      const c = one(res, 'customer');
      if (c && c.id) return mapCustomer(c);
    } catch { /* fall back to the loaded list */ }
    return dbRef.current.customers.find((c) => String(c.phone).replace(/\D/g, '').slice(-10) === p) || null;
  }, []);

  const loadCustomer = useCallback(async (id) => {
    try { return mapCustomer(one(await api.get(`/customers/${id}`), 'customer')); } catch { return null; }
  }, []);

  const uploadCustomerDoc = useCallback(async (id, doc) => {
    if (!doc?.file) { toast('Choose a file first'); return false; }
    try {
      await sendDocument(id, doc);
      toast('Document saved');
      reload();
      return true;
    } catch (e) {
      toast(e.message || 'Upload failed');
      return false;
    }
  }, [reload, toast]);

  const checkIn = useCallback(async (form) => {
    if (dayBlocked()) return false;
    const room = roomOf(form.room);
    const name = (form.guest || '').trim();
    if (!room || !name) { toast('Room and guest name are needed'); return false; }
    if (form.docRequired && !form.doc?.file) { toast('Upload the guest ID document'); return false; }
    const nights = Number(form.nights) || 1;
    const amount = Number(form.amount) || 0;
    const clampGuests = (g) => Math.min(4, Math.max(1, Number(g) || 1));
    // One guest, one account: the first room plus any extra rooms booked under the same customer.
    const extras = (form.extraRooms || []).filter((x) => x.room && x.room !== form.room);
    const picked = [{ room, guests: clampGuests(form.guests) }];
    for (const x of extras) {
      const r = roomOf(x.room);
      if (!r) { toast(`Room ${x.room} is not available`); return false; }
      if (picked.some((p) => p.room.no === r.no)) { toast(`Room ${x.room} is picked twice`); return false; }
      picked.push({ room: r, guests: clampGuests(x.guests) });
    }
    const groupKey = picked.length > 1 ? `GRP-${Date.now().toString(36)}` : undefined;
    let warn = '';

    const ok = await run(async () => {
      let customerId = form.customer?.id || undefined;
      for (let i = 0; i < picked.length; i += 1) {
        const { room: rm, guests } = picked[i];
        const res = await api.post('/stays', {
          roomId: rm.id, guestName: name, phone: form.phone,
          customerId,
          groupKey, groupSize: picked.length, isGroupPrimary: i === 0,
          vehicle: form.vehicle && form.vehicle !== '—' ? form.vehicle : undefined,
          checkOut: form.checkOut || addDays(form.date, nights), nights,
          guests, rate: dec(rateFor(rm, guests)), bookingId: null
        });
        const stay = one(res, 'stay');
        customerId = customerId ?? stay?.customerId ?? one(res, 'customer')?.id;
        // The advance is taken once, on the first room of the booking.
        if (i === 0 && amount > 0 && stay?.id) {
          await postPayment(stay.id, 'ADVANCE', amount, form.mode, form.narration || 'Advance at check-in');
        }
        if (i === 0 && form.doc?.file) {
          try { await sendDocument(customerId, form.doc); }
          catch { warn = ' — document upload failed, add it from the customer profile'; }
        }
      }
    }, null);
    if (ok) toast(picked.length > 1 ? `Rooms ${picked.map((p) => p.room.no).join(', ')} checked in${warn}` : `Room ${form.room} checked in${warn}`);
    return ok;
  }, [run, toast]);

  /** Adds one more guest to an occupied room; the server reprices the remaining nights. */
  const addGuest = useCallback(async (no, form) => {
    const room = roomOf(no);
    if (!room?.stayId) return false;
    if (room.guests >= 4) { toast('A room holds at most 4 guests'); return false; }
    const next = room.guests + 1;
    let warn = '';
    const ok = await run(async () => {
      const res = await api.post(`/stays/${room.stayId}/guests`, {
        name: (form.name || '').trim() || undefined, phone: form.phone || undefined,
        guests: next, rate: dec(rateFor(room, next)), businessDate: businessDate(), time: now()
      });
      if (form.doc?.file) {
        try { await sendDocument(one(res, 'guest')?.customerId ?? one(res, 'customer')?.id, form.doc); }
        catch { warn = ' — document upload failed'; }
      }
    }, null);
    if (ok) toast(`Guest added to room ${no}${warn}`);
    return ok;
  }, [run, toast]);

  const checkOut = useCallback((no, form) => {
    if (dayBlocked()) return false;
    const room = roomOf(no);
    if (!room?.stayId) return false;
    // Split payment: one line per mode, e.g. part Cash and part UPI.
    const rows = (form.payments ?? [{ mode: form.mode, amount: form.amount }])
      .map((p) => ({ mode: p.mode, amount: Number(p.amount) || 0 })).filter((p) => p.amount > 0);
    const adjustments = (form.adjustments || []).filter((a) => a.amount > 0);
    return run(async () => {
      // Discount / half day / complimentary reduce the folio before payment is taken.
      if (adjustments.length) {
        await api.patch(`/stays/${room.stayId}`, {
          adjustments: adjustments.map((a) => ({
            kind: a.kind, value: dec(a.value), section: a.section, amount: dec(a.amount),
            reason: a.reason || undefined, businessDate: businessDate(), time: now()
          }))
        });
      }
      for (const p of rows) {
        await postPayment(room.stayId, 'PART_PAYMENT', p.amount, p.mode,
          `${form.narration || 'Final settlement'}${rows.length > 1 ? ` (${p.mode})` : ''}`);
      }
      await api.post(`/stays/${room.stayId}/checkout`, { businessDate: businessDate() });
    }, 'Checked out — sent to housekeeping');
  }, [run]);

  const updateGuestStay = useCallback((no, form) => {
    const room = roomOf(no);
    if (!room?.stayId) return false;
    const kind = PAY_KIND[form.payType];
    const amount = Number(form.payAmount) || 0;
    const body = {
      guests: Math.min(4, Math.max(1, Number(form.guests) || 1)),
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

  /**
   * Internal room shift: the guest moves to another vacant room mid-stay.
   * The server re-prices the remaining nights and records the upgrade/downgrade.
   */
  const shiftRoom = useCallback((no, form) => {
    const from = roomOf(no);
    const to = roomOf(form.toRoom);
    if (!from?.stayId || !to) { toast('Pick the room to shift to'); return false; }
    const guests = Math.min(4, Math.max(1, Number(form.guests) || 1));
    return run(() => api.post(`/stays/${from.stayId}/shift`, {
      toRoomId: to.id, guests, rate: dec(rateFor(to, guests)),
      reason: form.reason || undefined, requestId: form.requestId || undefined,
      businessDate: businessDate(), time: now()
    }), `Shifted to room ${to.no} — folio adjusted`);
  }, [run, toast]);

  /* ------------------------------------------------------------- day book */

  /** Look at another date (read-only unless it is the open day). Pass '' to follow the open day again. */
  const viewDate = useCallback(async (date) => {
    pickedRef.current = !!date;
    if (date) dateRef.current = date;
    await reload();
  }, [reload]);

  const setDate = useCallback(async (date) => {
    closeSheet();
    await viewDate(date);
    toast('Date changed');
  }, [viewDate, closeSheet, toast]);

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
    if (dayBlocked()) return { ok: false };
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

  /** Closes the open business day at any time, recording the counted cash so a shortage is kept. */
  const closeDay = useCallback((form) =>
    run(async () => {
      pickedRef.current = false;
      await api.post('/business-day/close', {
        businessDate: businessDate(), countedCash: dec(form.counted), note: form.note || undefined, time: now()
      });
    }, 'Day closed — start the next day to continue'), [run]);

  /** Starts a business day with its opening balance; it stays open until a manager closes it. */
  const startDay = useCallback((form) => {
    if (!form.date) { toast('Pick the date this day is for'); return false; }
    return run(async () => {
      pickedRef.current = false;
      await api.post('/business-day/start', {
        businessDate: form.date, openingBalance: dec(form.opening), time: now(), note: form.note || undefined
      });
    }, `Day started for ${form.date}`);
  }, [run, toast]);

  /* ---------------------------------------------------------- restaurant */

  const settleBill = useCallback(async (cart, table, mode) => {
    if (dayBlocked()) return false;
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
    if (dayBlocked()) return false;
    const amount = Number(form.amount) || 0;
    if (!amount) { toast('Enter the amount'); return false; }
    const onCredit = form.payment === 'CREDIT';
    if (onCredit && !(form.vendor || '').trim()) { toast('Enter the vendor / party you owe this to'); return false; }
    return run(() => api.post('/expenses', onCredit ? {
      // Udhari: we owe the vendor. Nothing leaves the cash book until it is paid.
      businessDate: businessDate(), time: now(), head: form.head, vendor: form.vendor.trim(),
      amount: dec(amount), narration: form.narration, onCredit: true, dueDate: form.dueDate || undefined
    } : {
      businessDate: businessDate(), time: now(), head: form.head, vendor: form.vendor,
      mode: modeOut(form.mode), amount: dec(amount), narration: form.narration
    }), onCredit ? 'Expense saved on credit (udhari)' : 'Expense recorded');
  }, [run, toast]);

  /** Pays all or part of an expense that was taken on credit; this is when cash goes out. */
  const payExpenseDue = useCallback((id, form) => {
    if (dayBlocked()) return false;
    const amount = Number(form.amount) || 0;
    if (!amount) { toast('Enter the amount you are paying'); return false; }
    return run(() => api.post(`/expenses/${id}/payments`, {
      amount: dec(amount), mode: modeOut(form.mode), businessDate: businessDate(), time: now(), narration: form.narration || undefined
    }), 'Payment recorded', { close: false });
  }, [run, toast]);

  /* ------------------------------------------------- customer credit (udhaar) */

  /** kind: 'CHARGE' = the customer takes credit from us; 'PAYMENT' = the customer pays some of it back. */
  const customerCredit = useCallback((customerId, kind, form) => {
    const amount = Number(form.amount) || 0;
    if (!amount) { toast('Enter the amount'); return false; }
    if (kind === 'PAYMENT' && dayBlocked()) return false;
    return run(() => api.post(`/customers/${customerId}/credit`, {
      kind, amount: dec(amount), narration: form.narration || undefined,
      ...(kind === 'PAYMENT' ? { mode: modeOut(form.mode) } : {}),
      businessDate: businessDate(), time: now()
    }), kind === 'CHARGE' ? 'Credit given — added to the customer\'s due' : 'Payment received', { close: false });
  }, [run, toast]);

  /* ----------------------------------------- master data: menu, stock, staff */

  const addMenuItem = useCallback((form) => {
    const name = (form.name || '').trim();
    const price = Number(form.price) || 0;
    if (!name) { toast('Enter the item name'); return false; }
    if (!price) { toast('Enter the price'); return false; }
    return run(async () => {
      const res = await api.post('/menu', {
        name, description: form.description || '', price: dec(price),
        category: (form.category || '').trim() || 'Main', isVeg: form.veg !== 'non', available: true
      });
      await uploadAll(`/menu/${one(res, 'item')?.id ?? one(res, 'menuItem')?.id ?? res?.id}/photo`, form.image ? [form.image] : []);
    }, `${name} added to the menu`);
  }, [run, toast]);

  const addStock = useCallback((form) => {
    const item = (form.item || '').trim();
    if (!item) { toast('Enter the item name'); return false; }
    return run(() => api.post('/stock', {
      item, category: form.cat || 'General', unit: form.unit || 'pcs',
      qty: dec(form.qty || 0), minQty: dec(form.min || 0), rate: dec(form.rate || 0)
    }), `${item} added to inventory`);
  }, [run, toast]);

  const addStaff = useCallback((form) => {
    const name = (form.name || '').trim();
    if (!name) { toast('Enter the staff name'); return false; }
    return run(() => api.post('/staff', {
      name, role: form.role || 'Staff', shift: form.shift || 'Morning',
      phone: form.phone || undefined, salary: dec(form.salary || 0)
    }), `${name} added to staff`);
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
      setDate, viewDate, setOpening, startDay,
      addRoom, updateRoom, setRoomStatus, markAllClean,
      checkIn, checkOut, shiftRoom, addGuest,
      lookupCustomer, loadCustomer, uploadCustomerDoc,
      addEntry, updateEntry, deleteEntry, closeDay,
      settleBill, sendKot, addOnlineOrder,
      addBooking, adjustStock, setAttendance, addExpense,
      payExpenseDue, customerCredit, addMenuItem, addStock, addStaff,
      updateGuestStay, saveInvoice, updateRequest
    }
  }), [
    fullDb, tab, sheet, toastMsg, openSheet, closeSheet, toast, authed, loading, signIn, signOut, reload,
    setDate, viewDate, setOpening, startDay, addRoom, updateRoom, setRoomStatus, markAllClean, checkIn, checkOut, shiftRoom, addGuest,
    lookupCustomer, loadCustomer, uploadCustomerDoc,
    addEntry, updateEntry, deleteEntry, closeDay, settleBill, sendKot,
    addOnlineOrder, addBooking, adjustStock, setAttendance, addExpense,
    payExpenseDue, customerCredit, addMenuItem, addStock, addStaff,
    updateGuestStay, saveInvoice, updateRequest
  ]);

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel() {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error('useHotel must be used inside <HotelProvider>');
  return ctx;
}
