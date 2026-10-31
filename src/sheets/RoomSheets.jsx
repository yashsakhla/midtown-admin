import { useState } from 'react';
import { ROOM_IMG } from '../assets';
import Field, { Row2 } from '../components/Field';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import { addDays, money } from '../lib/format';
import { useHotel } from '../store/HotelContext';

const STATUS_TEXT = {
  vacant: ['Vacant & clean', 'g'],
  occupied: ['Occupied', 'r'],
  dirty: ['Needs cleaning', 'o'],
  ooo: ['Out of order', 'n']
};

/* ------------------------------------------------------------ room detail */

export function RoomSheet({ no }) {
  const { db, openSheet, closeSheet, setTab, actions } = useHotel();
  const room = db.rooms.find((r) => r.no === no);
  if (!room) return null;

  const [text, tone] = STATUS_TEXT[room.status];

  const actionsByStatus = {
    vacant: (
      <>
        <button className="btn p" onClick={() => { closeSheet(); openSheet('checkIn', { room: no }); }}>
          Check in a guest
        </button>
        <div style={{ height: 8 }} />
        <button className="btn" onClick={() => actions.setRoomStatus(no, 'ooo')}>Mark out of order</button>
      </>
    ),
    occupied: (
      <>
        <button className="btn p" onClick={() => openSheet('checkOut', { no })}>Check out &amp; settle</button>
        <div style={{ height: 8 }} />
        <button className="btn" onClick={() => { closeSheet(); setTab('food'); }}>Take room order</button>
      </>
    ),
    dirty: (
      <button className="btn p" onClick={() => actions.setRoomStatus(no, 'vacant')}>
        Cleaning done, room ready
      </button>
    ),
    ooo: (
      <button className="btn p" onClick={() => actions.setRoomStatus(no, 'vacant')}>Back in service</button>
    )
  };

  return (
    <Sheet title={`Room ${room.no} · ${room.type}`} footer={actionsByStatus[room.status]}>
      <img
        src={ROOM_IMG[room.type]}
        alt={`${room.type} room`}
        style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }}
      />
      <Pill tone={tone}>{text}</Pill>

      <table style={{ marginTop: 12 }}>
        <tbody>
          <tr><td>Tariff</td><td className="rt num">{money(room.rate)}</td></tr>
          {room.guest && (
            <>
              <tr><td>Guest</td><td className="rt">{room.guest}</td></tr>
              <tr><td>Phone</td><td className="rt num">{room.phone}</td></tr>
              <tr><td>Vehicle</td><td className="rt">{room.vehicle}</td></tr>
              <tr><td>Folio balance</td><td className="rt num">{money(room.folio)}</td></tr>
              <tr><td>Check-in</td><td className="rt num">{room.checkIn || '—'}</td></tr>
              <tr><td>Check-out</td><td className="rt num">{room.checkOut || '—'}</td></tr>
            </>
          )}
        </tbody>
      </table>
      <div style={{ height: 14 }} />
    </Sheet>
  );
}

/* --------------------------------------------------------------- add room */

