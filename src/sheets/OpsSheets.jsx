import { useEffect, useMemo, useRef, useState } from 'react';
import DateBar from '../components/DateBar';
import ImagePicker from '../components/ImagePicker';
import { addDays, fmtDate } from '../lib/format';
import { ROOM_TYPES, rateFor } from '../lib/rooms';
import Field, { Row2 } from '../components/Field';
import { Kpi, KpiGrid } from '../components/Kpi';
import ListRow from '../components/ListRow';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import Stepper from '../components/Stepper';
import { money } from '../lib/format';
import { availableRooms } from '../lib/availability';
import { bookingState, bookingToday } from '../lib/bookings';
import { GST, roomGstRate } from '../lib/billing';
import { printFoodInvoice, printRoomInvoice, printSalarySlip, printSlip } from '../lib/print';
import { lowStock, PAYMENT_MODES } from '../lib/selectors';
import { STOCK_CATEGORIES, unitOptions } from '../lib/stock';
import { useHotel } from '../store/HotelContext';

/* -------------------------------------------------------- room-service KOT */

export function KotSheet() {
  const { db, actions } = useHotel();
  const occupied = db.rooms.filter((r) => r.status === 'occupied');
  const [room, setRoom] = useState(occupied[0]?.no || '');
  const [waiter, setWaiter] = useState(db.staff.find((s) => s.role === 'Waiter')?.name || '');
  const [items, setItems] = useState([]);

  const add = (m) =>
    setItems((prev) => {
      const found = prev.find((i) => i.n === m.n);
      return found
        ? prev.map((i) => (i.n === m.n ? { ...i, q: i.q + 1 } : i))
        : [...prev, { id: m.id, n: m.n, p: m.p, q: 1 }];
    });

  const bump = (n, delta) =>
    setItems((prev) => prev.map((i) => (i.n === n ? { ...i, q: i.q + delta } : i)).filter((i) => i.q > 0));

  const total = items.reduce((s, i) => s + i.p * i.q, 0);

  const send = () => {
    if (!room || !items.length) return;
    printSlip({ title: 'ROOM SERVICE SLIP', who: `Room ${room}`, items, note: `Waiter: ${waiter}` });
    actions.sendKot(room, items, waiter);
  };

  return (
    <Sheet
      title="Room service slip"
      footer={
        <button className="btn p" onClick={send}>
          Print slip &amp; charge to room {total ? `· ${money(total)}` : ''}
        </button>
      }
    >
      <Row2>
        <Field as="select" label="Room" value={room} onChange={(e) => setRoom(e.target.value)}>
          {occupied.length
            ? occupied.map((r) => <option key={r.no} value={r.no}>{r.no} · {r.guest}</option>)
            : <option value="">No occupied room</option>}
        </Field>
        <Field as="select" label="Waiter" value={waiter} onChange={(e) => setWaiter(e.target.value)}>
          {db.staff.map((s) => <option key={s.id}>{s.name}</option>)}
        </Field>
      </Row2>

      <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>Add items</label>
      <div className="chips" style={{ marginTop: 6 }}>
        {db.menu.map((m) => (
          <button key={m.n} onClick={() => add(m)}>{m.n}</button>
        ))}
      </div>

      {items.map((i) => (
        <div key={i.n} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
          <div style={{ flex: 1 }}>
            <b style={{ color: 'var(--ink)', fontSize: 13.5 }}>{i.n}</b>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{money(i.p)} each</div>
          </div>
          <Stepper value={i.q} onDecrease={() => bump(i.n, -1)} onIncrease={() => bump(i.n, 1)} />
          <span className="num" style={{ width: 62, textAlign: 'right', color: 'var(--ink)' }}>
            {money(i.p * i.q)}
          </span>
        </div>
      ))}
    </Sheet>
  );
}

/* ------------------------------------------------------------ online order */

