import { useHotel } from '../store/HotelContext';

const SUBTITLES = {
  home: 'Front desk',
  rooms: 'Room status board',
  book: 'Daily entries & cash',
  food: 'Restaurant & orders',
  more: 'Back office'
};

export default function TopBar() {
  const { tab, openSheet, signOut } = useHotel();

  return (
    <header className="hd">
      <div className="dot" aria-hidden="true">&#10052;</div>
      <div style={{ flex: 1 }}>
        <h1>The Midtown Hotel</h1>
        <p>{SUBTITLES[tab]}</p>
      </div>
      <button className="btn sm" onClick={() => openSheet('workingDate')}>Today</button>
      <button className="btn sm" onClick={signOut} aria-label="Sign out">Sign out</button>
    </header>
  );
}
