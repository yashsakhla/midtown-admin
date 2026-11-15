import { FAB, PAGE } from '../lib/nav';
import { fmtDate } from '../lib/format';
import { useHotel } from '../store/HotelContext';

const SUBTITLES = {
  home: 'Front desk',
  rooms: 'Room status board',
  book: 'Daily entries & cash',
  food: 'Restaurant & orders',
  more: 'Back office'
};
const subtitle = (tab) => SUBTITLES[tab] || PAGE[tab][0];

export default function TopBar() {
  const { tab, openSheet, signOut, db } = useHotel();
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const [title, sub] = PAGE[tab];
  const [fabLabel, fabSheet] = FAB[tab] || [];

  return (
    <header className="hd">
      <div className="dot" aria-hidden="true">&#10052;</div>
      <div className="hd-m" style={{ flex: 1 }}>
        <h1>The Midtown Hotel</h1>
        <p>{subtitle(tab)}</p>
      </div>
      <div className="hd-d">
        <h2>{tab === 'home' ? `${greet}, Manager 👋` : title}</h2>
        <div className="sub">{sub}</div>
      </div>
      <span className="today-chip">
        {db.day?.status === 'OPEN'
          ? `Day · ${fmtDate(db.day.businessDate)}`
          : db.day ? 'Day closed' : `Today · ${fmtDate(new Date().toISOString().slice(0, 10))}`}
      </span>
      <button className="btn sm" onClick={signOut} aria-label="Sign out">Sign out</button>
      {fabSheet && (
        <button className="btn sm top-act" onClick={() => openSheet(fabSheet)}>{fabLabel}</button>
      )}
    </header>
  );
}
