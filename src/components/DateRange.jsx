import { useEffect, useRef, useState } from 'react';
import { fmtDate } from '../lib/format';

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;      // m is 0-based; no UTC conversion

/** Click a start day, then an end day. Closing without a second click keeps the old range. */
export default function DateRange({ from, to, onChange, max }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({ y: +from.slice(0, 4), m: +from.slice(5, 7) - 1 }));
  const [start, setStart] = useState(null);                    // first click, waiting for the second
  const [hover, setHover] = useState(null);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = () => {
    if (!open) { setView({ y: +from.slice(0, 4), m: +from.slice(5, 7) - 1 }); setStart(null); setHover(null); }
    setOpen((o) => !o);
  };
  const shift = (n) => setView(({ y, m }) => {
    const t = m + n;
    return { y: y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
  });

  const pick = (d) => {
    if (!start) { setStart(d); return; }
    const [a, b] = start <= d ? [start, d] : [d, start];
    onChange(a, b);
    setStart(null);
    setOpen(false);
  };

  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7;                       // Monday first
  const count = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => iso(view.y, view.m, i + 1))];

  const lo = start ? (hover && hover < start ? hover : start) : from;
  const hi = start ? (hover && hover > start ? hover : start) : to;

  return (
    <div className="drange" ref={box}>
      <button type="button" className="btn drange-btn" onClick={toggle} aria-expanded={open}>
        <span aria-hidden="true">&#128197;</span>
        {from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`}
        <span aria-hidden="true" style={{ marginLeft: 'auto' }}>&#9662;</span>
      </button>

      {open && (
        <div className="drange-pop" role="dialog" aria-label="Select date range">
          <div className="drange-head">
            <button type="button" className="btn sm nav" aria-label="Previous month" onClick={() => shift(-1)}>&#8249;</button>
            <b>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b>
            <button type="button" className="btn sm nav" aria-label="Next month" onClick={() => shift(1)}>&#8250;</button>
          </div>
          <div className="drange-grid">
            {DAYS.map((d) => <i key={d} className="dow">{d}</i>)}
            {cells.map((d, i) => {
              if (!d) return <i key={`e${i}`} />;
              const off = !!max && d > max;
              const edge = d === lo || d === hi;
              const mid = d > lo && d < hi;
              return (
                <button
                  key={d} type="button" disabled={off}
                  className={`${edge ? 'edge' : ''}${mid ? ' mid' : ''}${d === max ? ' now' : ''}`}
                  onClick={() => pick(d)} onMouseEnter={() => start && setHover(d)}
                >{+d.slice(8)}</button>
              );
            })}
          </div>
          <p className="drange-hint">{start ? `Start ${fmtDate(start)} — now pick the end date` : 'Pick the start date, then the end date'}</p>
        </div>
      )}
    </div>
  );
}