export function AddRoomSheet({ floor }) {
  const { db, actions } = useHotel();
  const [form, setForm] = useState({
    no: '', floor: String(floor), type: 'Standard', rate: String(db.tariff.Standard)
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setType = (e) => setForm((f) => ({ ...f, type: e.target.value, rate: String(db.tariff[e.target.value]) }));

  return (
    <Sheet
      title={`Add a room — floor ${floor}`}
      footer={<button className="btn p" onClick={() => actions.addRoom(form)}>Add room</button>}
    >
      <Row2>
        <Field label="Room number" placeholder={`${floor}07`} value={form.no} onChange={set('no')} />
        <Field label="Floor" type="number" value={form.floor} onChange={set('floor')} />
      </Row2>
      <Row2>
        <Field as="select" label="Room type" value={form.type} onChange={setType}>
          {Object.keys(db.tariff).map((t) => <option key={t}>{t}</option>)}
        </Field>
        <Field label="Tariff" type="number" value={form.rate} onChange={set('rate')} />
      </Row2>
    </Sheet>
  );
}

/* --------------------------------------------------------------- check in */

export function CheckInSheet({ room: preselected }) {
  const { db, actions } = useHotel();
  const free = db.rooms.filter((r) => r.status === 'vacant');
  const floors = [...new Set(free.map((r) => r.floor))].sort((a, b) => a - b);

  const [floorPick, setFloorPick] = useState('all');
  const [form, setForm] = useState({
    room: preselected || free[0]?.no || '',
    guest: '', phone: '', vehicle: '',
    date: db.date, nights: '1', checkOut: addDays(db.date, 1),
    amount: '', mode: 'Cash', dc: 'credit', narration: ''
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /** Keep the check-out date in step with check-in date and nights. */
  const setDate = (e) => {
    const date = e.target.value;
    setForm((f) => ({ ...f, date, checkOut: addDays(date, Number(f.nights) || 1) }));
  };
  const setNights = (e) => {
    const nights = e.target.value;
    setForm((f) => ({ ...f, nights, checkOut: addDays(f.date, Number(nights) || 1) }));
  };

  const roomOptions = free.filter((r) => floorPick === 'all' || String(r.floor) === floorPick);

  return (
    <Sheet
      title="New check-in"
      footer={<button className="btn p" onClick={() => actions.checkIn(form)}>Save check-in</button>}
    >
      <Row2>
        <Field
          as="select" label="Floor" value={floorPick}
          onChange={(e) => {
            const v = e.target.value;
            setFloorPick(v);
            const first = free.find((r) => v === 'all' || String(r.floor) === v);
            setForm((f) => ({ ...f, room: first ? first.no : '' }));
          }}
        >
          <option value="all">All floors</option>
          {floors.map((f) => <option key={f} value={f}>Floor {f}</option>)}
        </Field>

        <Field as="select" label="Room number" value={form.room} onChange={set('room')}>
          {roomOptions.length ? roomOptions.map((r) => (
            <option key={r.no} value={r.no}>{r.no} — {r.type} ({money(r.rate)})</option>
          )) : <option value="">No vacant room on this floor</option>}
        </Field>
      </Row2>

      <Field label="Guest name" placeholder="As on ID proof" value={form.guest} onChange={set('guest')} />

      <Row2>
        <Field label="Phone" type="tel" placeholder="Mobile" value={form.phone} onChange={set('phone')} />
        <Field label="Vehicle" placeholder="CG04 XX 0000" value={form.vehicle} onChange={set('vehicle')} />
      </Row2>

      <Row2>
        <Field label="Check-in date" type="date" value={form.date} onChange={setDate} />
        <Field label="Nights" type="number" value={form.nights} onChange={setNights} />
      </Row2>

      <Field label="Check-out date (stay ends)" type="date" value={form.checkOut} onChange={set('checkOut')} />

      <Row2>
        <Field label="Amount received" type="number" placeholder="0" value={form.amount} onChange={set('amount')} />
        <Field as="select" label="Mode" value={form.mode} onChange={set('mode')}>
          {['Cash', 'UPI', 'Card', 'Bank'].map((m) => <option key={m}>{m}</option>)}
        </Field>
      </Row2>

      <Field as="select" label="Credit / debit" value={form.dc} onChange={set('dc')}>
        <option value="credit">Credit — received</option>
        <option value="debit">Debit — paid out</option>
      </Field>

      <Field label="Narration" placeholder="Advance for 2 nights…" value={form.narration} onChange={set('narration')} />
    </Sheet>
  );
}

/* -------------------------------------------------------------- check out */

export function CheckOutSheet({ no }) {
  const { db, actions } = useHotel();
  const room = db.rooms.find((r) => r.no === no);
  const [form, setForm] = useState({
    amount: String(room?.folio ?? 0), mode: 'Cash', narration: 'Final settlement'
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  if (!room) return null;

  return (
    <Sheet
      title={`Check out — Room ${no}`}
      footer={<button className="btn p" onClick={() => actions.checkOut(no, form)}>Settle &amp; check out</button>}
    >
      <Field label="Guest" value={room.guest || ''} disabled readOnly />
      <Row2>
        <Field label="Balance to collect" type="number" value={form.amount} onChange={set('amount')} />
        <Field as="select" label="Mode" value={form.mode} onChange={set('mode')}>
          {['Cash', 'UPI', 'Card', 'Bank'].map((m) => <option key={m}>{m}</option>)}
        </Field>
      </Row2>
      <Field label="Narration" value={form.narration} onChange={set('narration')} />
      <div style={{ background: 'var(--ow)', color: '#A55A00', borderRadius: 11, padding: '11px 12px', fontSize: 12.5 }}>
        Room turns orange for housekeeping until cleaning is marked done.
      </div>
      <div style={{ height: 12 }} />
    </Sheet>
  );
}
