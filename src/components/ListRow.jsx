/** One row of a list inside a Card. */
export default function ListRow({ title, sub, right, onClick, children, style, className = '' }) {
  const Tag = onClick ? 'div' : 'div';
  return (
    <Tag
      className={`li ${className}`.trim()}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(e); } : undefined}
      style={onClick ? { cursor: 'pointer', ...style } : style}
    >
      {children || (
        <>
          <div className="t">
            <b>{title}</b>
            {sub && <span>{sub}</span>}
          </div>
          {right}
        </>
      )}
    </Tag>
  );
}
