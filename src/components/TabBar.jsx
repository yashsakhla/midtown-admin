import { useHotel } from '../store/HotelContext';
import { TabIcon } from './Icons';

const TABS = [
  ['home', 'Home'],
  ['rooms', 'Rooms'],
  ['book', 'Day book'],
  ['food', 'Food'],
  ['more', 'More']
];

export default function TabBar() {
  const { tab, setTab } = useHotel();

  return (
    <nav className="tb" aria-label="Main sections">
      {TABS.map(([id, label]) => (
        <button
          key={id}
          className={tab === id ? 'on' : ''}
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => setTab(id)}
        >
          <TabIcon name={id} />
          {label}
        </button>
      ))}
    </nav>
  );
}
