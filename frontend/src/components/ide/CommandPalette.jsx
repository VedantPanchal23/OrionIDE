/**
 * Orion IDE — command palette (Ctrl+K)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export default function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset search UI when the palette opens
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the highlighted row in range as results change
  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const runAt = (i) => {
    const cmd = filtered[i];
    if (cmd) {
      onClose();
      cmd.action();
    }
  };

  return (
    <div className="palette-root" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette">
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 14 }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, filtered.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); runAt(index); }
            }}
          />
        </div>
        <div className="palette-list">
          {filtered.length === 0 ? (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No matching commands
            </div>
          ) : (
            filtered.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={`palette-item ${i === index ? 'active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => runAt(i)}
              >
                {c.icon}
                <span>{c.label}</span>
                {c.hint && <span className="hint">{c.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
