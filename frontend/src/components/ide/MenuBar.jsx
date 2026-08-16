import { useEffect, useRef, useState } from 'react';

/**
 * Dropdown menus for File / Edit / View / Run / etc.
 * items: [{ label, shortcut?, run?, disabled?, divider? }]
 */
export default function MenuBar({ menus = [] }) {
  const [openKey, setOpenKey] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!openKey) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpenKey(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenKey(null);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [openKey]);

  return (
    <nav className="menu-links" aria-label="Menus" ref={rootRef}>
      {menus.map((menu) => (
        <div key={menu.key} className={`menu-item ${openKey === menu.key ? 'open' : ''}`}>
          <button
            type="button"
            className="menu-trigger"
            aria-haspopup="menu"
            aria-expanded={openKey === menu.key}
            onClick={() => setOpenKey((k) => (k === menu.key ? null : menu.key))}
            onMouseEnter={() => { if (openKey) setOpenKey(menu.key); }}
          >
            {menu.label}
          </button>
          {openKey === menu.key && (
            <ul className="menu-dropdown" role="menu">
              {menu.items.map((it, i) => {
                if (it.divider) {
                  return <li key={`d-${i}`} className="menu-divider" role="separator" />;
                }
                return (
                  <li key={it.id || it.label} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={it.disabled}
                      onClick={() => {
                        setOpenKey(null);
                        it.run?.();
                      }}
                    >
                      <span>{it.label}</span>
                      {it.shortcut && <kbd>{it.shortcut}</kbd>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}