export function OnlineOrderSheet() {
  const { actions } = useHotel();
  const [form, setForm] = useState({ plat: 'Zomato', oid: '', items: '', amount: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Sheet
      title="Add online order"
      footer={<button className="btn p" onClick={() => actions.addOnlineOrder(form)}>Add order</button>}
    >
      <Row2>
        <Field as="select" label="Platform" value={form.plat} onChange={set('plat')}>
          {['Zomato', 'Swiggy', 'Magicpin', 'Direct call'].map((p) => <option key={p}>{p}</option>)}
        </Field>
        <Field label="Order id" placeholder="ZOM-00000" value={form.oid} onChange={set('oid')} />
      </Row2>
      <Field label="Items" placeholder="2× Veg Thali, 4 Roti" value={form.items} onChange={set('items')} />
      <Field label="Order value (₹)" type="number" placeholder="Bill amount" value={form.amount} onChange={set('amount')} />
      <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>
        The order value is posted to the day book under bank receipts once the order is added.
      </p>
    </Sheet>
  );
}

/* --------------------------------------------------------------- bookings */

const BOOKING_TONE = { Arriving: 'o', Confirmed: 'b', Cancelled: 'r', 'Checked in': 'g', 'No show': 'n' };
const BOOKING_STATUS = ['Arriving', 'Confirmed', 'Checked in', 'Cancelled'];

export function BookingsSheet() {
  const { db, openSheet, actions } = useHotel();
  const [view, setView] = useState('all');
  const todayStr = bookingToday(db);

  // Guests who are already checked in do not belong here: only today, upcoming, missed and cancelled bookings.
  const all = db.bookings
    .map((b) => ({ ...b, state: bookingState(b, todayStr) }))
    .filter((b) => b.state !== 'Checked in')
    .sort((a, b) => (a.state === 'Cancelled') - (b.state === 'Cancelled') || String(a.inD).localeCompare(String(b.inD)));
  const isToday = (b) => b.state !== 'Cancelled' && b.state !== 'No show' && b.inD === todayStr;
  const isLater = (b) => b.state !== 'Cancelled' && b.state !== 'No show' && b.inD > todayStr;
  const counts = {
    all: all.length, today: all.filter(isToday).length, upcoming: all.filter(isLater).length,
    noshow: all.filter((b) => b.state === 'No show').length, cancelled: all.filter((b) => b.state === 'Cancelled').length
  };
  const shown = all.filter((b) => ({
    all: true, today: isToday(b), upcoming: isLater(b), noshow: b.state === 'No show', cancelled: b.state === 'Cancelled'
  }[view]));

  const remove = (b) => {
    if (window.confirm(`Delete the booking for ${b.guest} (${b.ref})? This cannot be undone.`)) actions.deleteBooking(b.id);
  };
  return (
    <Sheet
      title="Bookings from OTA"
      footer={<button className="btn p" onClick={() => openSheet('booking')}>+ Add a booking</button>}
    >
      <div className="chips">
        {[['all', 'All'], ['today', 'Arriving today'], ['upcoming', 'Upcoming'], ['noshow', 'No show'], ['cancelled', 'Cancelled']].map(([k, l]) => (
          <button key={k} type="button" className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l} {counts[k]}</button>
        ))}
      </div>
      <div className="rpt-wrap bk-table">
        <table className="rpt">
          <thead>
            <tr>
              <th>Guest</th><th>Room</th><th>Arrival</th><th className="rt">Amount</th><th>Status</th><th className="rt">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.length ? shown.map((b) => (
              <tr key={b.id} className={b.state === 'No show' ? 'dim' : ''}>
                <td className="guest" onClick={() => openSheet('bookingView', { id: b.id })}>
                  <b>{b.guest}</b>
                  <span>{b.src} · {b.ref} · {b.rooms}× {b.type}{b.phone ? ` · ${b.phone}` : ''}</span>
                </td>
                <td>{b.roomNo || db.rooms.find((r) => r.id === b.roomId)?.no || '—'}</td>
                <td>{b.inD ? fmtDate(b.inD) : '—'}</td>
                <td className="rt num amt">{money(b.amount)}</td>
                <td><Pill tone={BOOKING_TONE[b.state] || 'n'}>{b.state}</Pill></td>
                <td className="rt acts">
                  <button className="btn sm" onClick={() => openSheet('bookingView', { id: b.id })}>View</button>
                  <button className="btn sm" onClick={() => openSheet('bookingEdit', { id: b.id })}>Edit</button>
                  <button className="btn sm del" onClick={() => remove(b)}>Delete</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="empty">No bookings in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}

export function BookingViewSheet({ id }) {
  const { db, openSheet } = useHotel();
  const b = db.bookings.find((x) => x.id === id);
  if (!b) return null;
  const tone = BOOKING_TONE;
  const rows = [
    ['Guest name', b.guest],
    ['Mobile', b.phone ? <a href={`tel:${b.phone}`}>{b.phone}</a> : '—'],
    ['Source', b.src],
    ['Reference', b.ref],
    ['Room type', `${b.type} × ${b.rooms}`],
    ['Guests', b.pax],
    ['Arrival', b.inD || '—'],
    ['Departure', b.outD || '—'],
    ['Amount', money(b.amount)],
    ['Payment', b.pay || 'Not opted']
  ];
  return (
    <Sheet title="Booking details" footer={<button className="btn p" onClick={() => openSheet('bookingEdit', { id })}>Edit booking</button>}>
      <div style={{ marginBottom: 10 }}>{(() => { const st = bookingState(b, bookingToday(db)); return <Pill tone={tone[st] || 'n'}>{st}</Pill>; })()}</div>
      <table>
        <tbody>
          {rows.map(([k, v]) => <tr key={k}><td>{k}</td><td className="rt">{v}</td></tr>)}
        </tbody>
      </table>
      {b.note && (
        <div style={{ background: 'var(--bg)', borderRadius: 11, padding: '11px 12px', marginTop: 12, fontSize: 13 }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 3 }}>Note</div>
          {b.note}
        </div>
      )}
    </Sheet>
  );
}

const nightsOf = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) || 1);

/**
 * Add / edit a booking. Choosing the dates, room type and guests lists the rooms that are really free
 * for those dates (including rooms whose guest checks out by then); the price follows the chosen room.
 */
function BookingForm({ title, initial, submitLabel, onSubmit, withStatus, ignoreId }) {
  const { db } = useHotel();
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const types = useMemo(() => {
    const t = [...new Set(db.rooms.map((r) => r.type))];
    return [...new Set([...(t.length ? t : ROOM_TYPES), form.type].filter(Boolean))];
  }, [db.rooms, form.type]);

  const nights = Math.max(1, Number(form.nights) || 1);
  const guests = Math.max(1, Number(form.pax) || 1);
  const outD = addDays(form.inD, nights);
  const rooms = useMemo(
    () => availableRooms({ db, type: form.type, guests, from: form.inD, to: outD, ignoreId }),
    [db, form.type, guests, form.inD, outD, ignoreId]
  );
  const picked = db.rooms.find((r) => r.no === form.roomNo);

  // A room that is no longer free for the new dates / type / guests is dropped from the selection.
  useEffect(() => {
    if (form.roomNo && !rooms.some((r) => r.no === form.roomNo)) setForm((f) => ({ ...f, roomNo: '' }));
  }, [rooms]); // eslint-disable-line react-hooks/exhaustive-deps

  // The amount follows room, guests and nights (it stays editable afterwards).
  const key = `${form.roomNo}|${guests}|${nights}`;
  const lastKey = useRef(`${initial.roomNo}|${Math.max(1, Number(initial.pax) || 1)}|${Math.max(1, Number(initial.nights) || 1)}`);
  useEffect(() => {
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (picked) setForm((f) => ({ ...f, amount: String(rateFor(picked, guests) * nights) }));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet
      title={title}
      footer={<button className="btn p" onClick={() => onSubmit({ ...form, nights: String(nights), outD })}>{submitLabel}</button>}
    >
      <Row2>
        <Field as="select" label="Source" value={form.src} onChange={set('src')}>
          {[...new Set(['MakeMyTrip', 'Booking.com', 'Goibibo', 'Agoda', 'Airbnb', 'Walk-in', 'Phone', form.src])].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Field>
        <Field label="Reference" value={form.ref} onChange={set('ref')} />
      </Row2>
      <Field label="Guest name" value={form.guest} onChange={set('guest')} />
      <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} />

      <Row2>
        <Field label="Arrival date" type="date" value={form.inD} onChange={set('inD')} />
        <Field label="Nights" type="number" value={form.nights} onChange={set('nights')} />
      </Row2>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-4px 0 10px' }}>Departure: <b>{fmtDate(outD)}</b></p>
      <Row2>
        <Field as="select" label="Room type" value={form.type} onChange={set('type')}>
          {types.map((t) => <option key={t}>{t}</option>)}
        </Field>
        <Field label="Guests" type="number" value={form.pax} onChange={set('pax')} />
      </Row2>

      <div style={{ fontSize: 12.5, color: 'var(--muted)', margin: '2px 0 6px' }}>
        Available rooms · {fmtDate(form.inD)} → {fmtDate(outD)} · {rooms.length} free
      </div>
      {rooms.length ? (
        <div className="room-pick">
          {rooms.map((r) => (
            <button key={r.no} type="button" className={form.roomNo === r.no ? 'on' : ''}
              onClick={() => setForm((f) => ({ ...f, roomNo: r.no, amount: String(rateFor(r, guests) * nights) }))}>
              <b>Room {r.no}</b>
              <span>Floor {r.floor} · {money(rateFor(r, guests))} / night</span>
              {r.stayId && <em>Free after check-out {fmtDate(r.checkOut)}</em>}
            </button>
          ))}
        </div>
      ) : (
        <div className="bk-alert" style={{ marginBottom: 10 }}>
          No {form.type || 'room'} is free for {guests} guest{guests === 1 ? '' : 's'} on these dates. Try another date, room type or fewer guests.
        </div>
      )}

      <Row2>
        <Field label={picked ? `Amount (${money(rateFor(picked, guests))} × ${nights} night${nights === 1 ? '' : 's'})` : 'Amount'}
          type="number" value={form.amount} onChange={set('amount')} />
        <Field as="select" label="Payment" value={form.pay} onChange={set('pay')}>
          {[...new Set(['Prepaid', 'Pay at hotel', form.pay].filter(Boolean))].map((p) => <option key={p}>{p}</option>)}
        </Field>
      </Row2>
      {withStatus && (
        <Field as="select" label="Status" value={form.status} onChange={set('status')}>
          {BOOKING_STATUS.map((x) => <option key={x}>{x}</option>)}
        </Field>
      )}
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '4px 0 12px' }}>
        Saving holds the room for this booking (prebooked). On the arrival day the room shows as Prebooked.
      </p>
    </Sheet>
  );
}

