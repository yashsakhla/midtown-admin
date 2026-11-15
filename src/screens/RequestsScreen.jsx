import { useState } from 'react';
import Card from '../components/Card';
import Field from '../components/Field';
import ListRow from '../components/ListRow';
import RequestRow from '../components/RequestRow';
import { useHotel } from '../store/HotelContext';

/** Every guest request, filterable by date (defaults to today). */
export default function RequestsScreen() {
  const { db } = useHotel();
  const [date, setDate] = useState(db.date);

  const list = db.requests.filter((r) => !date || r.date === date);

  return (
    <>
      <Card body>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <button className="btn sm" onClick={() => setDate(db.date)}>Today</button>
          <button className="btn sm" onClick={() => setDate('')}>All dates</button>
        </div>
      </Card>

      <Card title={`Service requests (${list.length})`}>
        {list.length ? list.map((r) => <RequestRow key={r.id} r={r} />) : (
          <ListRow><span style={{ color: 'var(--muted)' }}>No requests for this date.</span></ListRow>
        )}
      </Card>
    </>
  );
}
