import { HERO } from '../assets';
import Card from '../components/Card';
import { Kpi, KpiGrid } from '../components/Kpi';
import ListRow from '../components/ListRow';
import Pill from '../components/Pill';
import RoomCard from '../components/RoomCard';
import { REQUEST_STATUS, requestType } from '../lib/requests';
import { money } from '../lib/format';
import {
  cashInHand, countRooms, floors, lowStock, occupancyPct, totalReceipt
} from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

export default function HomeScreen() {
  const { db, setTab, openSheet, actions } = useHotel();
  const open = db.requests.filter((r) => r.status !== 'DONE' && r.stayActive);
  const closed = db.requests.filter((r) => !open.includes(r)).slice(0, 6);

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

      <Card title={`Guest requests${open.length ? ` (${open.length})` : ''}`}>
        {open.length ? open.map((r) => {
          const t = requestType(r.key, r.label);
          return (
            <ListRow key={r.id}>
              <div className="t">
                <b>{t.icon} {t.label} · Room {r.room}</b>
                <span>{r.guest}{r.phone ? ` · ${r.phone}` : ''} · In-house{r.checkOut ? ` until ${r.checkOut}` : ''}</span>
                {r.note && <span style={{ color: 'var(--ink)' }}>“{r.note}”</span>}
                <span>Sent {r.time}{r.date && r.date !== db.date ? ` (${r.date})` : ''}</span>
              </div>
              <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                <Pill tone={REQUEST_STATUS[r.status]?.tone}>{REQUEST_STATUS[r.status]?.label}</Pill>
                <button className="btn sm p" onClick={() => openSheet('request', { id: r.id })}>View request</button>
              </div>
            </ListRow>
          );
        }) : (
          <ListRow><span style={{ color: 'var(--muted)' }}>No pending guest requests.</span></ListRow>
        )}
        {closed.map((r) => (
          <ListRow key={r.id} onClick={() => openSheet('request', { id: r.id })}>
            <div className="t" style={{ opacity: 0.7 }}>
              <b>{requestType(r.key, r.label).label}{r.room ? ` · Room ${r.room}` : ''}</b>
              <span>{r.remark || r.note || 'No remark'} · {r.time}</span>
            </div>
            <Pill tone={REQUEST_STATUS[r.expired ? 'EXPIRED' : r.status]?.tone}>
              {r.expired ? 'Expired — guest checked out' : REQUEST_STATUS[r.status]?.label}
            </Pill>
          </ListRow>
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
