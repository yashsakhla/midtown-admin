import { REQUEST_STATUS, requestType } from '../lib/requests';
import { useHotel } from '../store/HotelContext';
import ListRow from './ListRow';
import Pill from './Pill';

/** True while a request still needs action from the front desk. */
export const isPendingRequest = (r) => r.status !== 'DONE' && !r.expired;

/** One guest request: full row with action while open, compact row once closed. */
export default function RequestRow({ r }) {
  const { db, openSheet } = useHotel();

  if (r.status !== 'DONE' && r.stayActive) {
    const t = requestType(r.key, r.label);
    return (
      <ListRow>
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
  }

  return (
    <ListRow onClick={() => openSheet('request', { id: r.id })}>
      <div className="t" style={{ opacity: 0.7 }}>
        <b>{requestType(r.key, r.label).label}{r.room ? ` · Room ${r.room}` : ''}</b>
        <span>{r.remark || r.note || 'No remark'} · {r.time}{r.date && r.date !== db.date ? ` (${r.date})` : ''}</span>
      </div>
      <Pill tone={REQUEST_STATUS[r.expired ? 'EXPIRED' : r.status]?.tone}>
        {r.expired ? 'Expired — guest checked out' : REQUEST_STATUS[r.status]?.label}
      </Pill>
    </ListRow>
  );
}
