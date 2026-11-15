import { NAV } from '../lib/nav';
import { useHotel } from '../store/HotelContext';
import { TabIcon } from './Icons';

const TAB_LABEL = {
  home: 'Home', rooms: 'Rooms', book: 'Day book', food: 'Food', more: 'More'
};

/** Bottom tab bar on phones; grouped sidebar (brand, sections, user) on desktop. */
export default function TabBar({ open = false, onClose = () => {} }) {
  const { tab, setTab: pick } = useHotel();
  const setTab = (id) => { pick(id); onClose(); };

  return (
    <nav className={`tb${open ? ' open' : ''}`} aria-label="Main sections">
      <div className="brand">
        <button type="button" className="nav-close" aria-label="Close menu" onClick={onClose}>&#10005;</button>
        <div className="dot" aria-hidden="true">&#10052;</div>
        <h1>The Midtown Hotel</h1>
        <p>Front desk &amp; back office</p>
      </div>

      {NAV.map(([group, items]) => (
        <div className="grp-wrap" key={group}>
          <div className="grp">{group}</div>
          {items.map(([kind, id, label, path]) => (
            kind === 'tab' ? (
              <button
                key={id}
                className={tab === id ? 'on' : ''}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
              >
                <TabIcon name={id} />
                <span className="lbl-m">{TAB_LABEL[id]}</span>
                <span className="lbl-d">{label}</span>
              </button>
            ) : (
              <button
                key={id}
                className={`dsk${tab === id ? ' on' : ''}`}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
              >
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={path} />
                </svg>
                {label}
              </button>
            )
          ))}
        </div>
      ))}

      <div className="who"><i>MT</i><span>Manager</span></div>
    </nav>
  );
}
