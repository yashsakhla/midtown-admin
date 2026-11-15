import { useMemo, useState } from 'react';
import DateBar from '../components/DateBar';
import ImagePicker from '../components/ImagePicker';
import { fmtDate } from '../lib/format';
import { ROOM_TYPES } from '../lib/rooms';
import Field, { Row2 } from '../components/Field';
import ListRow from '../components/ListRow';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import Stepper from '../components/Stepper';
import { money } from '../lib/format';
import { downloadExcel, printInvoice, printReport, printSlip } from '../lib/print';
import { buildReport, REPORTS } from '../lib/reports';
import { lowStock, PAYMENT_MODES } from '../lib/selectors';
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
  const [form, setForm] = useState({
    plat: 'Zomato', oid: '', items: '', amount: '', commission: '20'
  });
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
      <Row2>
        <Field label="Order value" type="number" value={form.amount} onChange={set('amount')} />
        <Field label="Commission %" type="number" value={form.commission} onChange={set('commission')} />
      </Row2>
      <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>
        The payout after commission is posted to the day book under bank receipts.
      </p>
    </Sheet>
  );
}

/* --------------------------------------------------------------- bookings */

export function BookingsSheet() {
  const { db, openSheet } = useHotel();
  const tone = { Arriving: 'o', Confirmed: 'b', Cancelled: 'r', 'Checked in': 'g' };
  return (
    <Sheet
      title="Bookings from OTA"
      footer={<button className="btn p" onClick={() => openSheet('booking')}>+ Add a booking</button>}
    >
      {db.bookings.map((b) => (
        <ListRow key={b.id} onClick={() => openSheet('bookingView', { id: b.id })}>
          <div className="t">
            <b>{b.guest}</b>
            <span>{b.phone ? `📞 ${b.phone} · ` : ''}{b.src} · {b.ref}</span>
            <span>{b.type} × {b.rooms} · {b.pax} pax · {b.inD}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="num" style={{ color: 'var(--ink)' }}>{money(b.amount)}</div>
            <Pill tone={tone[b.status] || 'n'}>{b.status}</Pill>
          </div>
        </ListRow>
      ))}
    </Sheet>
  );
}

