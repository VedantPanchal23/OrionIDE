/**
 * Orion IDE — shared UI primitives
 */

import { forwardRef } from 'react';

export const Button = forwardRef(function Button({
  variant = 'subtle', size, block, className = '', children, ...rest
}, ref) {
  const cls = [
    'o-btn',
    `o-btn-${variant}`,
    size ? `o-btn-${size}` : '',
    block ? 'o-btn-block' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button type="button" ref={ref} className={cls} {...rest}>
      {children}
    </button>
  );
});

export function IconButton({ active, className = '', children, title, ...rest }) {
  return (
    <button
      type="button"
      className={['o-icon-btn', active ? 'active' : '', className].filter(Boolean).join(' ')}
      title={title}
      aria-label={title}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Input({ className = '', ...rest }) {
  return <input className={['o-input', className].filter(Boolean).join(' ')} {...rest} />;
}

export function Textarea({ className = '', ...rest }) {
  return <textarea className={['o-input', 'o-textarea', className].filter(Boolean).join(' ')} {...rest} />;
}

export function Spinner({ size = 18 }) {
  return <span className="o-spinner" style={{ width: size, height: size }} />;
}

export function Kbd({ children }) {
  return <kbd className="o-kbd">{children}</kbd>;
}

export function Badge({ accent, children }) {
  return <span className={['o-badge', accent ? 'o-badge-accent' : ''].filter(Boolean).join(' ')}>{children}</span>;
}

export function PanelHeader({ title, children }) {
  return (
    <div className="o-panel-header">
      <span className="o-panel-title">{title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, hint, children }) {
  return (
    <div className="o-empty">
      {icon}
      {title && <strong>{title}</strong>}
      {hint && <span>{hint}</span>}
      {children}
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={['o-switch', checked ? 'on' : ''].filter(Boolean).join(' ')}
      onClick={() => onChange?.(!checked)}
    />
  );
}

export function BrandMark({ size = 28 }) {
  return (
    <span className="o-mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M16 2 L29 9 V23 L16 30 L3 23 V9 Z"
          stroke="var(--accent)"
          strokeWidth="1.6"
          fill="var(--accent-soft)"
        />
        <path d="M16 9 L22.5 12.7 V20.3 L16 24 L9.5 20.3 V12.7 Z" fill="var(--accent)" />
        <circle cx="16" cy="16.5" r="2.3" fill="var(--bg-void)" />
      </svg>
    </span>
  );
}
