import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getSession, isAdminSession, login, logout, setAuthLostHandler, uploadImage } from '../api/client';
import {
  buildCash, buildRegister, mapDay, dcOut, dec, emptyDb, list, mapBooking, mapCustomer, mapEntry, mapExpense, mapInvoice, mapMenu,
  mapKot, mapLaundry, mapOnline, mapRequest, mapRoom, mapRoomTypes, mapStaff, mapStock, modeOut, one, roomStatusOut
} from '../api/mappers';
import { normMark } from '../lib/attendance';
import { bookingRoomMatch } from '../lib/availability';
import { bookingState, bookingToday } from '../lib/bookings';
import { addDays, now, today } from '../lib/format';
import { REQUEST_EXTRAS } from '../lib/requests';
import { DOC_API_TYPE } from '../lib/customers';
import { laundryTotals } from '../lib/laundry';
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
  const [att, setAtt] = useState({});             // staffId -> P | A | L for the open business day
  const [attVersion, setAttVersion] = useState(0);  // bumps after every attendance change so calendars refresh
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
    const [entriesR, daybookR, registerR, menuR, onlineR, bookingsR, stockR, staffR, expensesR, invoicesR, customersR, payablesR, kotsR, laundryR, attendR] = await Promise.all([
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
      guard(api.get('/customers', { limit: 200 })),
      guard(api.get('/expenses', { status: 'DUE' })),
      guard(api.get('/kots')),
      guard(api.get('/laundry/orders')),
      guard(api.get('/attendance', { date: day?.status === 'OPEN' && day.businessDate ? day.businessDate : date }))
    ]);
    if (attendR.ok) {
      setAtt(Object.fromEntries(list(attendR.v)
        .map((r) => [String(r.staffId ?? r.staff?.id), normMark(r.mark ?? r.status)]).filter(([, m]) => m)));
    }

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
      // Prebooking: a room held by a live booking. Its status shows "prebooked" only on the arrival day.
      if (next.rooms.length) {
        const todayStr = bookingToday(next);
        next.rooms = next.rooms.map((r) => {
          const pb = next.bookings
            .filter((b) => bookingRoomMatch(b, r) && ['Arriving', 'Confirmed'].includes(bookingState(b, todayStr)))
            .sort((a, b) => String(a.inD).localeCompare(String(b.inD)))[0];
          const prebook = pb ? { id: pb.id, guest: pb.guest, phone: pb.phone, pax: pb.pax, inD: pb.inD, outD: pb.outD, today: pb.inD === todayStr } : null;
          let status = r.status === 'prebooked' ? 'vacant' : r.status;
          if (status === 'vacant' && prebook?.today) status = 'prebooked';
          return { ...r, status, prebook };
        });
      }
      if (stockR.ok) next.stock = list(stockR.v).map(mapStock);
      if (staffR.ok) next.staff = list(staffR.v).map(mapStaff);
      if (customersR.ok) next.customers = list(customersR.v).map(mapCustomer);
      if (payablesR.ok) next.payables = list(payablesR.v).map(mapExpense).filter((x) => x.due > 0);
      if (invoicesR.ok) next.invoices = list(invoicesR.v).map(mapInvoice);
      if (kotsR.ok) {
        const byStay = Object.fromEntries(next.rooms.filter((r) => r.stayId).map((r) => [r.stayId, r]));
        next.kots = list(kotsR.v).map((k) => mapKot(k, byStay));
      }
      if (laundryR.ok) {
        const byStay = Object.fromEntries(next.rooms.filter((r) => r.stayId).map((r) => [r.stayId, r]));
        next.laundry = list(laundryR.v).map((o) => mapLaundry(o, byStay));
      }
      return next;
    });
    loadRequests();
    if (!roomsR.ok) toast('Could not load rooms — check the server');
  }, [toast, loadRequests]);

  const signOut = useCallback(() => {
    logout();
    setIsAdmin(false);
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

  const [isAdmin, setIsAdmin] = useState(() => isAdminSession());

  const signIn = useCallback(async (identifier, password) => {
    await login(identifier, password);
    pickedRef.current = false;                  // start on the open business day
    setIsAdmin(isAdminSession());
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

  /** Uploads photos to the media store and returns their URLs. */
  const uploadUrls = (files = []) => Promise.all(files.map((f) => uploadImage(f)));

  /** Uploads photos to the media store, then registers each URL on the record (JSON, no multipart). */
  const uploadAll = async (path, files = []) => {
    for (const url of await uploadUrls(files)) await api.post(path, { url });
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

  /** Admin only. The server refuses rooms that are occupied or have history. */
  const deleteRoom = useCallback((no) => {
    if (!isAdmin) { toast('Only an admin can delete a room'); return false; }
    const r = roomOf(no);
    if (!r) return false;
    return run(() => api.del(`/rooms/${r.id}`), `Room ${no} deleted`);
  }, [run, toast, isAdmin]);

  const markAllClean = useCallback(
    () => run(() => api.post('/rooms/mark-all-clean'), 'All rooms marked ready', { close: false }), [run]);

  const addRoom = useCallback((room) => {
    if (!room.no) { toast('Room number is needed'); return false; }
    const single = Number(room.singleRate) || 0;
    const double = Number(room.doubleRate) || 0;
    if (!single || !double) { toast('Set both the single and double price'); return false; }
    const type = dbRef.current.roomTypes.find((t) => t.name === room.type);
    return run(async () => {
      const images = await uploadUrls(room.images);
      await api.post('/rooms', {
      images,
      number: String(room.no), floor: Number(room.floor) || 1,
      category: room.category === 'AC' ? 'AC' : 'NON_AC',
      roomType: room.type, roomTypeId: type?.id,
      singleRate: dec(single), doubleRate: dec(double),
      features: room.features || [], ...roomDetails(room),
      rate: dec(single)                       // legacy field: single-occupancy price
      });
    }, `Room ${room.no} added`);
  }, [run, toast]);

  /* ------------------------------------------------------- check in / out */

  const postPayment = (stayId, kind, amount, mode, narration, extra = {}) =>
    api.patch(`/stays/${stayId}`, {
      ...extra,
      payment: { kind, amount: dec(amount), mode: modeOut(mode), businessDate: businessDate(), time: now(), narration }
    });

  /** Sends one identity document for a customer (multipart). */
  const sendDocument = async (customerId, doc) => {
    const fileUrl = await uploadImage(doc.file);   // upload first, so the file is stored even if the customer id is missing
    if (!customerId) throw new Error('Customer id missing from the check-in response');
    return api.post(`/customers/${customerId}/documents`, {
      type: DOC_API_TYPE[doc.type] || 'OTHER',
      number: doc.number ? doc.number.trim() : undefined,
      fileUrl, fileName: doc.file.name
    });
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
          guests, rate: dec(rateFor(rm, guests)), bookingId: i === 0 ? (form.bookingId ?? null) : null
        });
        const stay = one(res, 'stay');
        customerId = customerId ?? stay?.customerId ?? stay?.customer?.id ?? one(res, 'customer')?.id ?? res?.customerId;
        // The advance is taken once, on the first room of the booking.
        if (i === 0 && amount > 0 && stay?.id) {
          await postPayment(stay.id, 'ADVANCE', amount, form.mode, form.narration || 'Advance at check-in');
        }
        if (i === 0 && form.doc?.file) {
          try { await sendDocument(customerId, form.doc); }
          catch (e) { console.error('Document upload failed', e); warn = ` — document upload failed (${e.message}), add it from the customer profile`; }
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

  /** Charges extra nights past the booked check-out date and extends the stay to cover them. */
  const addExtraNights = useCallback((no, nights, reason) => {
    if (dayBlocked()) return false;
    const room = roomOf(no);
    const n = Math.max(1, Math.round(Number(nights) || 0));
    if (!room?.stayId) return false;
    return run(() => api.post(`/stays/${room.stayId}/extra-nights`, {
      nights: n, rate: dec(room.stayRate), businessDate: businessDate(), time: now(),
      reason: reason || 'Stayed past check-out date'
    }), `${n} extra night${n > 1 ? 's' : ''} added to the folio`, { close: false });
  }, [run, toast]);

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

  /** Admin only. Removes a stay made by mistake; the server voids its entries and frees the room. */
  const deleteStay = useCallback((no) => {
    if (!isAdmin) { toast('Only an admin can delete a stay'); return false; }
    const room = roomOf(no);
    if (!room?.stayId) return false;
    return run(() => api.del(`/stays/${room.stayId}`), `Stay in room ${no} deleted`);
  }, [run, toast, isAdmin]);

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
    if (!isAdmin) date = '';                    // managers only ever see the open day
    pickedRef.current = !!date;
    if (date) dateRef.current = date;
    await reload();
  }, [reload, isAdmin]);

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
      await api.post('/kots', {
        stayId: r.stayId, tableLabel: null, billTo: 'ROOM', waiterId, note: '',
        items: items.map((c) => ({ menuItemId: c.id, qty: c.q, note: '' }))
      });
    }, 'Slip printed, charge added to folio');
  }, [run, toast]);

  /** Preparing -> Ready -> Served, or Cancelled. */
  const updateKotStatus = useCallback((id, status) =>
    run(() => api.patch(`/kots/${id}`, { status: String(status).toUpperCase().replace(/ /g, '_') }),
      status === 'Cancelled' ? 'Order cancelled' : `Order marked ${status.toLowerCase()}`, { close: false }), [run]);

  /* ----------------------------------------------------------------- laundry */

  const addLaundryOrder = useCallback((form) => {
    const items = (form.lines || [])
      .map((l) => ({ name: l.item, service: l.service, qty: Number(l.q) || 0, price: dec(l.p) }))
      .filter((l) => l.qty > 0);
    if (!items.length) { toast('Add at least one piece of clothing'); return false; }
    const isRoom = form.source === 'ROOM';
    const room = isRoom ? roomOf(form.room) : null;
    if (isRoom && !room?.stayId) { toast('That room has no active stay'); return false; }
    if (!isRoom && !(form.guest || '').trim()) { toast('Enter the guest name'); return false; }
    const { total } = laundryTotals(form.lines, form.express);
    if (!total) { toast('Enter the rate for the clothes'); return false; }
    return run(async () => {
      await api.post('/laundry/orders', {
        source: form.requestId ? 'ROOM_REQUEST' : isRoom ? 'STAFF' : 'WALK_IN', requestId: form.requestId || undefined,
        stayId: room?.stayId ?? null, roomId: room?.id ?? null,
        guestName: isRoom ? room.guest : form.guest.trim(), phone: isRoom ? room.phone : form.phone,
        express: !!form.express, expectedDate: form.expected || undefined,
        billTo: form.billTo, mode: form.billTo === 'PAY_NOW' ? modeOut(form.mode) : undefined,
        items, amount: dec(total), note: form.note || undefined, businessDate: businessDate(), time: now()
      });
      if (form.requestId) {
        try { await api.patch(`/service-requests/${form.requestId}`, { status: 'IN_PROGRESS' }); } catch { /* the server may do this itself */ }
      }
    }, 'Laundry order created');
  }, [run, toast]);

  /** Requested -> Picked up -> In process -> Ready -> Delivered, or Cancelled. Delivery posts the charge. */
  const updateLaundryStatus = useCallback(async (id, status) => {
    const o = dbRef.current.laundry.find((x) => x.id === id);
    if (status === 'Delivered' && o?.billTo === 'PAY_NOW' && dayBlocked()) return false;
    const ok = await run(() => api.patch(`/laundry/orders/${id}`, {
      status: String(status).toUpperCase().replace(/ /g, '_'),
      ...(status === 'Delivered' ? { businessDate: businessDate(), time: now() } : {})
    }), status === 'Cancelled' ? 'Laundry order cancelled' : `Order marked ${status.toLowerCase()}`, { close: false });
    const reqStatus = status === 'Delivered' ? 'DONE' : status === 'Picked up' ? 'IN_PROGRESS' : null;
    if (ok && o?.requestId && reqStatus) {
      try { await api.patch(`/service-requests/${o.requestId}`, { status: reqStatus }); await loadRequests(); } catch { /* server may sync it */ }
    }
    return ok;
  }, [run, loadRequests]);

  const addOnlineOrder = useCallback((form) => {
    const amount = Number(form.amount) || 0;
    if (!amount) { toast('Enter the order value'); return false; }
    return run(() => api.post('/online-orders', {
      businessDate: businessDate(), platform: form.plat, orderId: form.oid || `ORD-${Date.now().toString().slice(-6)}`,
      items: [{ name: form.items || 'Order', qty: 1, price: dec(amount) }],
      amount: dec(amount)
    }), 'Order added');
  }, [run, toast]);

  /** Moves an online order along: PREPARING -> PICKED_UP -> DELIVERED, or CANCELLED. */
  const updateOnlineStatus = useCallback((id, status) =>
    run(() => api.patch(`/online-orders/${id}`, { status: String(status).toUpperCase().replace(/ /g, '_') }),
      status === 'Cancelled' ? 'Order cancelled' : `Order marked ${status.toLowerCase()}`, { close: false }), [run]);

  /* ---------------------------------------------------------- back office */

  const addBooking = useCallback((form) => {
    const guest = (form.guest || '').trim();
    if (!guest) { toast('Guest name is needed'); return false; }
    const type = dbRef.current.roomTypes.find((t) => t.name === form.type);
    if (!type) { toast('Pick a room type'); return false; }
    const room = roomOf(form.roomNo);
    if (!room) { toast('Select a room for this booking'); return false; }
    return run(() => api.post('/bookings', {
      source: form.src, ref: form.ref || `REF${Date.now().toString().slice(-7)}`,
      guestName: guest, phone: form.phone, roomTypeId: type.id, roomId: room.id,
      rooms: 1, pax: Number(form.pax) || 2,
      arrivalDate: form.inD, departureDate: addDays(form.inD, Number(form.nights) || 1),
      amount: dec(form.amount), payment: form.pay, note: ''
    }), 'Booking added');
  }, [run, toast]);

  const updateBooking = useCallback((id, form) => {
    const guest = (form.guest || '').trim();
    if (!guest) { toast('Guest name is needed'); return false; }
    const type = dbRef.current.roomTypes.find((t) => t.name === form.type);
    const room = roomOf(form.roomNo);
    if (!room && form.status !== 'Cancelled') { toast('Select a room for this booking'); return false; }
    return run(() => api.patch(`/bookings/${id}`, {
      source: form.src, ref: form.ref, guestName: guest, phone: form.phone,
      ...(type ? { roomTypeId: type.id } : {}), roomId: room?.id ?? null,
      rooms: 1, pax: Number(form.pax) || 2,
      arrivalDate: form.inD,
      departureDate: addDays(form.inD, Number(form.nights) || 1),
      amount: dec(form.amount), payment: form.pay,
      status: String(form.status || '').toUpperCase().replace(/ /g, '_')
    }), 'Booking updated');
  }, [run, toast]);

  const deleteBooking = useCallback((id) => run(() => api.del(`/bookings/${id}`), 'Booking deleted'), [run]);

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

  /** Attendance rows for a date range (and optionally one person): [{ staffId, date, mark }]. */
  const fetchAttendance = useCallback(async (from, to, staffId) => {
    const res = await api.get('/attendance', { from, to, staffId });
    return list(res)
      .map((r) => ({
        staffId: String(r.staffId ?? r.staff?.id), date: String(r.businessDate ?? r.date ?? '').slice(0, 10), mark: normMark(r.mark ?? r.status)
      }))
      .filter((r) => r.mark && r.date);
  }, []);

  /** Marks one person for one date (default: the open day). Managers are limited to the open day. */
  const setAttendance = useCallback(async (staffId, mark, date) => {
    const day = businessDate();
    const when = date || day;
    if (!isAdmin && when !== day) { toast('Managers can only mark the current open day'); return false; }
    if (when > day) { toast('You cannot mark attendance for a future date'); return false; }
    const prev = att[staffId];
    if (when === day) setAtt((a) => ({ ...a, [staffId]: mark }));
    try {
      await api.put('/attendance', { staffId, businessDate: when, mark });
      setAttVersion((v) => v + 1);
      return true;
    } catch (e) {
      if (when === day) setAtt((a) => ({ ...a, [staffId]: prev }));
      toast(e.message);
      return false;
    }
  }, [att, toast, isAdmin]);

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
    if (form.head === 'Salary advance' && !form.staffId) { toast('Select the staff member'); return false; }
    const staffId = form.head === 'Salary advance' ? form.staffId : undefined;
    return run(() => api.post('/expenses', onCredit ? {
      // Udhari: we owe the vendor. Nothing leaves the cash book until it is paid.
      businessDate: businessDate(), time: now(), head: form.head, vendor: form.vendor.trim(),
      amount: dec(amount), narration: form.narration, onCredit: true, dueDate: form.dueDate || undefined
    } : {
      businessDate: businessDate(), time: now(), head: form.head, vendor: form.vendor, staffId,
      mode: modeOut(form.mode), amount: dec(amount), narration: form.narration
    }), onCredit ? 'Expense saved on credit (udhari)' : 'Expense recorded');
  }, [run, toast]);

  /** Admin only. The server re-posts the day book line and refuses edits on a closed day. */
  const updateExpense = useCallback((id, form) => {
    if (!isAdmin) { toast('Only an admin can edit an expense'); return false; }
    const amount = Number(form.amount) || 0;
    if (!amount) { toast('Enter the amount'); return false; }
    if (form.head === 'Salary advance' && !form.staffId) { toast('Select the staff member'); return false; }
    const credit = form.payment === 'CREDIT';
    return run(() => api.patch(`/expenses/${id}`, {
      head: form.head, vendor: (form.vendor || '').trim(), amount: dec(amount), narration: form.narration,
      staffId: form.head === 'Salary advance' ? form.staffId : null,
      ...(credit ? { dueDate: form.dueDate || null } : { mode: modeOut(form.mode) })
    }), 'Expense updated', { close: false });
  }, [run, toast, isAdmin]);

  const deleteExpense = useCallback((id) => {
    if (!isAdmin) { toast('Only an admin can delete an expense'); return false; }
    return run(() => api.del(`/expenses/${id}`), 'Expense deleted', { close: false });
  }, [run, toast, isAdmin]);

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
      const photoUrl = form.image ? await uploadImage(form.image) : undefined;
      await api.post('/menu', {
        name, description: form.description || '', price: dec(price),
        category: (form.category || '').trim() || 'Main', isVeg: form.veg !== 'non', available: true,
        photoUrl
      });
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

  const updateStock = useCallback((id, form) => {
    const item = (form.item || '').trim();
    if (!item) { toast('Enter the item name'); return false; }
    return run(() => api.patch(`/stock/${id}`, {
      item, category: form.cat || 'General', unit: form.unit || 'pcs',
      qty: dec(form.qty || 0), minQty: dec(form.min || 0), rate: dec(form.rate || 0)
    }), `${item} updated`);
  }, [run, toast]);

  const deleteStock = useCallback((id) =>
    run(() => api.del(`/stock/${id}`), 'Inventory item deleted', { close: false }), [run]);

  const updateStaff = useCallback((id, form) => {
    const name = (form.name || '').trim();
    if (!name) { toast('Enter the staff name'); return false; }
    return run(() => api.patch(`/staff/${id}`, {
      name, role: form.role || 'Staff', shift: form.shift || 'Morning',
      phone: form.phone || null, salary: dec(form.salary || 0)
    }), `${name} updated`);
  }, [run, toast]);

  const deleteStaff = useCallback((id) => {
    if (!isAdmin) { toast('Only an admin can delete a staff member'); return false; }
    return run(() => api.del(`/staff/${id}`), 'Staff member deleted', { close: false });
  }, [run, toast, isAdmin]);

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

  const fullDb = useMemo(() => ({ ...db, att }), [db, att]);

  const value = useMemo(() => ({
    db: fullDb, tab, setTab, sheet, openSheet, closeSheet, toastMsg, toast,
    authed, loading, signIn, signOut, reload, isAdmin, attVersion,
    actions: {
      setDate, viewDate, setOpening, startDay,
      addRoom, updateRoom, deleteRoom, setRoomStatus, markAllClean,
      checkIn, checkOut, shiftRoom, addGuest,
      lookupCustomer, loadCustomer, uploadCustomerDoc,
      addEntry, updateEntry, deleteEntry, closeDay,
      settleBill, sendKot, updateKotStatus, addLaundryOrder, updateLaundryStatus, addOnlineOrder, updateOnlineStatus,
      addBooking, updateBooking, deleteBooking, adjustStock, setAttendance, addExpense, addExtraNights,
      payExpenseDue, updateExpense, deleteExpense, customerCredit, addMenuItem, addStock, updateStock, deleteStock, addStaff, updateStaff, deleteStaff, fetchAttendance,
      updateGuestStay, deleteStay, saveInvoice, updateRequest
    }
  }), [
    fullDb, tab, sheet, toastMsg, openSheet, closeSheet, toast, authed, loading, signIn, signOut, reload, isAdmin, attVersion,
    setDate, viewDate, setOpening, startDay, addRoom, updateRoom, deleteRoom, setRoomStatus, markAllClean, checkIn, checkOut, shiftRoom, addGuest,
    lookupCustomer, loadCustomer, uploadCustomerDoc,
    addEntry, updateEntry, deleteEntry, closeDay, settleBill, sendKot, updateKotStatus, addLaundryOrder, updateLaundryStatus,
    addOnlineOrder, updateOnlineStatus, addBooking, updateBooking, deleteBooking, adjustStock, setAttendance, addExpense, addExtraNights,
    payExpenseDue, updateExpense, deleteExpense, customerCredit, addMenuItem, addStock, updateStock, deleteStock, addStaff, updateStaff, deleteStaff, fetchAttendance,
    updateGuestStay, deleteStay, saveInvoice, updateRequest
  ]);

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel() {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error('useHotel must be used inside <HotelProvider>');
  return ctx;
}