export function AddBookingSheet() {
  const { db, actions } = useHotel();
  const type = db.rooms[0]?.type || ROOM_TYPES[0];
  return (
    <BookingForm
      title="Add a booking" submitLabel="Save booking" onSubmit={actions.addBooking}
      initial={{ src: 'MakeMyTrip', ref: '', guest: '', phone: '', type, pax: '2', inD: bookingToday(db), nights: '1', roomNo: '', amount: '', pay: 'Prepaid' }}
    />
  );
}

export function EditBookingSheet({ id }) {
  const { db, actions } = useHotel();
  const b = db.bookings.find((x) => x.id === id);
  if (!b) return null;
  const roomNo = b.roomNo || db.rooms.find((r) => r.id === b.roomId)?.no || '';
  return (
    <BookingForm
      withStatus ignoreId={id} title={`Edit booking — ${b.ref}`} submitLabel="Save changes"
      onSubmit={(form) => actions.updateBooking(id, form)}
      initial={{
        src: b.src, ref: b.ref, guest: b.guest, phone: b.phone, type: b.type, pax: String(b.pax),
        inD: b.inD, nights: String(b.outD && b.inD ? nightsOf(b.inD, b.outD) : 1), roomNo,
        amount: String(b.amount), pay: b.pay, status: b.status
      }}
    />
  );
}

/* -------------------------------------------------------------- inventory */

