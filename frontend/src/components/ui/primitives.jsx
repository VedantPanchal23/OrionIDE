export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden />;
}

export function IconButton({ children, title, onClick, className = '', ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} title={title} aria-label={title} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

export function EmptyState({ children }) {
  return <div className="picker-empty">{children}</div>;
}

export function BrandMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="18" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="7" fill="var(--accent)" />
    </svg>
  );
}

