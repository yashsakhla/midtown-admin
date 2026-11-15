import { createContext, useContext, useEffect, useRef } from 'react';
import { useHotel } from '../store/HotelContext';

/** When true, a Sheet renders inline as a full page instead of a popup. */
export const PageCtx = createContext(false);

/**
 * Bottom sheet / desktop modal. Children are the body; `footer` is pinned
 * under it. Inside a PageCtx it renders as a normal page section.
 */
export default function Sheet({ title, footer, children }) {
  const { closeSheet } = useHotel();
  const asPage = useContext(PageCtx);
  const ref = useRef(null);

  useEffect(() => {
    if (asPage) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
    window.addEventListener('keydown', onKey);
    ref.current?.scrollTo(0, 0);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeSheet, asPage]);

  if (asPage) {
    return (
      <section className="card pagecard" aria-label={title}>
        <div className="h"><h3>{title}</h3></div>
        <div className="b">
          {children}
          {footer && <div className="pagefoot">{footer}</div>}
        </div>
      </section>
    );
  }

  return (
    <div className="sheet on" ref={ref} role="dialog" aria-modal="true" aria-label={title}>
      <div className="grab" />
      <div className="sh">
        <h3 style={{ flex: 1 }}>{title}</h3>
        <button className="btn sm" onClick={closeSheet}>Close</button>
      </div>
      <div className="sb">
        {children}
        {footer && <div style={{ marginTop: 6 }}>{footer}</div>}
      </div>
    </div>
  );
}
