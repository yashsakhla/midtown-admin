import { HERO } from '../assets';
import Card from '../components/Card';
import { Kpi, KpiGrid } from '../components/Kpi';
import ListRow from '../components/ListRow';
import Pill from '../components/Pill';
import RoomCard from '../components/RoomCard';
import { money } from '../lib/format';
import {
  cashInHand, countRooms, floors, lowStock, occupancyPct, totalReceipt
} from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

export default function HomeScreen() {
  const { db, setTab, openSheet } = useHotel();

  const arrivals = db.bookings.filter((b) => b.status === 'Arriving').length;
  const upcoming = db.bookings.filter((b) => b.status !== 'Cancelled');
  const low = lowStock(db);

  return (
    <>
      <div className="hero">
        <img src={HERO} alt="The Midtown Hotel" />
        <div className="ov">
          <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>Welcome to</div>
          <h2>The Midtown Hotel</h2>
          <p>
            {countRooms(db, 'occupied')} occupied · {arrivals} arrivals · {money(totalReceipt(db))} collected
          </p>
        </div>
      </div>

      <KpiGrid>
        <Kpi value={`${occupancyPct(db)}%`} label="Occupancy today" />
        <Kpi value={money(totalReceipt(db))} label="Total receipt" />
        <Kpi value={money(cashInHand(db))} label="Cash in hand" />
        <Kpi value={countRooms(db, 'dirty')} label="Rooms to clean" />
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

      <Card title="Arrivals today">
        {upcoming.length ? upcoming.map((b) => (
          <ListRow
            key={b.id}
            title={b.guest}
            sub={`${b.src} · ${b.type} · ${b.pax} guests`}
            right={<Pill tone={b.pay === 'Prepaid' ? 'g' : 'n'}>{b.pay}</Pill>}
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
