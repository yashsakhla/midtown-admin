import { useState } from 'react';
import Field, { Row2 } from '../components/Field';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import { money } from '../lib/format';
import { closingBalance, PAYMENT_MODES, totalPayout, totalReceipt } from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

const ENTRY_TYPES = [
  'Check-in', 'Check-out', 'Advance', 'Part payment',
  'Refund', 'Other receipt', 'Restaurant', 'Expense'
];

/* ------------------------------------------------------------- new entry */

export function EntrySheet() {
  const { db, actions } = useHotel();
  const [form, setForm] = useState({
    room: '', guest: '', phone: '', vehicle: '',
    type: 'Advance', mode: 'Cash', dc: 'credit', amount: '', narration: ''
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /** Pull the guest details across when a room is picked. */
  const pickRoom = (e) => {
    const no = e.target.value;
    const r = db.rooms.find((x) => x.no === no);
    setForm((f) => ({
      ...f,
      room: no,
      guest: r?.guest || f.guest,
      phone: r?.phone || f.phone,
      vehicle: r?.vehicle || f.vehicle
    }));
  };

  return (
    <Sheet
      title="New day-book entry"
      footer={<button className="btn p" onClick={() => actions.addEntry(form)}>Save entry</button>}
    >
      <Row2>
        <Field as="select" label="Room" value={form.room} onChange={pickRoom}>
          <option value="">No room / general</option>
          {db.rooms.map((r) => (
            <option key={r.no} value={r.no}>{r.no} · {r.guest || r.type}</option>
          ))}
        </Field>
        <Field as="select" label="Entry type" value={form.type} onChange={set('type')}>
          {ENTRY_TYPES.map((t) => <option key={t}>{t}</option>)}
        </Field>
      </Row2>

      <Field label="Customer name" value={form.guest} onChange={set('guest')} />

      <Row2>
        <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Field label="Vehicle" value={form.vehicle} onChange={set('vehicle')} />
      </Row2>

      <Row2>
        <Field label="Amount" type="number" placeholder="0" value={form.amount} onChange={set('amount')} />
        <Field as="select" label="Mode" value={form.mode} onChange={set('mode')}>
          {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
        </Field>
      </Row2>

      <Field as="select" label="Credit / debit" value={form.dc} onChange={set('dc')}>
        <option value="credit">Credit — received</option>
        <option value="debit">Debit — paid out</option>
      </Field>

      <Field label="Narration" value={form.narration} onChange={set('narration')} />

      <div style={{ background: 'var(--wash)', color: 'var(--blue)', borderRadius: 11, padding: '11px 12px', fontSize: 12.5 }}>
        If the same entry already exists for today, the app opens it for
        correction instead of posting a second line.
      </div>
      <div style={{ height: 12 }} />
    </Sheet>
  );
}

/* ---------------------------------------------------------- view an entry */

export function EntryViewSheet({ id }) {
  const { db, openSheet } = useHotel();
  const e = db.entries.find((x) => x.id === id);
  if (!e) return null;

  return (
    <Sheet
      title={`Entry · ${e.type}`}
      footer={
        <button className="btn p" onClick={() => openSheet('editEntry', { id })}>
          Correct this entry
        </button>
      }
    >
      <Pill tone={e.dc === 'credit' ? 'g' : 'r'}>
        {e.dc === 'credit' ? 'Credit' : 'Debit'} {money(e.amount)}
      </Pill>
      <table style={{ marginTop: 12 }}>
        <tbody>
          <tr><td>Time</td><td className="rt num">{e.time}</td></tr>
          <tr><td>Room</td><td className="rt num">{e.room || '—'}</td></tr>
          <tr><td>Customer</td><td className="rt">{e.guest || '—'}</td></tr>
          <tr><td>Phone</td><td className="rt num">{e.phone || '—'}</td></tr>
          <tr><td>Vehicle</td><td className="rt">{e.vehicle || '—'}</td></tr>
          <tr><td>Mode</td><td className="rt">{e.mode}</td></tr>
          <tr><td>Narration</td><td className="rt">{e.narration || '—'}</td></tr>
        </tbody>
      </table>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10 }}>
        Corrections update this entry and its day-book line. No refund or
        reversal entry is created.
      </p>
    </Sheet>
  );
}

/* ---------------------------------------------------------- edit an entry */

export function EditEntrySheet({ id }) {
  const { db, actions } = useHotel();
  const original = db.entries.find((x) => x.id === id);
  const [form, setForm] = useState(() => ({
    room: original?.room || '',
    guest: original?.guest || '',
    phone: original?.phone || '',
    vehicle: original?.vehicle || '',
    type: original?.type || 'Advance',
    mode: original?.mode || 'Cash',
    dc: original?.dc || 'credit',
    amount: String(original?.amount ?? 0),
    narration: original?.narration || ''
  }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  if (!original) return null;

  return (
    <Sheet
      title="Correct entry"
      footer={
        <>
          <button className="btn p" onClick={() => actions.updateEntry(id, form)}>
            Save correction
          </button>
          <div style={{ height: 8 }} />
          <button
            className="btn"
            style={{ color: 'var(--red)', borderColor: '#F0CFCB' }}
            onClick={() => actions.deleteEntry(id)}
          >
            Delete this entry
          </button>
        </>
      }
    >
      <Row2>
        <Field as="select" label="Room" value={form.room} onChange={set('room')}>
          <option value="">No room / general</option>
          {db.rooms.map((r) => <option key={r.no} value={r.no}>{r.no}</option>)}
        </Field>
        <Field as="select" label="Entry type" value={form.type} onChange={set('type')}>
          {ENTRY_TYPES.map((t) => <option key={t}>{t}</option>)}
        </Field>
      </Row2>

      <Field label="Customer name" value={form.guest} onChange={set('guest')} />

      <Row2>
        <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Field label="Vehicle" value={form.vehicle} onChange={set('vehicle')} />
      </Row2>

      <Row2>
        <Field label="Amount" type="number" value={form.amount} onChange={set('amount')} />
        <Field as="select" label="Mode" value={form.mode} onChange={set('mode')}>
          {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
        </Field>
      </Row2>

      <Field as="select" label="Credit / debit" value={form.dc} onChange={set('dc')}>
        <option value="credit">Credit — received</option>
        <option value="debit">Debit — paid out</option>
      </Field>

      <Field label="Narration" value={form.narration} onChange={set('narration')} />
    </Sheet>
  );
}

/* ----------------------------------------------------------- misc sheets */

export function OpeningBalanceSheet() {
  const { db, actions } = useHotel();
  const [amount, setAmount] = useState(String(db.cash.opening));
  return (
    <Sheet
      title="Opening balance"
      footer={<button className="btn p" onClick={() => actions.setOpening(amount)}>Save</button>}
    >
      <Field
        label="Cash in hand at start of day" type="number"
        value={amount} onChange={(e) => setAmount(e.target.value)}
      />
    </Sheet>
  );
}

export function CloseDaySheet() {
  const { db, actions } = useHotel();
  const closing = closingBalance(db);
  return (
    <Sheet
      title="Close the day"
      footer={<button className="btn p" onClick={() => actions.closeDay(closing)}>Close day</button>}
    >
      <table>
        <tbody>
          <tr><td>Opening balance</td><td className="rt num">{money(db.cash.opening)}</td></tr>
          <tr><td>Total receipt</td><td className="rt num">{money(totalReceipt(db))}</td></tr>
          <tr><td>Total payout</td><td className="rt num">{money(totalPayout(db))}</td></tr>
          <tr>
            <td><b>Closing balance</b></td>
            <td className="rt num" style={{ fontSize: 16, color: 'var(--ink)' }}>{money(closing)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ height: 12 }} />
      <div style={{ background: 'var(--ow)', color: '#A55A00', borderRadius: 11, padding: '11px 12px', fontSize: 12.5 }}>
        Today's entries are cleared and the closing balance becomes tomorrow's
        opening balance. Export the reports first if you need a copy.
      </div>
      <div style={{ height: 12 }} />
    </Sheet>
  );
}

export function WorkingDateSheet() {
  const { db, actions } = useHotel();
  const [date, setDate] = useState(db.date);
  return (
    <Sheet
      title="Working date"
      footer={<button className="btn p" onClick={() => actions.setDate(date)}>Use this date</button>}
    >
      <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>
        All new entries are stamped with this date.
      </p>
    </Sheet>
  );
}
