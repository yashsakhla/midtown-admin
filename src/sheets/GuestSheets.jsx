import { useState } from 'react';
import Field, { Row2 } from '../components/Field';
import ListRow from '../components/ListRow';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import { addDays, money } from '../lib/format';
import { GUEST_OPTIONS } from '../lib/rooms';
import { occupiedRooms, PAYMENT_MODES } from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

/* ------------------------------------------------------- in-house guests */

export function GuestsSheet() {
  const { db, openSheet } = useHotel();
  const guests = occupiedRooms(db);

  return (
    <Sheet title="Guest management">
      {guests.length ? guests.map((r) => {
        const overdue = r.checkOut && r.checkOut < db.date;
        return (
          <ListRow key={r.no} onClick={() => openSheet('editGuest', { no: r.no })}>
            <div style={{ width: 44, textAlign: 'center' }}>
              <div className="num" style={{ color: 'var(--ink)' }}>{r.no}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.type}</div>
            </div>
            <div className="t">
              <b>{r.guest}</b>
              <span>{r.phone} · {r.vehicle} · {r.checkIn} → {r.checkOut || '—'}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ color: r.folio > 0 ? 'var(--red)' : 'var(--green)' }}>
                {money(r.folio)}
              </div>
              {overdue ? <Pill tone="o">Due</Pill> : <Pill tone="g">In house</Pill>}
            </div>
          </ListRow>
        );
      }) : (
        <ListRow><span style={{ color: 'var(--muted)' }}>No guests in house.</span></ListRow>
      )}
      <p style={{ fontSize: 11.5, color: 'var(--muted)', padding: '10px 2px 0' }}>
        Tap a guest to edit the stay or post an advance, part payment or refund.
      </p>
    </Sheet>
  );
}

/* ------------------------------------------------------------- edit stay */

export function EditGuestSheet({ no }) {
  const { db, openSheet, actions } = useHotel();
  const room = db.rooms.find((r) => r.no === no);
  const [form, setForm] = useState(() => ({
    guest: room?.guest || '',
    phone: room?.phone || '',
    vehicle: room?.vehicle || '',
    checkIn: room?.checkIn || db.date,
    guests: String(room?.guests || 1),
    nights: String(room?.nights || 1),
    checkOut: room?.checkOut || addDays(room?.checkIn || db.date, room?.nights || 1),
    folio: String(room?.folio ?? 0),
    payType: '', payAmount: '', payMode: 'Cash', payNarration: ''
  }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  if (!room) return null;

  const setNights = (e) => {
    const nights = e.target.value;
    setForm((f) => ({ ...f, nights, checkOut: addDays(f.checkIn, Number(nights) || 1) }));
  };
  const setCheckIn = (e) => {
    const checkIn = e.target.value;
    setForm((f) => ({ ...f, checkIn, checkOut: addDays(checkIn, Number(f.nights) || 1) }));
  };

  const payAmount = Number(form.payAmount) || 0;
  const projected = form.payType === 'Refund'
    ? Number(form.folio) + payAmount
    : Number(form.folio) - payAmount;

  return (
    <Sheet
      title={`Edit stay — room ${no}`}
      footer={
        <>
          <button className="btn p" onClick={() => actions.updateGuestStay(no, form)}>
            Save changes{form.payType && payAmount ? ` & post ${form.payType.toLowerCase()}` : ''}
          </button>
          <div style={{ height: 8 }} />
          <button className="btn" onClick={() => openSheet('shiftRoom', { no })}>
            Shift to another room
          </button>
          <div style={{ height: 8 }} />
          <button className="btn" disabled={room.guests >= 4} onClick={() => openSheet('addGuest', { no })}>
            Add another guest
          </button>
          <div style={{ height: 8 }} />
          <button className="btn" onClick={() => openSheet('checkOut', { no })}>
            Check out &amp; settle
          </button>
        </>
      }
    >
      <Field label="Guest name" value={form.guest} onChange={set('guest')} />
      <Row2>
        <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
        <Field label="Vehicle" value={form.vehicle} onChange={set('vehicle')} />
      </Row2>
      <Field as="select" label="Number of guests" value={form.guests} onChange={set('guests')}>
        {GUEST_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
      </Field>
      <Row2>
        <Field label="Check-in" type="date" value={form.checkIn} onChange={setCheckIn} />
        <Field label="Nights" type="number" value={form.nights} onChange={setNights} />
      </Row2>
      <Row2>
        <Field label="Check-out (stay ends)" type="date" value={form.checkOut} onChange={set('checkOut')} />
        <Field label="Folio balance" type="number" value={form.folio} onChange={set('folio')} />
      </Row2>

      <h3 style={{ margin: '14px 0 8px' }}>Advance, part payment or refund</h3>

      <Row2>
        <Field as="select" label="Transaction" value={form.payType} onChange={set('payType')}>
          <option value="">None — only edit the stay</option>
          <option value="Advance">Advance</option>
          <option value="Part payment">Part payment</option>
          <option value="Refund">Refund</option>
        </Field>
        <Field label="Amount" type="number" value={form.payAmount} onChange={set('payAmount')} />
      </Row2>
      <Row2>
        <Field as="select" label="Mode" value={form.payMode} onChange={set('payMode')}>
          {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
        </Field>
        <Field label="Narration" value={form.payNarration} onChange={set('payNarration')} />
      </Row2>

      {form.payType && payAmount > 0 && (
        <table>
          <tbody>
            <tr><td>Folio now</td><td className="rt num">{money(Number(form.folio) || 0)}</td></tr>
            <tr>
              <td><b>Folio after {form.payType.toLowerCase()}</b></td>
              <td className="rt num" style={{ fontSize: 16, color: 'var(--ink)' }}>{money(projected)}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div style={{ background: 'var(--wash)', color: 'var(--blue)', borderRadius: 11, padding: '11px 12px', fontSize: 12.5, marginTop: 10 }}>
        One line only. Editing the stay never duplicates the original check-in
        entry, and a refund is posted as its own single debit — never as a
        reversal of an existing entry.
      </div>
      <div style={{ height: 12 }} />
    </Sheet>
  );
}
