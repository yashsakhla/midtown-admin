import { HERO } from '../assets';
import Card from '../components/Card';
import { Kpi, KpiGrid } from '../components/Kpi';
import ListRow from '../components/ListRow';
import Pill from '../components/Pill';
import RequestRow, { isPendingRequest } from '../components/RequestRow';
import RoomCard from '../components/RoomCard';
import {
  countRooms, floors, lowStock, occupancyPct
} from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

const MAX_HOME_REQUESTS = 7;

export default function HomeScreen() {
  const { db, setTab, openSheet, actions } = useHotel();
  // Today's requests of every kind, plus older ones only while still pending.
  const shown = db.requests.filter((r) => r.date === db.date || (r.date < db.date && isPendingRequest(r)));
  const visible = shown.slice(0, MAX_HOME_REQUESTS);
  const pendingReq = shown.filter(isPendingRequest).length;
  const doneReq = shown.filter((r) => r.status === 'DONE').length;

  const arrivals = db.bookings.filter((b) => b.status === 'Arriving').length;
  const upcoming = db.bookings.filter((b) => b.status !== 'Cancelled');
  const low = lowStock(db);
  const foodOrders = (db.kots?.length || 0) + (db.online?.length || 0);

  return (
    <>
      <div className="hero">
        <img src={HERO} alt="The Midtown Hotel" />
        <div className="ov">
          <div className="eyebrow">Welcome to</div>
          <h2>The Midtown Hotel</h2>
          <p>
            {countRooms(db, 'occupied')} occupied · {arrivals} arrivals · {pendingReq} pending requests
          </p>
        </div>
        <div className="quote"><i />“Hospitality makes every stay a story worth sharing.”</div>
      </div>

      <KpiGrid>
        <Kpi icon="users" tone="green" value={`${occupancyPct(db)}%`} label="Occupancy" note={`${countRooms(db, 'occupied')} of ${db.rooms.length} rooms occupied`} onClick={() => setTab('rooms')} />
        <Kpi icon="broom" tone="red" value={countRooms(db, 'dirty')} label="Rooms to clean" note="housekeeping pending" onClick={() => setTab('rooms')} />
        <Kpi icon="bell" tone="orange" value={shown.length} label="Service requests" note="today + old pending" breakdown={[['Pending', pendingReq], ['Completed', doneReq]]} onClick={() => document.getElementById('guest-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        <Kpi icon="food" tone="blue" value={foodOrders} label="Food orders" note="room service + online today" onClick={() => setTab('food')} />
        <Kpi icon="calendar" tone="gold" value={arrivals} label="Arrivals today" note="OTA and phone bookings" onClick={() => setTab('bookings')} />
      </KpiGrid>

      <Card
        title="Room board"
        action={<button className="btn sm" onClick={() => setTab('rooms')}>Open</button>}
        body
      >
        {floors(db).map((f) => (
          <div key={f}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, margin: '6px 0' }}>
              Floor {f}
            </div>
            <div className="rooms">
              {db.rooms.filter((r) => r.floor === f).map((r) => (
                <RoomCard key={r.no} room={r} onClick={(no) => openSheet('room', { no })} />
              ))}
            </div>
          </div>
        ))}
      </Card>

      <div id="guest-requests">
        <Card
          title={`Service requests${shown.length ? ` (${shown.length})` : ''}`}
          action={<button className="btn sm" onClick={() => setTab('requests')}>Check old requests</button>}
        >
          {visible.length ? visible.map((r) => <RequestRow key={r.id} r={r} />) : (
            <ListRow><span style={{ color: 'var(--muted)' }}>No service requests today.</span></ListRow>
          )}
          {shown.length > MAX_HOME_REQUESTS && (
            <ListRow>
              <button className="btn sm" onClick={() => setTab('requests')}>
                Show more ({shown.length - MAX_HOME_REQUESTS})
              </button>
            </ListRow>
          )}
        </Card>
      </div>

      <Card title="Arrivals today">
        {upcoming.length ? upcoming.map((b) => (
          <ListRow
            key={b.id}
            title={b.guest}
            sub={`${b.src} · ${b.type} · ${b.pax} guests`}
            right={<Pill tone={b.pay === 'Prepaid' ? 'g' : 'n'}>{b.pay || 'Not opted'}</Pill>}
          />
        )) : (
          <ListRow><span style={{ color: 'var(--muted)' }}>No arrivals pending.</span></ListRow>
        )}
      </Card>

      <Card title="Stock running low">
        {low.length ? low.map((s) => (
          <ListRow
            key={s.item}
            title={s.item}
            sub={`minimum ${s.min} ${s.unit}`}
            right={<span className="num" style={{ color: 'var(--red)' }}>{s.qty}</span>}
          />
        )) : (
          <ListRow><span style={{ color: 'var(--muted)' }}>All items above minimum.</span></ListRow>
        )}
      </Card>
    </>
  );
}
