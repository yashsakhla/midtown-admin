import { useState } from 'react';
import TabBar from './components/TabBar';
import Toast from './components/Toast';
import TopBar from './components/TopBar';
import DayBookScreen from './screens/DayBookScreen';
import FoodScreen from './screens/FoodScreen';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import MoreScreen from './screens/MoreScreen';
import PageScreen from './screens/PageScreen';
import RequestsScreen from './screens/RequestsScreen';
import RoomsScreen from './screens/RoomsScreen';
import SheetHost from './sheets';
import { FAB } from './lib/nav';
import { useHotel } from './store/HotelContext';

const SCREENS = {
  home: HomeScreen,
  rooms: RoomsScreen,
  book: DayBookScreen,
  food: FoodScreen,
  more: MoreScreen,
  requests: RequestsScreen
};

export default function App() {
  const { tab, sheet, openSheet, closeSheet, authed, loading } = useHotel();
  const [navOpen, setNavOpen] = useState(false);

  if (!authed) return <div className="phone"><LoginScreen /></div>;

  const Screen = SCREENS[tab];
  const [fabLabel, fabSheet] = FAB[tab] || [];

  return (
    <>
      <div className="phone">
        <TopBar onMenu={() => setNavOpen(true)} />

        <main className={`scr scr-${tab}`} key={tab}>
          {loading ? <div className="loading">Loading…</div> : Screen ? <Screen /> : <PageScreen id={tab} />}
        </main>

        {fabSheet && <button className="fab" onClick={() => openSheet(fabSheet)}>{fabLabel}</button>}

        <div className={`scrim${sheet ? ' on' : ''}`} onClick={closeSheet} />
        <SheetHost />
        <Toast />
        <div className={`navscrim${navOpen ? ' on' : ''}`} onClick={() => setNavOpen(false)} />
        <TabBar open={navOpen} onClose={() => setNavOpen(false)} />
      </div>

      {/* Print target for slips, invoices and reports. */}
      <div className="slipwrap" id="slip" />
    </>
  );
}
