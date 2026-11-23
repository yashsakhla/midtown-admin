import { useState } from 'react';
import { HERO } from '../assets';
import Card from '../components/Card';
import Field, { Row2 } from '../components/Field';
import RoomCard, { AddRoomCard } from '../components/RoomCard';
import { categoryOf } from '../lib/rooms';
import { money } from '../lib/format';
import { countRooms, floors } from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

export default function RoomsScreen() {
  const { db, openSheet, actions } = useHotel();
  const [floorFilter, setFloorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const matchesType = (r) => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'AC' || typeFilter === 'Non AC') {
      const cat = /^non\s*-?\s*ac/i.test(r.category || '') || r.category === 'NON_AC' ? 'Non AC' : r.category === 'AC' ? 'AC' : categoryOf(r.type);
      return cat === typeFilter;
    }
    return new RegExp(typeFilter, 'i').test(r.type || '');
  };

  const allFloors = floors(db);
  const visibleFloors = allFloors.filter((f) => floorFilter === 'all' || String(f) === floorFilter);
  const jumpList = db.rooms.filter((r) => (floorFilter === 'all' || String(r.floor) === floorFilter) && matchesType(r));

  return (
    <div
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,.82), rgba(255,255,255,.9)), url(${HERO})`,
        backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 16, padding: 12
      }}
    >
      <Card body>
        <Row2>
          <Field
            as="select"
            label="Floor"
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
          >
            <option value="all">All floors</option>
            {allFloors.map((f) => <option key={f} value={f}>Floor {f}</option>)}
          </Field>

          <Field
            as="select"
            label="Jump to room"
            value=""
            onChange={(e) => { if (e.target.value) openSheet('room', { no: e.target.value }); }}
          >
            <option value="">— select a room —</option>
            {jumpList.map((r) => (
              <option key={r.no} value={r.no}>
                {r.no} · {r.type} · {r.status === 'occupied' ? (r.guest || 'Occupied') : r.status}
              </option>
            ))}
          </Field>
        </Row2>
        <Field
          as="select"
          label="Filter by category"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All categories</option>
          <option value="AC">AC</option>
          <option value="Non AC">Non AC</option>
          <option value="Standard">Standard</option>
          <option value="Deluxe">Deluxe</option>
          <option value="Executive">Executive</option>
        </Field>
      </Card>

      <div className="legend">
        <span><i style={{ background: 'var(--green)' }} />Vacant {countRooms(db, 'vacant')}</span>
        <span><i style={{ background: '#3B82F6' }} />Prebooked {countRooms(db, 'prebooked')}</span>
        <span><i style={{ background: 'var(--red)' }} />Occupied {countRooms(db, 'occupied')}</span>
        <span><i style={{ background: 'var(--orange)' }} />To clean {countRooms(db, 'dirty')}</span>
        <span><i style={{ background: '#7A6AB8' }} />Maintenance {countRooms(db, 'maintenance')}</span>
        <span><i style={{ background: '#B8C2CE' }} />Blocked {countRooms(db, 'ooo')}</span>
      </div>

      {visibleFloors.map((f) => (
        <Card key={f} title={`Floor ${f}`} body>
          <div className="rooms">
            {db.rooms.filter((r) => r.floor === f && matchesType(r)).map((r) => (
              <RoomCard key={r.no} room={r} onClick={(no) => openSheet('room', { no })} />
            ))}
            <AddRoomCard onClick={() => openSheet('addRoom', { floor: f })} />
          </div>
        </Card>
      ))}

      <button className="btn" onClick={actions.markAllClean}>Mark all cleaned</button>
      <div style={{ height: 10 }} />
      <button
        className="btn"
        onClick={() => openSheet('addRoom', { floor: Math.max(...allFloors) + 1 })}
      >
        + Add a new floor
      </button>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10 }}>
        Single / double — {[...new Map(db.rooms.map((r) => [r.type, r])).values()].map((r) => `${r.type} ${money(r.singleRate)}/${money(r.doubleRate)}`).join(' · ')}
      </p>
    </div>
  );
}