export function BookingViewSheet({ id }) {
  const { db } = useHotel();
  const b = db.bookings.find((x) => x.id === id);
  if (!b) return null;
  const tone = { Arriving: 'o', Confirmed: 'b', Cancelled: 'r', 'Checked in': 'g' };
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
    <Sheet title="Booking details">
      <div style={{ marginBottom: 10 }}><Pill tone={tone[b.status] || 'n'}>{b.status}</Pill></div>
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

export function AddBookingSheet() {
  const { db, actions } = useHotel();
  const [form, setForm] = useState({
    src: 'MakeMyTrip', ref: '', guest: '', phone: '',
    type: ROOM_TYPES[0], rooms: '1', pax: '2', inD: db.date, amount: '', pay: 'Prepaid'
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Sheet
      title="Add a booking"
      footer={<button className="btn p" onClick={() => actions.addBooking(form)}>Save booking</button>}
    >
      <Row2>
        <Field as="select" label="Source" value={form.src} onChange={set('src')}>
          {['MakeMyTrip', 'Booking.com', 'Goibibo', 'Agoda', 'Airbnb', 'Walk-in', 'Phone'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Field>
        <Field label="Reference" value={form.ref} onChange={set('ref')} />
      </Row2>
      <Field label="Guest name" value={form.guest} onChange={set('guest')} />
      <Row2>
        <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Field as="select" label="Room type" value={form.type} onChange={set('type')}>
          {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
        </Field>
      </Row2>
      <Row2>
        <Field label="Rooms" type="number" value={form.rooms} onChange={set('rooms')} />
        <Field label="Guests" type="number" value={form.pax} onChange={set('pax')} />
      </Row2>
      <Row2>
        <Field label="Arrival" type="date" value={form.inD} onChange={set('inD')} />
        <Field label="Amount" type="number" value={form.amount} onChange={set('amount')} />
      </Row2>
      <Field as="select" label="Payment" value={form.pay} onChange={set('pay')}>
        <option>Prepaid</option>
        <option>Pay at hotel</option>
      </Field>
    </Sheet>
  );
}

/* -------------------------------------------------------------- inventory */

export function InventorySheet() {
  const { db, actions, openSheet } = useHotel();
  const value = db.stock.reduce((s, i) => s + i.qty * i.rate, 0);
  return (
    <Sheet title="Inventory" footer={<button className="btn p" onClick={() => openSheet('addStock')}>+ Add inventory item</button>}>
      <ListRow
        title="Stock value"
        sub={`${lowStock(db).length} items below minimum`}
        right={<span className="num" style={{ color: 'var(--ink)' }}>{money(value)}</span>}
      />
      {db.stock.map((s, i) => (
        <ListRow key={s.item}>
          <div className="t">
            <b>{s.item}</b>
            <span>{s.cat} · min {s.min} {s.unit} · {money(s.rate)}/{s.unit}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {s.qty < s.min && <Pill tone="r">Low</Pill>}
            <Stepper
              value={`${s.qty}`}
              onDecrease={() => actions.adjustStock(i, -1)}
              onIncrease={() => actions.adjustStock(i, 1)}
            />
          </div>
        </ListRow>
      ))}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ staff */

export function StaffSheet() {
  const { db, actions, openSheet } = useHotel();
  const marks = [['P', 'g'], ['A', 'r'], ['L', 'o']];
  return (
    <Sheet title="Staff attendance" footer={<button className="btn p" onClick={() => openSheet('addStaff')}>+ Add staff</button>}>
      {db.staff.map((s) => (
        <ListRow key={s.id}>
          <div className="t">
            <b>{s.name}</b>
            <span>{s.role} · {s.shift} shift · {money(s.salary)}/month</span>
          </div>
          <div className="chips" style={{ margin: 0 }}>
            {marks.map(([m]) => (
              <button
                key={m}
                className={db.att[s.id] === m ? 'on' : ''}
                onClick={() => actions.setAttendance(s.id, m)}
              >
                {m}
              </button>
            ))}
          </div>
        </ListRow>
      ))}
      <p style={{ fontSize: 11.5, color: 'var(--muted)', padding: '10px 2px 0' }}>
        P — present · A — absent · L — leave
      </p>
    </Sheet>
  );
}

/* --------------------------------------------------------------- expenses */

export function ExpensesSheet() {
  const { db, actions } = useHotel();
  const [form, setForm] = useState({
    head: 'Kitchen purchase', vendor: '', mode: 'Cash', amount: '', narration: '', payment: 'NOW', dueDate: ''
  });
  const [payingId, setPayingId] = useState(null);
  const [pay, setPay] = useState({ amount: '', mode: 'Cash', narration: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const total = db.expenses.reduce((s, e) => s + e.amount, 0);
  const cashOut = db.expenses.reduce((s, e) => s + (e.onCredit ? 0 : e.amount), 0);
  const payables = db.payables || [];
  const payable = payables.reduce((s, e) => s + e.due, 0);
  const byVendor = payables.reduce((m, e) => ({ ...m, [e.vendor || 'Unknown']: (m[e.vendor || 'Unknown'] || 0) + e.due }), {});
  const startPay = (e) => { setPayingId(e.id); setPay({ amount: String(e.due), mode: 'Cash', narration: '' }); };
  const submitPay = async (e) => {
    if (await actions.payExpenseDue(e.id, pay)) setPayingId(null);
  };

  return (
    <Sheet
      title="Expenses"
      footer={<button className="btn p" onClick={() => actions.addExpense(form)}>Record expense</button>}
    >
      <DateBar label="Expenses for" />
      {!db.expenses.length && <ListRow><span style={{ color: 'var(--muted)' }}>No expenses on {fmtDate(db.date)}.</span></ListRow>}
      {db.expenses.map((e) => (
        <ListRow
          key={e.id}
          title={e.head}
          sub={`${e.time ? e.time + ' · ' : ''}${e.vendor} · ${e.onCredit ? 'On credit (udhari)' : e.mode} · ${e.narration}`}
          right={e.onCredit
            ? <span className="num" style={{ color: 'var(--ow-ink, #A55A00)' }}>Due {money(e.amount)}</span>
            : <span className="num" style={{ color: 'var(--red)' }}>−{money(e.amount)}</span>}
        />
      ))}
      <ListRow
        title={`Total · ${fmtDate(db.date)}`}
        sub={total !== cashOut ? `${money(cashOut)} paid · ${money(total - cashOut)} on credit` : undefined}
        right={<span className="num" style={{ color: 'var(--ink)' }}>{money(total)}</span>}
      />

      <h3 style={{ margin: '16px 0 8px', fontSize: 14 }}>Payables — we owe · {money(payable)}</h3>
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

      <div style={{ height: 12 }} />
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>
        New expenses are recorded on the open business day{db.day?.businessDate ? ` (${fmtDate(db.day.businessDate)})` : ''} and also appear in the day book.
      </p>
      <Row2>
        <Field as="select" label="Head" value={form.head} onChange={set('head')}>
          {['Kitchen purchase', 'Laundry', 'Maintenance', 'Electricity', 'Salary advance',
            'Fuel', 'Housekeeping', 'Other'].map((h) => <option key={h}>{h}</option>)}
        </Field>
        <Field label="Vendor" value={form.vendor} onChange={set('vendor')} />
      </Row2>
      <Field as="select" label="Payment" value={form.payment} onChange={set('payment')}>
        <option value="NOW">Paid now</option>
        <option value="CREDIT">On credit (udhari) — pay later</option>
      </Field>
      <Row2>
        <Field label="Amount" type="number" value={form.amount} onChange={set('amount')} />
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
    </Sheet>
  );
}

/* ------------------------------------------------ add inventory / staff / menu */

export function AddStockSheet() {
  const { actions } = useHotel();
  const [form, setForm] = useState({ item: '', cat: 'Kitchen', unit: 'kg', qty: '', min: '', rate: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Sheet title="Add inventory item" footer={<button className="btn p" onClick={() => actions.addStock(form)}>Save item</button>}>
      <Field label="Item name" placeholder="Basmati rice" value={form.item} onChange={set('item')} />
      <Row2>
        <Field as="select" label="Category" value={form.cat} onChange={set('cat')}>
          {['Kitchen', 'Housekeeping', 'Laundry', 'Bar', 'Maintenance', 'General'].map((c) => <option key={c}>{c}</option>)}
        </Field>
        <Field as="select" label="Unit" value={form.unit} onChange={set('unit')}>
          {['kg', 'g', 'litre', 'ml', 'pcs', 'packet', 'box', 'dozen'].map((u) => <option key={u}>{u}</option>)}
        </Field>
      </Row2>
      <Row2>
        <Field label="Opening quantity" type="number" value={form.qty} onChange={set('qty')} />
        <Field label="Minimum level" type="number" placeholder="Alert below this" value={form.min} onChange={set('min')} />
      </Row2>
      <Field label="Rate per unit" type="number" value={form.rate} onChange={set('rate')} />
    </Sheet>
  );
}

export function AddStaffSheet() {
  const { actions } = useHotel();
  const [form, setForm] = useState({ name: '', role: 'Housekeeping', shift: 'Morning', phone: '', salary: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Sheet title="Add staff" footer={<button className="btn p" onClick={() => actions.addStaff(form)}>Save staff</button>}>
      <Field label="Full name" value={form.name} onChange={set('name')} />
      <Row2>
        <Field as="select" label="Role" value={form.role} onChange={set('role')}>
          {['Manager', 'Front desk', 'Housekeeping', 'Kitchen', 'Waiter', 'Security', 'Maintenance', 'Other'].map((r) => <option key={r}>{r}</option>)}
        </Field>
        <Field as="select" label="Shift" value={form.shift} onChange={set('shift')}>
          {['Morning', 'Evening', 'Night', 'General'].map((r) => <option key={r}>{r}</option>)}
        </Field>
      </Row2>
      <Row2>
        <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Field label="Monthly salary" type="number" value={form.salary} onChange={set('salary')} />
      </Row2>
    </Sheet>
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

const GST_RATE = 0.12;

export function GstInvoiceSheet() {
  const { db, actions } = useHotel();
  const [form, setForm] = useState({
    no: `MTH/${new Date().getFullYear()}/${String(db.invoices.length + 1).padStart(3, '0')}`,
    date: db.date, party: '', gstin: '', desc: 'Room tariff', qty: '1', rate: ''
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const taxable = (Number(form.qty) || 0) * (Number(form.rate) || 0);
  const tax = Math.round(taxable * GST_RATE);
  const total = taxable + tax;

  const save = (alsoPrint) => {
    if (!form.party || !taxable) return;
    if (alsoPrint) {
      printInvoiceDoc(form, taxable, tax, total);
    }
    actions.saveInvoice({ ...form, total });
  };

  return (
    <Sheet
      title="GST tax invoice"
      footer={
        <>
          <button className="btn p" onClick={() => save(true)}>Save &amp; print invoice</button>
          <div style={{ height: 8 }} />
          <button className="btn" onClick={() => save(false)}>Save without printing</button>
        </>
      }
    >
      <Row2>
        <Field label="Invoice no." value={form.no} onChange={set('no')} />
        <Field label="Date" type="date" value={form.date} onChange={set('date')} />
      </Row2>
      <Field label="Party name" value={form.party} onChange={set('party')} />
      <Field label="Party GSTIN" placeholder="Optional" value={form.gstin} onChange={set('gstin')} />
      <Field label="Description" value={form.desc} onChange={set('desc')} />
      <Row2>
        <Field label="Quantity / nights" type="number" value={form.qty} onChange={set('qty')} />
        <Field label="Rate" type="number" value={form.rate} onChange={set('rate')} />
      </Row2>

      <table>
        <tbody>
          <tr><td>Taxable value</td><td className="rt num">{money(taxable)}</td></tr>
          <tr><td>CGST 6% + SGST 6%</td><td className="rt num">{money(tax)}</td></tr>
          <tr>
            <td><b>Invoice total</b></td>
            <td className="rt num" style={{ fontSize: 16, color: 'var(--ink)' }}>{money(total)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ height: 10 }} />
    </Sheet>
  );
}

function printInvoiceDoc(form, taxable, tax, total) {
  printInvoice({
    no: form.no, date: form.date, party: form.party, gstin: form.gstin,
    items: [{ desc: form.desc, qty: Number(form.qty) || 1, rate: Number(form.rate) || 0, amount: taxable }],
    totals: { taxable, tax, total }
  });
}

/* ------------------------------------------------------------ export data */

export function ExportSheet() {
  const { db } = useHotel();
  const [key, setKey] = useState('daily');
  const report = useMemo(() => buildReport(db, key), [db, key]);

  return (
    <Sheet
      title="Export reports"
      footer={
        <>
          <button
            className="btn p"
            onClick={() => printReport({ ...report, date: db.date })}
          >
            Download as PDF
          </button>
          <div style={{ height: 8 }} />
          <button
            className="btn"
            onClick={() => downloadExcel({ ...report, date: db.date })}
          >
            Download as Excel
          </button>
        </>
      }
    >
      <Field as="select" label="Report" value={key} onChange={(e) => setKey(e.target.value)}>
        {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
      </Field>
      <ListRow
        title={report.title}
        sub={`${report.rows.length} rows · ${report.head.length} columns`}
      />
      <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>
        PDF opens the print dialog — choose “Save as PDF”. Excel downloads an
        .xls file you can open in Excel or Google Sheets.
      </p>
    </Sheet>
  );
}
