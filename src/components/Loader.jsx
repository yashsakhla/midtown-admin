import { useEffect, useState } from 'react';
import { subscribePending } from '../api/client';

/** Centered spinner for screen-level loading. */
export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

/** Slim top progress bar shown while any API request is in flight (delayed to avoid flicker). */
export function TopProgress() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let t;
    const unsub = subscribePending((n) => {
      clearTimeout(t);
      if (n > 0) t = setTimeout(() => setBusy(true), 150);
      else setBusy(false);
    });
    return () => { clearTimeout(t); unsub(); };
  }, []);
  return <div className={`topprog${busy ? ' on' : ''}`} aria-hidden="true"><i /></div>;
}
