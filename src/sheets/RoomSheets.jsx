import { useEffect, useState } from 'react';
import DocumentFields, { emptyDoc } from '../components/DocumentFields';
import ImagePicker from '../components/ImagePicker';
import { DOC_REQUIRED } from '../lib/customers';
import { roomImg } from '../assets';
import Field, { Row2 } from '../components/Field';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import { addDays, money } from '../lib/format';
import { GUEST_OPTIONS, ROOM_CATEGORIES, ROOM_FEATURES, EXTRA_GUEST_CHARGE, extraChargeOf, extraGuests, nightsLeft, rateFor, shiftPreview } from '../lib/rooms';
import { useHotel } from '../store/HotelContext';

const STATUS_TEXT = {
  vacant: ['Vacant & clean', 'g'],
  occupied: ['Occupied', 'r'],
  dirty: ['Needs cleaning', 'o'],
  ooo: ['Out of order', 'n'],
  maintenance: ['Under maintenance', 'o']
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
        <button className="btn" onClick={() => openSheet('maintenance', { no })}>Mark under maintenance</button>
        <div style={{ height: 8 }} />
        <button className="btn" onClick={() => actions.setRoomStatus(no, 'ooo')}>Mark out of order</button>
      </>
    ),
    occupied: (
      <>
        <button className="btn p" onClick={() => openSheet('checkOut', { no })}>Check out &amp; settle</button>
        <div style={{ height: 8 }} />
        <button className="btn" onClick={() => { closeSheet(); setTab('food'); }}>Take room order</button>
        <div style={{ height: 8 }} />
        <button className="btn" onClick={() => openSheet('shiftRoom', { no })}>Shift to another room</button>
        <div style={{ height: 8 }} />
        <button className="btn" disabled={room.guests >= 4} onClick={() => openSheet('addGuest', { no })}>
          Add another guest{room.guests >= 4 ? ' (room full)' : ''}
        </button>
      </>
    ),
    dirty: (
      <>
        <button className="btn p" onClick={() => actions.setRoomStatus(no, 'vacant')}>
          Cleaning done, room ready
        </button>
        <div style={{ height: 8 }} />
        <button className="btn" onClick={() => openSheet('maintenance', { no })}>Mark under maintenance</button>
      </>
    ),
    maintenance: (
      <button className="btn p" onClick={() => actions.setRoomStatus(no, 'vacant')}>
        Maintenance done, back in service
      </button>
    ),
    ooo: (
      <button className="btn p" onClick={() => actions.setRoomStatus(no, 'vacant')}>Back in service</button>
    )
  };

  return (
    <Sheet
      title={`Room ${room.no} · ${room.type}`}
      footer={
        <>
          {actionsByStatus[room.status]}
          <div style={{ height: 8 }} />
          <button className="btn" onClick={() => openSheet('editRoom', { no })}>Edit room — price &amp; features</button>
        </>
      }
    >
      <RoomGallery room={room} />
      <Pill tone={tone}>{text}</Pill>
      {room.status === 'maintenance' && (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '8px 0 0' }}>
          Not available for booking{room.maintenance.reason ? ` — ${room.maintenance.reason}` : ''}
          {room.maintenance.until ? ` · expected back ${room.maintenance.until}` : ''}
        </p>
      )}
      {room.blurb && <p style={{ fontSize: 13, margin: '10px 0 0' }}>{room.blurb}</p>}
      {room.features.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {room.features.map((f) => <Pill key={f} tone="n">{f}</Pill>)}
        </div>
      )}

      <table style={{ marginTop: 12 }}>
        <tbody>
          <tr><td>Category</td><td className="rt">{room.category}</td></tr>
          <tr><td>Single price</td><td className="rt num">{money(room.singleRate)}</td></tr>
          <tr><td>Double price</td><td className="rt num">{money(room.doubleRate)}</td></tr>
          <tr><td>Each additional guest</td><td className="rt num">{money(extraChargeOf(room))} / night</td></tr>
          {room.beds && <tr><td>Beds</td><td className="rt">{room.beds}</td></tr>}
          {(room.size || room.sizeSqft) && <tr><td>Size</td><td className="rt">{[room.size, room.sizeSqft ? `${room.sizeSqft} sq ft` : ''].filter(Boolean).join(' · ')}</td></tr>}
          {room.sleeps && <tr><td>Sleeps</td><td className="rt num">{room.sleeps}</td></tr>}
          {room.guest && (
            <>
              <tr><td>Guests / rate</td><td className="rt num">{room.guests} · {money(room.stayRate)}/night</td></tr>
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

/** Hero photo plus thumbnails; falls back to the stock illustration when no photo was uploaded. */
function RoomGallery({ room }) {
  const [i, setI] = useState(0);
  const imgs = room.images || [];
  const src = imgs[i]?.url || roomImg(room.type);
  return (
    <div style={{ marginBottom: 12 }}>
      <img src={src} alt={`${room.type} room`} style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 12, display: 'block' }} />
      {imgs.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, overflowX: 'auto' }}>
          {imgs.map((m, k) => (
            <img key={m.id} src={m.url} alt="" onClick={() => setI(k)}
              style={{ width: 54, height: 40, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', outline: k === i ? '2px solid var(--blue)' : 'none' }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- add room */

export function AddRoomSheet({ floor }) {
  const { actions } = useHotel();
  const [form, setForm] = useState({
    no: '', floor: String(floor), category: 'Non AC', type: ROOM_CATEGORIES['Non AC'][0],
    singleRate: '', doubleRate: '', additionalGuestPrice: '', features: ['AC'], images: [],
    beds: '', blurb: '', size: '', sizeSqft: '', sleeps: ''
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setCategory = (e) => {
    const category = e.target.value;
    setForm((f) => ({ ...f, category, type: ROOM_CATEGORIES[category][0] }));
  };

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
        <Field as="select" label="Category" value={form.category} onChange={setCategory}>
          {Object.keys(ROOM_CATEGORIES).map((c) => <option key={c}>{c}</option>)}
        </Field>
        <Field as="select" label="Room type" value={form.type} onChange={set('type')}>
          {ROOM_CATEGORIES[form.category].map((t) => <option key={t}>{t}</option>)}
        </Field>
      </Row2>
      <Row2>
        <Field label="Single guest price" type="number" placeholder="per night" value={form.singleRate} onChange={set('singleRate')} />
        <Field label="Double guest price" type="number" placeholder="per night" value={form.doubleRate} onChange={set('doubleRate')} />
      </Row2>
      <Field label="Additional guest price" type="number" placeholder={`per extra person / night (default ${EXTRA_GUEST_CHARGE})`} value={form.additionalGuestPrice} onChange={set('additionalGuestPrice')} />
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>
        Set each price yourself. A third or fourth guest adds the additional guest price per person per night on top of the double price. Leave it blank to use {money(EXTRA_GUEST_CHARGE)}.
      </p>
      <RoomDetailFields form={form} set={set} />
      <FeaturePicker value={form.features} onChange={(features) => setForm((f) => ({ ...f, features }))} />
      <ImagePicker label="Room photos" files={form.images} onChange={(images) => setForm((f) => ({ ...f, images }))} />
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
    guest: '', phone: '', vehicle: '', guests: '1', doc: emptyDoc(), extraRooms: [],
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

  const [match, setMatch] = useState(null);          // returning customer found by phone
  const [replaceDoc, setReplaceDoc] = useState(false);
  useEffect(() => {
    const p = form.phone.replace(/\D/g, '');
    if (p.length < 10) { setMatch(null); return undefined; }
    let live = true;
    const t = setTimeout(async () => {
      const c = await actions.lookupCustomer(p);
      if (!live) return;
      setMatch(c);
      if (c) setForm((f) => ({ ...f, guest: f.guest || c.name }));
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [form.phone]); // eslint-disable-line react-hooks/exhaustive-deps
  const showDoc = !match?.hasDoc || replaceDoc;
  const mustUpload = DOC_REQUIRED && !match?.hasDoc;
  const picked = free.find((r) => r.no === form.room);
  const perNight = picked ? rateFor(picked, form.guests) : 0;
  const nightsN = Number(form.nights) || 1;
  const roomOptions = free.filter((r) => floorPick === 'all' || String(r.floor) === floorPick);

  /* ---- more rooms under the same guest / account ---- */
  const takenNos = [form.room, ...form.extraRooms.map((x) => x.room)];
  const addRoom = () => {
    const next = free.find((r) => !takenNos.includes(r.no));
    if (!next) return;
    setForm((f) => ({ ...f, extraRooms: [...f.extraRooms, { room: next.no, guests: '1' }] }));
  };
  const setExtra = (i, k, v) => setForm((f) => ({ ...f, extraRooms: f.extraRooms.map((x, n) => (n === i ? { ...x, [k]: v } : x)) }));
  const dropExtra = (i) => setForm((f) => ({ ...f, extraRooms: f.extraRooms.filter((_, n) => n !== i) }));
  const extraTotal = form.extraRooms.reduce((t, x) => {
    const r = free.find((q) => q.no === x.room);
    return t + (r ? rateFor(r, x.guests) * nightsN : 0);
  }, 0);

  return (
    <Sheet
      title="New check-in"
      footer={<button className="btn p" onClick={() => actions.checkIn({ ...form, customer: match, doc: showDoc ? form.doc : null, docRequired: mustUpload })}>Save check-in</button>}
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
            <option key={r.no} value={r.no}>{r.no} — {r.type} ({money(r.singleRate)} / {money(r.doubleRate)})</option>
          )) : <option value="">No vacant room on this floor</option>}
        </Field>
      </Row2>

      <Field label="Guest name" placeholder="As on ID proof" value={form.guest} onChange={set('guest')} />
      <Field as="select" label="Number of guests" value={form.guests} onChange={set('guests')}>
        {GUEST_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
      </Field>

      {form.extraRooms.map((x, i) => (
        <Row2 key={i}>
          <Field as="select" label={`Extra room ${i + 1}`} value={x.room} onChange={(e) => setExtra(i, 'room', e.target.value)}>
            {free.filter((r) => r.no === x.room || !takenNos.includes(r.no)).map((r) => (
              <option key={r.no} value={r.no}>{r.no} — {r.type} ({money(r.singleRate)} / {money(r.doubleRate)})</option>
            ))}
          </Field>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Field as="select" label="Guests" value={x.guests} onChange={(e) => setExtra(i, 'guests', e.target.value)}>
                {GUEST_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </Field>
            </div>
            <button type="button" className="btn sm" aria-label="Remove room" style={{ marginBottom: 12 }} onClick={() => dropExtra(i)}>✕</button>
          </div>
        </Row2>
      ))}
      {free.length > takenNos.length && (
        <button type="button" className="btn sm" style={{ marginBottom: 12 }} onClick={addRoom}>+ Add another room for this guest</button>
      )}

      <Row2>
        <Field label="Phone" type="tel" placeholder="Mobile" value={form.phone} onChange={set('phone')} />
        <Field label="Vehicle" placeholder="CG04 XX 0000" value={form.vehicle} onChange={set('vehicle')} />
      </Row2>

      {match ? (
        <div style={{ background: 'var(--wash)', color: 'var(--blue)', borderRadius: 11, padding: '10px 12px', fontSize: 13, marginBottom: 10 }}>
          <b>Returning customer — {match.name}</b>
          <div style={{ fontSize: 12.5 }}>
            {match.visits} previous visit{match.visits === 1 ? '' : 's'}
            {match.hasDoc ? ` · ${match.docType || 'ID'} already on file, no document needed` : ' · no ID on file yet'}
          </div>
          {match.hasDoc && (
            <button type="button" className="btn sm" style={{ marginTop: 6 }} onClick={() => setReplaceDoc((v) => !v)}>
              {replaceDoc ? 'Keep existing document' : 'Upload a new document'}
            </button>
          )}
        </div>
      ) : form.phone.replace(/\D/g, '').length >= 10 && (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>New customer — a profile is created at check-in.</p>
      )}

      {showDoc && (
        <>
          <h3 style={{ margin: '6px 0 8px', fontSize: 14 }}>
            ID document{mustUpload ? ' (required)' : ' (optional)'}
          </h3>
          <DocumentFields value={form.doc} onChange={(doc) => setForm((f) => ({ ...f, doc }))} />
        </>
      )}

      <Row2>
        <Field label="Check-in date" type="date" value={form.date} onChange={setDate} />
        <Field label="Nights" type="number" value={form.nights} onChange={setNights} />
      </Row2>

      <Field label="Check-out date (stay ends)" type="date" value={form.checkOut} onChange={set('checkOut')} />

      {picked && (
        <table>
          <tbody>
            <tr><td>{picked.type} · {Number(form.guests) >= 2 ? 'Double' : 'Single'}{extraGuests(form.guests) > 0 ? ` + ${extraGuests(form.guests)} extra (${money(extraChargeOf(picked))} each)` : ''}</td><td className="rt num">{money(perNight)} / night</td></tr>
            <tr><td><b>Room charge · {nightsN} night{nightsN > 1 ? 's' : ''}</b></td><td className="rt num" style={{ color: 'var(--ink)' }}>{money(perNight * nightsN)}</td></tr>
            {form.extraRooms.length > 0 && (
              <>
                <tr><td>{form.extraRooms.length} more room{form.extraRooms.length > 1 ? 's' : ''} ({form.extraRooms.map((x) => x.room).join(', ')})</td><td className="rt num">{money(extraTotal)}</td></tr>
                <tr><td><b>Total for {form.extraRooms.length + 1} rooms</b></td><td className="rt num" style={{ color: 'var(--ink)' }}>{money(perNight * nightsN + extraTotal)}</td></tr>
              </>
            )}
          </tbody>
        </table>
      )}
      <div style={{ height: 8 }} />

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

/* ------------------------------------------------------- internal room shift */

export function ShiftRoomSheet({ no, requestId }) {
  const { db, actions } = useHotel();
  const room = db.rooms.find((r) => r.no === no);
  const free = db.rooms.filter((r) => r.status === 'vacant');
  const req = db.requests.find((x) => x.id === requestId);
  const [form, setForm] = useState({
    toRoom: free[0]?.no || '', guests: String(room?.guests || 1), reason: req?.note || '', requestId
  });
  if (!room) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const target = free.find((r) => r.no === form.toRoom);
  const newRate = target ? rateFor(target, form.guests) : 0;
  const left = Math.max(0, Math.round((new Date(room.checkOut || db.date) - new Date(db.date)) / 86400000));
  const used = Math.max(0, room.nights - left);
  const p = shiftPreview({ oldRate: room.stayRate, newRate, nights: room.nights, nightsUsed: used });
  const tone = { upgrade: 'o', downgrade: 'g', same: 'n' }[p.kind];
  const word = { upgrade: 'Upgrade', downgrade: 'Downgrade', same: 'Same price' }[p.kind];

  return (
    <Sheet
      title={`Shift guest — room ${no}`}
      footer={
        <button className="btn p" disabled={!target} onClick={() => actions.shiftRoom(no, form)}>
          {requestId ? 'Approve shift' : 'Shift'} &amp; adjust folio
        </button>
      }
    >
      <Field label="Guest" value={room.guest || ''} disabled readOnly />
      {req?.note && (
        <div style={{ background: 'var(--bg)', borderRadius: 11, padding: '11px 12px', marginBottom: 10, fontSize: 13 }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 3 }}>Guest request</div>
          “{req.note}”
        </div>
      )}
      <Row2>
        <Field as="select" label="Shift to room" value={form.toRoom} onChange={set('toRoom')}>
          {free.length ? free.map((r) => (
            <option key={r.no} value={r.no}>{r.no} — {r.type}</option>
          )) : <option value="">No vacant room</option>}
        </Field>
        <Field as="select" label="Guests" value={form.guests} onChange={set('guests')}>
          {GUEST_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </Field>
      </Row2>
      <Field label="Reason" placeholder="AC not working, guest asked for upgrade…" value={form.reason} onChange={set('reason')} />

      {target && (
        <table style={{ marginTop: 6 }}>
          <tbody>
            <tr><td>Current — room {room.no}, {room.type}</td><td className="rt num">{money(room.stayRate)} / night</td></tr>
            <tr><td>New — room {target.no}, {target.type}</td><td className="rt num">{money(newRate)} / night</td></tr>
            <tr>
              <td><Pill tone={tone}>{word}</Pill> &nbsp;{p.remaining} night{p.remaining === 1 ? '' : 's'} left</td>
              <td className="rt num" style={{ color: 'var(--ink)' }}>
                {p.adjustment > 0 ? '+' : ''}{money(p.adjustment)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0' }}>
        Nights already stayed stay at the old price; remaining nights use the new room's price.
        The old room goes to housekeeping.
      </p>

      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 14px' }}>
        {requestId ? "Approving completes the guest's room-shift request." : 'Shifted by the manager directly; the guest can also request a shift from the app.'}
      </p>
    </Sheet>
  );
}

/* ------------------------------------------------------- add another guest */

export function AddGuestSheet({ no }) {
  const { db, actions } = useHotel();
  const room = db.rooms.find((r) => r.no === no);
  const [form, setForm] = useState({ name: '', phone: '', doc: emptyDoc() });
  if (!room) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const next = room.guests + 1;
  const full = room.guests >= 4;
  const newRate = rateFor(room, next);
  const left = nightsLeft(room, db.date);
  const perNight = newRate - room.stayRate;
  const how = room.guests === 1
    ? 'Single becomes double: the double price applies.'
    : `Extra person on a double room: ${money(extraChargeOf(room))} per night is added.`;

  return (
    <Sheet
      title={`Add a guest — room ${no}`}
      footer={
        <button className="btn p" disabled={full} onClick={() => actions.addGuest(no, form)}>
          Add guest &amp; update price
        </button>
      }
    >
      <Field label="Main guest" value={room.guest || ''} disabled readOnly />
      <Row2>
        <Field label="New guest name" placeholder="Optional" value={form.name} onChange={set('name')} />
        <Field label="Phone" type="tel" placeholder="Optional" value={form.phone} onChange={set('phone')} />
      </Row2>

      <table style={{ marginTop: 4 }}>
        <tbody>
          <tr><td>Now — {room.guests} guest{room.guests === 1 ? '' : 's'}</td><td className="rt num">{money(room.stayRate)} / night</td></tr>
          <tr><td>After — {next} guests</td><td className="rt num">{money(newRate)} / night</td></tr>
          <tr><td>Change per night</td><td className="rt num">{perNight > 0 ? '+' : ''}{money(perNight)}</td></tr>
          <tr>
            <td><b>Added to folio · {left} night{left === 1 ? '' : 's'} left</b></td>
            <td className="rt num" style={{ color: 'var(--ink)' }}>{money(perNight * left)}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0' }}>
        {full ? 'This room already has the maximum of 4 guests.' : how} Nights already stayed keep the old price.
      </p>

      <h3 style={{ margin: '10px 0 8px', fontSize: 14 }}>Guest ID (optional)</h3>
      <DocumentFields label="ID document" value={form.doc} onChange={(doc) => setForm((f) => ({ ...f, doc }))} />
      <div style={{ height: 12 }} />
    </Sheet>
  );
}

/* ------------------------------------------------------------ room features */

/** Beds, size, capacity and the short description shown for a room. */
function RoomDetailFields({ form, set }) {
  return (
    <>
      <Row2>
        <Field label="Beds" placeholder="1 King bed / 2 Single beds" value={form.beds} onChange={set('beds')} />
        <Field label="Sleeps" type="number" placeholder="Max people" value={form.sleeps} onChange={set('sleeps')} />
      </Row2>
      <Row2>
        <Field label="Size" placeholder="e.g. 22 sq m" value={form.size} onChange={set('size')} />
        <Field label="Size (sq ft)" type="number" placeholder="e.g. 240" value={form.sizeSqft} onChange={set('sizeSqft')} />
      </Row2>
      <Field as="textarea" rows={2} label="Short description (blurb)" placeholder="One or two lines shown to guests" value={form.blurb} onChange={set('blurb')} />
    </>
  );
}

function FeaturePicker({ value, onChange }) {
  const toggle = (f) => onChange(value.includes(f) ? value.filter((x) => x !== f) : [...value, f]);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}>Features</div>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {ROOM_FEATURES.map((f) => (
          <button key={f} type="button" className={value.includes(f) ? 'on' : ''} onClick={() => toggle(f)}>{f}</button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- edit a room */

export function EditRoomSheet({ no }) {
  const { db, actions } = useHotel();
  const room = db.rooms.find((r) => r.no === no);
  const [form, setForm] = useState(() => ({
    floor: String(room?.floor ?? 1), category: room?.category || 'AC', type: room?.type || ROOM_CATEGORIES.AC[0],
    singleRate: String(room?.singleRate ?? ''), doubleRate: String(room?.doubleRate ?? ''),
    additionalGuestPrice: room?.additionalGuestPrice == null ? '' : String(room.additionalGuestPrice),
    beds: room?.beds || '', blurb: room?.blurb || '', size: room?.size || '',
    sizeSqft: room?.sizeSqft == null ? '' : String(room.sizeSqft), sleeps: room?.sleeps == null ? '' : String(room.sleeps),
    features: room?.features || [], description: room?.description || '', images: [], removeImages: []
  }));
  if (!room) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setCategory = (e) => {
    const category = e.target.value;
    setForm((f) => ({ ...f, category, type: ROOM_CATEGORIES[category].includes(f.type) ? f.type : ROOM_CATEGORIES[category][0] }));
  };
  const types = ROOM_CATEGORIES[form.category];

  return (
    <Sheet
      title={`Edit room ${no}`}
      footer={<button className="btn p" onClick={() => actions.updateRoom(no, form)}>Save changes</button>}
    >
      {room.status === 'occupied' && (
        <div style={{ background: 'var(--ow)', color: '#A55A00', borderRadius: 11, padding: '10px 12px', fontSize: 12.5, marginBottom: 10 }}>
          A guest is staying here. New prices apply to future check-ins only; the current stay keeps its price.
        </div>
      )}
      <Row2>
        <Field as="select" label="Category" value={form.category} onChange={setCategory}>
          {Object.keys(ROOM_CATEGORIES).map((c) => <option key={c}>{c}</option>)}
        </Field>
        <Field as="select" label="Room type" value={form.type} onChange={set('type')}>
          {types.map((t) => <option key={t}>{t}</option>)}
        </Field>
      </Row2>
      <Row2>
        <Field label="Single guest price" type="number" value={form.singleRate} onChange={set('singleRate')} />
        <Field label="Double guest price" type="number" value={form.doubleRate} onChange={set('doubleRate')} />
      </Row2>
      <Field label="Additional guest price" type="number" placeholder={`per extra person / night (default ${EXTRA_GUEST_CHARGE})`} value={form.additionalGuestPrice} onChange={set('additionalGuestPrice')} />
      <Field label="Floor" type="number" value={form.floor} onChange={set('floor')} />
      <RoomDetailFields form={form} set={set} />
      <FeaturePicker value={form.features} onChange={(features) => setForm((f) => ({ ...f, features }))} />
      <ImagePicker
        label="Room photos" files={form.images} onChange={(images) => setForm((f) => ({ ...f, images }))}
        existing={(room.images || []).filter((m) => !form.removeImages.some((x) => x.id === m.id))}
        onRemoveExisting={(img) => setForm((f) => ({ ...f, removeImages: [...f.removeImages, img] }))}
      />
      <Field label="Notes" placeholder="Bed size, view, anything the desk should know" value={form.description} onChange={set('description')} />
      <div style={{ height: 12 }} />
    </Sheet>
  );
}

/* ------------------------------------------------------------- maintenance */

export function MaintenanceSheet({ no }) {
  const { db, actions } = useHotel();
  const room = db.rooms.find((r) => r.no === no);
  const [form, setForm] = useState({ reason: '', until: '' });
  if (!room) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Sheet
      title={`Maintenance — room ${no}`}
      footer={
        <button className="btn p" onClick={() => actions.setRoomStatus(no, 'maintenance', {
          reason: form.reason.trim() || undefined, expectedBackDate: form.until || undefined
        })}>
          Mark under maintenance
        </button>
      }
    >
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        {['AC repair', 'Plumbing', 'Electrical', 'Painting', 'Furniture', 'Deep cleaning'].map((t) => (
          <button key={t} type="button" className={form.reason === t ? 'on' : ''} onClick={() => setForm((f) => ({ ...f, reason: t }))}>{t}</button>
        ))}
      </div>
      <Field label="Reason" placeholder="What needs fixing" value={form.reason} onChange={set('reason')} />
      <Field label="Expected back in service (optional)" type="date" value={form.until} onChange={set('until')} />
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
        The room cannot be checked into or booked until you mark it back in service.
      </p>
    </Sheet>
  );
}
