import { addDays, fmtDate } from '../lib/format';
import { useHotel } from '../store/HotelContext';

/** Previous / pick / next date, plus a way back to the open day. Everything below follows the date. */
export default function DateBar({ label = 'Date' }) {
  const { db, actions, isAdmin } = useHotel();
  const { viewDate } = actions;
  const open = db.day?.status === 'OPEN' ? db.day.businessDate : '';
  const isCurrent = !!open && db.date === open;

  // Managers can only see the open business day: no way to move to a past date.
  if (!isAdmin) {
    return (
      <div className="datebar">
        <b aria-label={label}>{fmtDate(db.date)}</b>
      </div>
    );
  }

  return (
    <div className="datebar">
      <button className="btn sm nav" aria-label="Previous day" onClick={() => viewDate(addDays(db.date, -1))}>&#8249;</button>
      <input
        type="date" value={db.date} aria-label={label}
        onChange={(e) => e.target.value && viewDate(e.target.value)}
      />
      <button className="btn sm nav" aria-label="Next day" onClick={() => viewDate(addDays(db.date, 1))}>&#8250;</button>
      {open && !isCurrent && <button className="btn sm" onClick={() => viewDate('')}>Current day</button>}
    </div>
  );
}
