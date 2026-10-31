import TabBar from './components/TabBar';
import Toast from './components/Toast';
import TopBar from './components/TopBar';
import DayBookScreen from './screens/DayBookScreen';
import FoodScreen from './screens/FoodScreen';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import MoreScreen from './screens/MoreScreen';
import RoomsScreen from './screens/RoomsScreen';
import SheetHost from './sheets';
import { useHotel } from './store/HotelContext';

const SCREENS = {
  home: HomeScreen,
  rooms: RoomsScreen,
  book: DayBookScreen,
  food: FoodScreen,
  more: MoreScreen
};

/** The floating action button changes with the tab, as in the original app. */
const FAB = {
  home: ['+ Check-in', 'checkIn'],
  rooms: ['+ Check-in', 'checkIn'],
  book: ['+ New entry', 'entry'],
  food: ['Print KOT', 'kot'],
  more: ['+ Booking', 'booking']
};

export default function App() {
  const { tab, sheet, openSheet, closeSheet, authed, loading } = useHotel();

  if (!authed) return <div className="phone"><LoginScreen /></div>;

  const Screen = SCREENS[tab];
  const [fabLabel, fabSheet] = FAB[tab];

  return (
    <>
      <div className="phone">
        <TopBar />

        <main className={`scr scr-${tab}`} key={tab}>
          {loading ? <div className="loading">Loading…</div> : <Screen />}
        </main>

        <button className="fab" onClick={() => openSheet(fabSheet)}>{fabLabel}</button>

        <div className={`scrim${sheet ? ' on' : ''}`} onClick={closeSheet} />
        <SheetHost />
        <Toast />
        <TabBar />
      </div>

      {/* Print target for slips, invoices and reports. */}
      <div className="slipwrap" id="slip" />
    </>
  );
}
