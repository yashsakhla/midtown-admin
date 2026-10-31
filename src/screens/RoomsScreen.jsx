import { useState } from 'react';
import Card from '../components/Card';
import Field, { Row2 } from '../components/Field';
import RoomCard, { AddRoomCard } from '../components/RoomCard';
import { money } from '../lib/format';
import { countRooms, floors } from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

export default function RoomsScreen() {
  const { db, openSheet, actions } = useHotel();
  const [floorFilter, setFloorFilter] = useState('all');

  const allFloors = floors(db);
  const visibleFloors = allFloors.filter((f) => floorFilter === 'all' || String(f) === floorFilter);
  const jumpList = db.rooms.filter((r) => floorFilter === 'all' || String(r.floor) === floorFilter);

  return (
    <>
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
      </Card>

      <div className="legend">
        <span><i style={{ background: 'var(--green)' }} />Vacant {countRooms(db, 'vacant')}</span>
        <span><i style={{ background: 'var(--red)' }} />Occupied {countRooms(db, 'occupied')}</span>
        <span><i style={{ background: 'var(--orange)' }} />To clean {countRooms(db, 'dirty')}</span>
        <span><i style={{ background: '#B8C2CE' }} />Blocked {countRooms(db, 'ooo')}</span>
      </div>

      {visibleFloors.map((f) => (
        <Card key={f} title={`Floor ${f}`} body>
          <div className="rooms">
            {db.rooms.filter((r) => r.floor === f).map((r) => (
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
        Tariffs — {Object.entries(db.tariff).map(([t, r]) => `${t} ${money(r)}`).join(' · ')}
      </p>
    </>
  );
}