export function InventorySheet() {
  const { db, actions, openSheet } = useHotel();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  const value = db.stock.reduce((s, i) => s + i.qty * i.rate, 0);
  const low = lowStock(db);
  const cats = [...new Set(db.stock.map((s) => s.cat).filter(Boolean))];
  const term = q.trim().toLowerCase();
  const shown = db.stock
    .filter((s) => !term || s.item.toLowerCase().includes(term))
    .filter((s) => filter === 'all' || (filter === 'low' ? s.qty < s.min : s.cat === filter));

  const remove = (s) => {
    if (window.confirm(`Delete "${s.item}" from inventory? Its stock record will be removed.`)) actions.deleteStock(s.id);
  };

  return (
    <Sheet title="Inventory" footer={<button className="btn p" onClick={() => openSheet('addStock')}>+ Add inventory item</button>}>
      <KpiGrid>
        <Kpi icon="bank" tone="blue" value={db.stock.length} label="Items" />
        <Kpi icon="wallet" tone="gold" value={money(value)} label="Stock value" />
        <Kpi icon="up" tone="red" value={low.length} label="Below minimum" />
      </KpiGrid>

      <Field label="Search" placeholder="Item name" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {[['all', `All ${db.stock.length}`], ['low', `Low stock ${low.length}`], ...cats.map((c) => [c, c])].map(([k, l]) => (
          <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div className="rpt-wrap bk-table">
        <table className="rpt">
          <thead>
            <tr>
              <th>Item</th><th>Type</th><th>In stock</th><th className="rt">Minimum</th>
              <th className="rt">Rate</th><th className="rt">Value</th><th className="rt">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.length ? shown.map((s) => (
              <tr key={s.id}>
                <td className="guest">
                  <b>{s.item}{s.qty < s.min && <> <Pill tone="r">Low</Pill></>}</b>
                  <span>{s.cat}</span>
                </td>
                <td>{s.unit}</td>
                <td>
                  <Stepper
                    value={`${s.qty} ${s.unit}`}
                    onDecrease={() => actions.adjustStock(db.stock.indexOf(s), -1)}
                    onIncrease={() => actions.adjustStock(db.stock.indexOf(s), 1)}
                  />
                </td>
                <td className="rt num">{s.min} {s.unit}</td>
                <td className="rt num">{money(s.rate)}/{s.unit}</td>
                <td className="rt num amt">{money(s.qty * s.rate)}</td>
                <td className="rt acts">
                  <button className="btn sm" onClick={() => openSheet('editStock', { id: s.id })}>Edit</button>
                  <button className="btn sm del" onClick={() => remove(s)}>Delete</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="empty">{db.stock.length ? 'No item matches.' : 'No inventory items yet.'}</td></tr>
            )}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr><td colSpan={5}>{shown.length} item{shown.length === 1 ? '' : 's'}</td><td className="rt num">{money(shown.reduce((t, s) => t + s.qty * s.rate, 0))}</td><td /></tr>
            </tfoot>
          )}
        </table>
      </div>
    </Sheet>
  );
}

/* --------------------------------------------------------------- expenses */

const EXPENSE_HEADS = ['Kitchen purchase', 'Laundry', 'Maintenance', 'Electricity', 'Salary advance', 'Fuel', 'Housekeeping', 'Other'];
const SALARY = 'Salary advance';
const blankExpense = () => ({
  head: 'Kitchen purchase', vendor: '', staffId: '', mode: 'Cash', amount: '', narration: '', payment: 'NOW', dueDate: ''
});

export function ExpensesSheet() {
  const { db, actions, isAdmin } = useHotel();
  const [form, setForm] = useState(blankExpense);
  const [editId, setEditId] = useState(null);                 // set while an existing expense is being edited
  const [payingId, setPayingId] = useState(null);
  const [pay, setPay] = useState({ amount: '', mode: 'Cash', narration: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const isSalary = form.head === SALARY;
  const staff = db.staff || [];
  const total = db.expenses.reduce((s, e) => s + e.amount, 0);
  const cashOut = db.expenses.reduce((s, e) => s + (e.onCredit ? 0 : e.amount), 0);
  const payables = db.payables || [];
  const payable = payables.reduce((s, e) => s + e.due, 0);
  const byVendor = payables.reduce((m, e) => ({ ...m, [e.vendor || 'Unknown']: (m[e.vendor || 'Unknown'] || 0) + e.due }), {});
  const startPay = (e) => { setPayingId(e.id); setPay({ amount: String(e.due), mode: 'Cash', narration: '' }); };
  const submitPay = async (e) => {
    if (await actions.payExpenseDue(e.id, pay)) setPayingId(null);
  };

  /** Salary advance: the vendor box becomes a staff list, the salary fills the amount, payment is fixed to "Paid now". */
  const setHead = (e) => {
    const head = e.target.value;
    setForm((f) => (head === SALARY
      ? { ...f, head, vendor: '', staffId: '', amount: '', payment: 'NOW', dueDate: '' }
      : { ...f, head, staffId: '', vendor: f.head === SALARY ? '' : f.vendor }));
  };
  const setStaff = (e) => {
    const m = staff.find((x) => String(x.id) === e.target.value);
    setForm((f) => ({ ...f, staffId: e.target.value, vendor: m?.name || '', amount: m ? String(m.salary) : '', payment: 'NOW' }));
  };

  const reset = () => { setForm(blankExpense()); setEditId(null); };
  const submit = async () => {
    const ok = editId ? await actions.updateExpense(editId, form) : await actions.addExpense(form);
    if (ok) reset();
  };
  const startEdit = (x) => {
    setEditId(x.id);
    setForm({
      head: x.head, vendor: x.vendor || '', staffId: x.staffId || '', mode: x.mode || 'Cash', amount: String(x.amount),
      narration: x.narration || '', payment: x.onCredit ? 'CREDIT' : 'NOW', dueDate: x.dueDate || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const remove = (x) => {
    if (window.confirm(`Delete the expense "${x.head}" of ${money(x.amount)}? It will also be removed from the day book.`)) {
      if (editId === x.id) reset();
      actions.deleteExpense(x.id);
    }
  };

  return (
    <Sheet title="Expenses">
      {/* ---------------------------------------------------- the form, on top */}
      <div className="exp-form">
        <h3>{editId ? 'Edit expense' : 'Add an expense'}</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>
          {editId
            ? 'You are editing a saved expense. The day book is updated when you save.'
            : <>New expenses are recorded on the open business day{db.day?.businessDate ? ` (${fmtDate(db.day.businessDate)})` : ''} and also appear in the day book.</>}
        </p>
        <Row2>
          <Field as="select" label="Head" value={form.head} onChange={setHead}>
            {EXPENSE_HEADS.map((h) => <option key={h}>{h}</option>)}
          </Field>
          {isSalary ? (
            <Field as="select" label="Staff" value={form.staffId} onChange={setStaff}>
              <option value="">{staff.length ? 'Select staff…' : 'No staff added yet'}</option>
              {staff.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
            </Field>
          ) : (
            <Field label="Vendor" value={form.vendor} onChange={set('vendor')} />
          )}
        </Row2>
        <Field as="select" label="Payment" value={form.payment} onChange={set('payment')} disabled={isSalary || !!editId}>
          <option value="NOW">Paid now</option>
          {!isSalary && <option value="CREDIT">On credit (udhari) — pay later</option>}
        </Field>
        <Row2>
          <Field label={isSalary && form.staffId ? 'Amount (staff salary)' : 'Amount'} type="number" value={form.amount} onChange={set('amount')} />
          {form.payment === 'CREDIT'
            ? <Field label="Pay by (optional)" type="date" value={form.dueDate} onChange={set('dueDate')} />
            : (
              <Field as="select" label="Mode" value={form.mode} onChange={set('mode')}>
                {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
              </Field>
            )}
        </Row2>
        {form.payment === 'CREDIT' && (
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>
            The vendor name is required. This is not paid out of the cash book now; it is listed under Payables until you pay it.
          </p>
        )}
        <Field label="Narration" value={form.narration} onChange={set('narration')} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn p" style={{ width: 'auto' }} onClick={submit}>{editId ? 'Save changes' : 'Record expense'}</button>
          {editId && <button className="btn" style={{ width: 'auto' }} onClick={reset}>Cancel</button>}
        </div>
      </div>

      {/* ------------------------------------------------------ the table, below */}
      <div className="rpt-label" style={{ marginTop: 18 }}>Expenses · {fmtDate(db.date)}</div>
      <DateBar label="Expenses for" />
      <div className="rpt-wrap bk-table" style={{ marginTop: 10 }}>
        <table className="rpt">
          <thead>
            <tr>
              <th>Time</th><th>Head</th><th>Paid to</th><th>Payment</th><th>Narration</th>
              <th className="rt">Amount</th>{isAdmin && <th className="rt">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {db.expenses.length ? db.expenses.map((e) => (
              <tr key={e.id} className={editId === e.id ? 'sel' : ''}>
                <td>{e.time || '—'}</td>
                <td><b style={{ color: 'var(--ink)' }}>{e.head}</b></td>
                <td>{e.vendor || '—'}</td>
                <td>{e.onCredit ? <Pill tone="o">On credit</Pill> : e.mode || '—'}</td>
                <td className="nar">{e.narration}</td>
                <td className="rt num amt" style={{ color: e.onCredit ? '#A55A00' : 'var(--red)' }}>
                  {e.onCredit ? `Due ${money(e.amount)}` : `−${money(e.amount)}`}
                </td>
                {isAdmin && (
                  <td className="rt acts">
                    <button className="btn sm" onClick={() => startEdit(e)}>Edit</button>
                    <button className="btn sm del" onClick={() => remove(e)}>Delete</button>
                  </td>
                )}
              </tr>
            )) : (
              <tr><td colSpan={isAdmin ? 7 : 6} className="empty">No expenses on {fmtDate(db.date)}.</td></tr>
            )}
          </tbody>
          {db.expenses.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5}>
                  Total{total !== cashOut ? ` · ${money(cashOut)} paid · ${money(total - cashOut)} on credit` : ''}
                </td>
                <td className="rt num">{money(total)}</td>
                {isAdmin && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!isAdmin && <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0 0' }}>Only an admin can edit or delete an expense.</p>}

      <h3 style={{ margin: '18px 0 8px', fontSize: 14 }}>Payables — we owe · {money(payable)}</h3>
      {payables.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 8px' }}>Nothing is owed to any vendor.</p>}
      {Object.keys(byVendor).length > 1 && (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 6px' }}>
          {Object.entries(byVendor).map(([v, a]) => `${v} ${money(a)}`).join(' · ')}
        </p>
      )}
      {payables.map((e) => (
        <div key={e.id}>
          <ListRow
            title={`${e.vendor || 'Vendor'} · ${e.head}`}
            sub={`${fmtDate(e.date)}${e.dueDate ? ` · pay by ${fmtDate(e.dueDate)}` : ''} · bill ${money(e.amount)}${e.paid > 0 ? `, paid ${money(e.paid)}` : ''}`}
            right={
              <div style={{ textAlign: 'right' }}>
                <div className="num" style={{ color: 'var(--red)' }}>{money(e.due)}</div>
                <button type="button" className="btn sm" onClick={() => (payingId === e.id ? setPayingId(null) : startPay(e))}>{payingId === e.id ? 'Cancel' : 'Pay'}</button>
              </div>
            }
          />
          {payingId === e.id && (
            <div style={{ background: 'var(--bg)', borderRadius: 11, padding: '10px 12px', margin: '6px 0' }}>
              <Row2>
                <Field label="Paying now" type="number" value={pay.amount} onChange={(x) => setPay((p) => ({ ...p, amount: x.target.value }))} />
                <Field as="select" label="Mode" value={pay.mode} onChange={(x) => setPay((p) => ({ ...p, mode: x.target.value }))}>
                  {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
                </Field>
              </Row2>
              <button type="button" className="btn p" onClick={() => submitPay(e)}>Record payment (goes out of the day book)</button>
            </div>
          )}
        </div>
      ))}
    </Sheet>
  );
}

/* ------------------------------------------------ add inventory / staff / menu */

function StockForm({ title, initial, submitLabel, onSubmit, stockLabel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Sheet title={title} footer={<button className="btn p" onClick={() => onSubmit(form)}>{submitLabel}</button>}>
      <Field label="Item name" placeholder="Basmati rice" value={form.item} onChange={set('item')} />
      <Row2>
        <Field as="select" label="Category" value={form.cat} onChange={set('cat')}>
          {[...new Set([...STOCK_CATEGORIES, form.cat].filter(Boolean))].map((c) => <option key={c}>{c}</option>)}
        </Field>
        <Field as="select" label="Stock item type" value={form.unit} onChange={set('unit')}>
          {unitOptions(form.unit).map(([u, l]) => <option key={u} value={u}>{l}</option>)}
        </Field>
      </Row2>
      <Row2>
        <Field label={`${stockLabel} (${form.unit})`} type="number" value={form.qty} onChange={set('qty')} />
        <Field label="Minimum level" type="number" placeholder="Alert below this" value={form.min} onChange={set('min')} />
      </Row2>
      <Field label={`Rate per ${form.unit} (₹)`} type="number" value={form.rate} onChange={set('rate')} />
      {Number(form.qty) > 0 && Number(form.rate) > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 10px' }}>
          Stock value: <b style={{ color: 'var(--ink)' }}>{money(Number(form.qty) * Number(form.rate))}</b>
        </p>
      )}
    </Sheet>
  );
}

export function AddStockSheet() {
  const { actions } = useHotel();
  return (
    <StockForm
      title="Add inventory item" submitLabel="Save item" stockLabel="Opening stock" onSubmit={actions.addStock}
      initial={{ item: '', cat: 'Kitchen', unit: 'kg', qty: '', min: '', rate: '' }}
    />
  );
}

export function EditStockSheet({ id }) {
  const { db, actions } = useHotel();
  const s = db.stock.find((x) => x.id === id);
  if (!s) return null;
  return (
    <StockForm
      title={`Edit — ${s.item}`} submitLabel="Save changes" stockLabel="Stock quantity"
      onSubmit={(form) => actions.updateStock(id, form)}
      initial={{ item: s.item, cat: s.cat || 'General', unit: s.unit || 'pcs', qty: String(s.qty), min: String(s.min), rate: String(s.rate) }}
    />
  );
}

export function AddMenuItemSheet() {
  const { db, actions } = useHotel();
  const cats = [...new Set(db.menu.map((m) => m.c))];
  const [form, setForm] = useState({ name: '', description: '', category: cats[0] || 'Main', veg: 'veg', price: '', image: null });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Sheet title="Add food item" footer={<button className="btn p" onClick={() => actions.addMenuItem(form)}>Add to menu</button>}>
      <Field label="Name" placeholder="Paneer butter masala" value={form.name} onChange={set('name')} />
      <Field as="textarea" rows={2} label="Description" placeholder="Short line shown to guests" value={form.description} onChange={set('description')} />
      <Row2>
        <Field label="Price" type="number" value={form.price} onChange={set('price')} />
        <Field as="select" label="Type" value={form.veg} onChange={set('veg')}>
          <option value="veg">Veg</option>
          <option value="non">Non-veg</option>
        </Field>
      </Row2>
      <Field label="Category" list="menu-cats" placeholder="Main, Starter, Drinks…" value={form.category} onChange={set('category')} />
      <datalist id="menu-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
      <ImagePicker label="Photo" multiple={false} files={form.image ? [form.image] : []} onChange={(f) => setForm((x) => ({ ...x, image: f[0] || null }))} />
    </Sheet>
  );
}

/* ------------------------------------------------------------ GST invoice */

const INVOICE_NO = (n) => `MTH/${new Date().getFullYear()}/${String(n).padStart(3, '0')}`;
const nightsBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) || 1);

/** Everything on the form comes from the chosen room's stay; the manager can change any of it. */
function roomDefaults(room, date) {
  const guests = room?.guests || 1;
  const checkIn = room?.checkIn || date;
  const checkOut = room?.checkOut || addDays(checkIn, 1);
  const rate = room ? (room.guest ? room.stayRate : rateFor(room, guests)) : 0;
  return {
    room: room?.no || '', type: room?.type || '', guest: room?.guest || '', phone: room?.phone || '',
    persons: String(guests), checkIn, checkOut, nights: String(room?.nights || nightsBetween(checkIn, checkOut)),
    rate: rate ? String(rate) : '', gstRate: String(roomGstRate(rate || 0))
  };
}

function HotelInvoiceForm({ tabs }) {
  const { db, toast } = useHotel();
  const rooms = [...db.rooms].sort((a, b) => (b.status === 'occupied') - (a.status === 'occupied'));
  const first = rooms.find((r) => r.status === 'occupied') || rooms[0];
  const [form, setForm] = useState(() => ({
    no: INVOICE_NO(db.invoices.length + 1), date: db.date, gstin: '', desc: 'Room tariff',
    inclusive: GST.inclusive, ...roomDefaults(first, db.date)
  }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickRoom = (e) => {
    const r = db.rooms.find((x) => x.no === e.target.value);
    setForm((f) => ({ ...f, ...roomDefaults(r, db.date) }));
  };
  const setCheckIn = (e) => { const checkIn = e.target.value; setForm((f) => ({ ...f, checkIn, checkOut: addDays(checkIn, Number(f.nights) || 1) })); };
  const setNights = (e) => { const nights = e.target.value; setForm((f) => ({ ...f, nights, checkOut: addDays(f.checkIn, Number(nights) || 1) })); };
  const setCheckOut = (e) => { const checkOut = e.target.value; setForm((f) => ({ ...f, checkOut, nights: String(nightsBetween(f.checkIn, checkOut)) })); };
  const setRate = (e) => {
    const rate = e.target.value;
    setForm((f) => ({ ...f, rate }));
  };

  const nights = Number(form.nights) || 0;
  const rateNight = Number(form.rate) || 0;
  const gstRate = Math.max(0, Number(form.gstRate) || 0);
  const amount = rateNight * nights;
  const taxable = form.inclusive ? amount / (1 + gstRate / 100) : amount;
  const taxTotal = form.inclusive ? amount - taxable : (amount * gstRate) / 100;
  const cgst = taxTotal / 2;
  const sgst = taxTotal / 2;
  const exact = taxable + taxTotal;
  const grand = Math.round(exact);
  const roundOff = grand - exact;

  /** Print only. Nothing is sent to the server, so the amount is not part of the day book, sales or reports. */
  const print = () => {
    if (!form.guest.trim()) { toast('Enter the guest / party name'); return; }
    if (!form.room) { toast('Select the room'); return; }
    if (!amount) { toast('Enter the rate and nights'); return; }
    printRoomInvoice({
      no: form.no, date: form.date, guest: form.guest.trim(), party: form.guest.trim(), phone: form.phone, gstin: form.gstin.trim(),
      room: form.room, type: form.type, persons: form.persons, checkIn: form.checkIn, checkOut: form.checkOut,
      nights, desc: form.desc, rateNight, rate: gstRate, taxable, cgst, sgst, total: exact, roundOff, grand
    });
  };

  return (
    <Sheet
      title="GST invoice — room"
      footer={<button className="btn p" onClick={print}>Print invoice</button>}
    >
      {tabs}
      <div style={{ background: '#FFF6E5', color: '#8A5200', borderRadius: 11, padding: '10px 12px', fontSize: 12.5, marginBottom: 12 }}>
        <b>Not recorded anywhere.</b> This invoice is only printed. Its amount is not saved, and it is not added to the
        day book, cash, sales, reports or any guest bill. It covers the room only, with no restaurant items.
      </div>

      <Row2>
        <Field label="Invoice no." value={form.no} onChange={set('no')} />
        <Field label="Invoice date" type="date" value={form.date} onChange={set('date')} />
      </Row2>

      <Field as="select" label="Room" value={form.room} onChange={pickRoom}>
        {rooms.map((r) => (
          <option key={r.no} value={r.no}>{r.no} — {r.type}{r.status === 'occupied' ? ` · ${r.guest}` : ' (vacant)'}</option>
        ))}
      </Field>
      <Field label="Guest / party name" value={form.guest} onChange={set('guest')} />
      <Row2>
        <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Field label="Party GSTIN" placeholder="Optional" value={form.gstin} onChange={set('gstin')} />
      </Row2>

      <Row2>
        <Field label="No. of persons" type="number" value={form.persons} onChange={set('persons')} />
        <Field label="Nights" type="number" value={form.nights} onChange={setNights} />
      </Row2>
      <Row2>
        <Field label="Check-in" type="date" value={form.checkIn} onChange={setCheckIn} />
        <Field label="Check-out" type="date" value={form.checkOut} onChange={setCheckOut} />
      </Row2>

      <Field label="Description" value={form.desc} onChange={set('desc')} />
      <Row2>
        <Field label="Room rate per night (₹)" type="number" value={form.rate} onChange={setRate} />
        <Field label="GST rate (%)" type="number" value={form.gstRate} onChange={set('gstRate')} />
      </Row2>
      <Field as="select" label="Rate type" value={form.inclusive ? 'in' : 'ex'} onChange={(e) => setForm((f) => ({ ...f, inclusive: e.target.value === 'in' }))}>
        <option value="in">Rate already includes GST</option>
        <option value="ex">Add GST on top of the rate</option>
      </Field>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 10px' }}>
        The room, dates, persons and rate come from the guest's stay, and the GST rate follows the room price. You can change any of them.
      </p>

      <table>
        <tbody>
          <tr><td>Room charge · {nights} night{nights === 1 ? '' : 's'} × {money(rateNight)}</td><td className="rt num">{money(amount)}</td></tr>
          <tr><td>Taxable value</td><td className="rt num">{money(taxable)}</td></tr>
          <tr><td>CGST {gstRate / 2}%</td><td className="rt num">{money(cgst)}</td></tr>
          <tr><td>SGST {gstRate / 2}%</td><td className="rt num">{money(sgst)}</td></tr>
          {roundOff !== 0 && <tr><td>Round off</td><td className="rt num">{roundOff.toFixed(2)}</td></tr>}
          <tr>
            <td><b>Invoice total</b></td>
            <td className="rt num" style={{ fontSize: 16, color: 'var(--ink)' }}>{money(grand)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ height: 10 }} />
    </Sheet>
  );
}

/* ------------------------------------------------------- food GST invoice */

const NotRecorded = ({ children }) => (
  <div style={{ background: '#FFF6E5', color: '#8A5200', borderRadius: 11, padding: '10px 12px', fontSize: 12.5, marginBottom: 12 }}>
    <b>Not recorded anywhere.</b> {children}
  </div>
);

function FoodInvoiceForm({ tabs }) {
  const { db, toast } = useHotel();
  const [form, setForm] = useState({
    no: INVOICE_NO(db.invoices.length + 1), date: db.date, party: '', phone: '', gstin: '', where: '',
    gstRate: '5', inclusive: false, source: ''
  });
  const [lines, setLines] = useState([{ n: '', q: '1', p: '' }]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, x) => (x === i ? { ...l, [k]: v } : l)));

  const kots = db.kots.filter((k) => k.status !== 'Cancelled');
  const online = db.online.filter((o) => o.status !== 'Cancelled');

  /** Fill the lines from an existing kitchen order or online order; everything stays editable. */
  const pickSource = (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, source: v }));
    if (!v) return;
    const [kind, id] = v.split(':');
    if (kind === 'kot') {
      const k = kots.find((x) => x.id === id);
      if (!k) return;
      setLines(k.items.map((i) => ({ n: i.n, q: String(i.q), p: String(i.p) })));
      setForm((f) => ({ ...f, source: v, where: k.room ? `Room ${k.room}` : k.table || '' }));
    } else {
      const o = online.find((x) => x.id === id);
      if (!o) return;
      setLines([{ n: o.items || 'Online order', q: '1', p: String(o.amount) }]);
      setForm((f) => ({ ...f, source: v, party: f.party || `${o.plat} order`, where: o.oid }));
    }
  };

  const clean = lines.map((l) => ({ n: l.n.trim(), q: Number(l.q) || 0, p: Number(l.p) || 0 })).filter((l) => l.n && l.q && l.p);
  const amount = clean.reduce((t, l) => t + l.q * l.p, 0);
  const gstRate = Math.max(0, Number(form.gstRate) || 0);
  const taxable = form.inclusive ? amount / (1 + gstRate / 100) : amount;
  const taxTotal = form.inclusive ? amount - taxable : (amount * gstRate) / 100;
  const exact = taxable + taxTotal;
  const grand = Math.round(exact);

  const print = () => {
    if (!form.party.trim()) { toast('Enter the party name'); return; }
    if (!clean.length) { toast('Add at least one item with quantity and rate'); return; }
    printFoodInvoice({
      no: form.no, date: form.date, party: form.party.trim(), phone: form.phone, gstin: form.gstin.trim(), where: form.where,
      lines: clean, rate: gstRate, taxable, cgst: taxTotal / 2, sgst: taxTotal / 2, roundOff: grand - exact, grand
    });
  };

  return (
    <Sheet title="GST invoice — food orders" footer={<button className="btn p" onClick={print}>Print invoice</button>}>
      {tabs}
      <NotRecorded>This invoice is only printed. Its amount is not saved, and it is not added to the day book, cash, sales or reports.</NotRecorded>

      <Row2>
        <Field label="Invoice no." value={form.no} onChange={set('no')} />
        <Field label="Invoice date" type="date" value={form.date} onChange={set('date')} />
      </Row2>
      <Field as="select" label="Fill from an order (optional)" value={form.source} onChange={pickSource}>
        <option value="">Type the items myself</option>
        {kots.length > 0 && <optgroup label="Kitchen orders (KOT)">
          {kots.map((k) => <option key={k.id} value={`kot:${k.id}`}>{k.room ? `Room ${k.room}` : k.table || 'Walk-in'}{k.no ? ` · ${k.no}` : ''} — {money(k.amount)}</option>)}
        </optgroup>}
        {online.length > 0 && <optgroup label="Online orders">
          {online.map((o) => <option key={o.id} value={`online:${o.id}`}>{o.plat} · {o.oid} — {money(o.amount)}</option>)}
        </optgroup>}
      </Field>
      <Field label="Party name" value={form.party} onChange={set('party')} />
      <Row2>
        <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Field label="Party GSTIN" placeholder="Optional" value={form.gstin} onChange={set('gstin')} />
      </Row2>
      <Field label="Table / room / order reference" placeholder="Table 4, Room 204, ZOM-1234" value={form.where} onChange={set('where')} />

      <h3 style={{ margin: '8px 0 8px', fontSize: 14 }}>Items</h3>
      {lines.map((l, i) => (
        <div key={i} className="inv-line">
          <input placeholder="Item" aria-label="Item" value={l.n} onChange={(e) => setLine(i, 'n', e.target.value)} />
          <input type="number" placeholder="Qty" aria-label="Quantity" value={l.q} onChange={(e) => setLine(i, 'q', e.target.value)} />
          <input type="number" placeholder="Rate" aria-label="Rate" value={l.p} onChange={(e) => setLine(i, 'p', e.target.value)} />
          <button type="button" className="btn sm" aria-label="Remove item" disabled={lines.length === 1}
            onClick={() => setLines((ls) => ls.filter((_, x) => x !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn sm" style={{ marginBottom: 12 }} onClick={() => setLines((ls) => [...ls, { n: '', q: '1', p: '' }])}>+ Add item</button>

      <Row2>
        <Field label="GST rate (%)" type="number" value={form.gstRate} onChange={set('gstRate')} />
        <Field as="select" label="Rate type" value={form.inclusive ? 'in' : 'ex'} onChange={(e) => setForm((f) => ({ ...f, inclusive: e.target.value === 'in' }))}>
          <option value="ex">Add GST on top of the rates</option>
          <option value="in">Rates already include GST</option>
        </Field>
      </Row2>

      <table>
        <tbody>
          <tr><td>Items total</td><td className="rt num">{money(amount)}</td></tr>
          <tr><td>Taxable value</td><td className="rt num">{money(taxable)}</td></tr>
          <tr><td>CGST {gstRate / 2}%</td><td className="rt num">{money(taxTotal / 2)}</td></tr>
          <tr><td>SGST {gstRate / 2}%</td><td className="rt num">{money(taxTotal / 2)}</td></tr>
          <tr><td><b>Invoice total</b></td><td className="rt num" style={{ fontSize: 16, color: 'var(--ink)' }}>{money(grand)}</td></tr>
        </tbody>
      </table>
      <div style={{ height: 10 }} />
    </Sheet>
  );
}

/* ----------------------------------------------------------- salary slip */

function SalaryInvoiceForm({ tabs }) {
  const { db, toast } = useHotel();
  const staff = db.staff || [];
  const monthOf = (d) => String(d).slice(0, 7);
  const daysIn = (m) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
  const [form, setForm] = useState(() => ({
    no: `SAL/${monthOf(db.date).replace('-', '')}/001`, date: db.date, staffId: staff[0]?.id ?? '',
    month: monthOf(db.date), salary: String(staff[0]?.salary ?? ''), days: String(daysIn(monthOf(db.date))),
    present: String(daysIn(monthOf(db.date))), bonus: '', advance: '', other: ''
  }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const person = staff.find((m) => String(m.id) === String(form.staffId));

  const pickStaff = (e) => {
    const m = staff.find((x) => String(x.id) === e.target.value);
    setForm((f) => ({ ...f, staffId: e.target.value, salary: m ? String(m.salary) : '' }));
  };
  const setMonth = (e) => {
    const month = e.target.value;
    if (!month) return;
    setForm((f) => ({ ...f, month, days: String(daysIn(month)), present: String(daysIn(month)) }));
  };

  const salary = Number(form.salary) || 0;
  const days = Math.max(1, Number(form.days) || 1);
  const present = Math.min(days, Math.max(0, Number(form.present) || 0));
  const earned = Math.round((salary * present) / days);
  const bonus = Number(form.bonus) || 0;
  const advance = Number(form.advance) || 0;
  const other = Number(form.other) || 0;
  const net = earned + bonus - advance - other;

  const print = () => {
    if (!person) { toast('Select the staff member'); return; }
    if (!salary) { toast('Enter the monthly salary'); return; }
    printSalarySlip({
      no: form.no, date: form.date, name: person.name, role: person.role,
      month: new Date(`${form.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      salary, days, present, earned, bonus, advance, other, net
    });
  };

  return (
    <Sheet title="Salary slip" footer={<button className="btn p" onClick={print}>Print salary slip</button>}>
      {tabs}
      <NotRecorded>This slip is only printed. It is not saved and does not create an expense or a day book entry. Record the payment under Expenses → Salary advance if cash was given.</NotRecorded>
      <Row2>
        <Field label="Slip no." value={form.no} onChange={set('no')} />
        <Field label="Date" type="date" value={form.date} onChange={set('date')} />
      </Row2>
      <Field as="select" label="Staff" value={form.staffId} onChange={pickStaff}>
        {staff.length ? staff.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>) : <option value="">No staff added yet</option>}
      </Field>
      <Row2>
        <Field label="Month" type="month" value={form.month} onChange={setMonth} />
        <Field label="Monthly salary (₹)" type="number" value={form.salary} onChange={set('salary')} />
      </Row2>
      <Row2>
        <Field label="Days in month" type="number" value={form.days} onChange={set('days')} />
        <Field label="Days present" type="number" value={form.present} onChange={set('present')} />
      </Row2>
      <Row2>
        <Field label="Bonus / allowance (₹)" type="number" value={form.bonus} onChange={set('bonus')} />
        <Field label="Salary advance taken (₹)" type="number" value={form.advance} onChange={set('advance')} />
      </Row2>
      <Field label="Other deduction (₹)" type="number" value={form.other} onChange={set('other')} />

      <table>
        <tbody>
          <tr><td>Salary for {present} of {days} days</td><td className="rt num">{money(earned)}</td></tr>
          {bonus > 0 && <tr><td>Bonus / allowance</td><td className="rt num">+{money(bonus)}</td></tr>}
          {advance > 0 && <tr><td>Less: advance</td><td className="rt num">−{money(advance)}</td></tr>}
          {other > 0 && <tr><td>Less: other deduction</td><td className="rt num">−{money(other)}</td></tr>}
          <tr><td><b>Net salary payable</b></td><td className="rt num" style={{ fontSize: 16, color: net < 0 ? 'var(--red)' : 'var(--ink)' }}>{money(net)}</td></tr>
        </tbody>
      </table>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0 14px' }}>Salary has no GST.</p>
    </Sheet>
  );
}

/* ----------------------------------------------- GST invoice: three types */

export function GstInvoiceSheet() {
  const [type, setType] = useState('hotel');
  const tabs = (
    <div className="chips">
      {[['hotel', 'Hotel booking'], ['food', 'Food orders'], ['salary', 'Salary']].map(([k, l]) => (
        <button key={k} type="button" className={type === k ? 'on' : ''} onClick={() => setType(k)}>{l}</button>
      ))}
    </div>
  );
  if (type === 'food') return <FoodInvoiceForm tabs={tabs} />;
  if (type === 'salary') return <SalaryInvoiceForm tabs={tabs} />;
  return <HotelInvoiceForm tabs={tabs} />;
}
