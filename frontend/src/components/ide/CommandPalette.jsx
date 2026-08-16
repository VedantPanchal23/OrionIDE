import { useEffect, useMemo, useRef, useState } from 'react';
import { FileIcon } from '../../utils/fileIcons';
import { formatShortcut } from '../../utils/platform';

/**
 * Unified command palette / quick-open overlay.
 * mode: 'commands' | 'files'
 */
export default function CommandPalette({
  open,
  mode = 'commands',
  commands = [],
  files = [],
  onClose,
  onRunCommand,
  onOpenFile,
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setIndex(0);
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open, mode]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (mode === 'files') {
      const list = files.filter((f) => !q || f.name.toLowerCase().includes(q) || (f.path || '').toLowerCase().includes(q));
      return list.slice(0, 50).map((f) => ({
        id: f.id,
        label: f.name,
        detail: f.path || '',
        kind: 'file',
        payload: f,
      }));
    }
    const list = commands.filter((c) => {
      if (!q) return true;
      return c.label.toLowerCase().includes(q) || (c.keywords || '').toLowerCase().includes(q);
    });
    return list.slice(0, 40).map((c) => ({
      id: c.id,
      label: c.label,
      detail: formatShortcut(c.shortcut || ''),
      kind: 'command',
      payload: c,
    }));
  }, [mode, query, commands, files]);

  useEffect(() => {
    setIndex(0);
  }, [query, mode]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-palette-index="${index}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [index, open, items.length]);

  if (!open) return null;

  const select = (item) => {
    if (!item) return;
    if (item.kind === 'file') onOpenFile?.(item.payload);
    else onRunCommand?.(item.payload);
    onClose?.();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!items.length) return;
      setIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!items.length) return;
      select(items[index]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'files' ? 'Quick Open' : 'Command Palette'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="palette-input-row">
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            placeholder={mode === 'files' ? 'Search files by name…' : 'Type a command…'}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <span className="palette-hint">
            {mode === 'files' ? formatShortcut('Ctrl+P') : formatShortcut('Ctrl+Shift+P')}
          </span>
        </div>
        <ul className="palette-list" ref={listRef}>
          {items.length === 0 && (
            <li className="palette-empty">
              {query.trim() ? 'No matches' : (mode === 'files' ? 'No files loaded yet' : 'No commands')}
            </li>
          )}
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                data-palette-index={i}
                className={`palette-item ${i === index ? 'active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => select(item)}
              >
                {item.kind === 'file' ? <FileIcon name={item.label} size={14} /> : <span className="palette-dot" />}
                <span className="palette-label">{item.label}</span>
                <span className="palette-detail">{item.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
