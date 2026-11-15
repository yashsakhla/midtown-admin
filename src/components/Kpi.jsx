import { ArrowIcon, KpiIcon } from './Icons';

/** Grid of headline figures (2-up on phone, auto-fit cards on desktop). */
export function KpiGrid({ children }) {
  return <div className="kpi">{children}</div>;
}

/**
 * Stat card. `tone` picks the background (green, blue, orange, red, gold);
 * with `onClick` it becomes a button that darkens on hover and shows an arrow.
 */
export function Kpi({ value, label, icon, tone, note, breakdown, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`k${tone ? ` t-${tone}` : ''}${onClick ? ' go' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {icon ? (
        <div className="top-row">
          <div className="ic"><KpiIcon name={icon} /></div>
          <span className="kl">{label}</span>
          {onClick && <span className="arr"><ArrowIcon /></span>}
        </div>
      ) : null}
      <b>{value}</b>
      {!icon && <span>{label}</span>}
      {note && <span className="kd">{note}</span>}
      {breakdown && (
        <div className="kb">
          {breakdown.map(([l, v]) => <span key={l}><b>{v}</b> {l}</span>)}
        </div>
      )}
    </Tag>
  );
}
