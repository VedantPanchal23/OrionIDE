import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, X } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { FileIcon } from '../../utils/fileIcons';
import ConfirmModal from '../ui/ConfirmModal';

export default function EditorTabs() {
  const {
    openFiles, activeFileId, secondaryFileId, focusedPane, split,
    switchTab, closeFile, setFocusedPane,
  } = useEditor();

  const [pendingQueue, setPendingQueue] = useState([]);
  const [menu, setMenu] = useState(null);
  const tabsRef = useRef(null);
  const pendingClose = pendingQueue[0] || null;
  const selectedId = split && focusedPane === 'secondary'
    ? (secondaryFileId || activeFileId)
    : activeFileId;

  useEffect(() => {
    if (!selectedId || !tabsRef.current) return;
    const el = tabsRef.current.querySelector(`[data-tab-id="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [selectedId, openFiles.length]);

  const enqueueConfirms = (files) => {
    const list = (Array.isArray(files) ? files : [files]).filter(Boolean);
    if (!list.length) return;
    setPendingQueue((prev) => {
      const seen = new Set(prev.map((f) => f.id));
      const next = [...prev];
      list.forEach((f) => {
        if (!seen.has(f.id)) {
          seen.add(f.id);
          next.push(f);
        }
      });
      return next;
    });
  };

  const requestClose = (id) => {
    const result = closeFile(id);
    if (result?.needsConfirm) enqueueConfirms(result.file);
  };

  const closeOthers = (id) => {
    const dirty = [];
    openFiles.forEach((f) => {
      if (f.id === id) return;
      const result = closeFile(f.id);
      if (result?.needsConfirm) dirty.push(result.file);
    });
    enqueueConfirms(dirty);
  };

  const closeToTheRight = (id) => {
    const idx = openFiles.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const dirty = [];
    openFiles.slice(idx + 1).forEach((f) => {
      const result = closeFile(f.id);
      if (result?.needsConfirm) dirty.push(result.file);
    });
    enqueueConfirms(dirty);
  };

  const copyPath = async (file) => {
    const path = file?.path || file?.name || '';
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      /* ignore */
    }
  };

  const menuItems = useMemo(() => {
    if (!menu?.file) return [];
    const f = menu.file;
    return [
      { label: 'Close', onClick: () => requestClose(f.id) },
      { label: 'Close Others', onClick: () => closeOthers(f.id), disabled: openFiles.length < 2 },
      { label: 'Close to the Right', onClick: () => closeToTheRight(f.id) },
      { label: 'Copy Path', onClick: () => copyPath(f), icon: true },
    ];
  }, [menu, openFiles]);

  if (!openFiles.length) return <div className="editor-tabs" />;

  return (
    <>
      <div className="editor-tabs" role="tablist" ref={tabsRef}>
        {openFiles.map((f) => (
          <div
            key={f.id}
            data-tab-id={f.id}
            role="tab"
            aria-selected={f.id === selectedId}
            className={`editor-tab ${f.id === selectedId ? 'active' : ''} ${f.isDirty ? 'dirty' : ''}`}
            onClick={() => {
              switchTab(f.id);
              if (!split) setFocusedPane('primary');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') switchTab(f.id);
            }}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                requestClose(f.id);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY, file: f });
            }}
            tabIndex={0}
          >
            <FileIcon name={f.name} size={13} />
            <span className="tab-name">{f.name}</span>
            {f.isDirty && <span className="dirty-dot" aria-hidden="true" />}
            <button
              type="button"
              className="tab-close"
              title="Close"
              onClick={(e) => { e.stopPropagation(); requestClose(f.id); }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {menu && (
        <>
          <button type="button" className="ctx-backdrop" aria-label="Close menu" onClick={() => setMenu(null)} />
          <ul className="ctx-menu" style={{ left: menu.x, top: menu.y }}>
            {menuItems.map((it) => (
              <li key={it.label}>
                <button
                  type="button"
                  className="ctx-item"
                  disabled={it.disabled}
                  onClick={() => { setMenu(null); it.onClick?.(); }}
                >
                  {it.icon && <Copy size={12} />}
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmModal
        open={Boolean(pendingClose)}
        title="Unsaved changes"
        message={`Close "${pendingClose?.name}" without saving?${pendingQueue.length > 1 ? ` (${pendingQueue.length} remaining)` : ''}`}
        confirmLabel="Don't Save"
        cancelLabel="Cancel"
        danger
        onCancel={() => setPendingQueue([])}
        onConfirm={() => {
          if (!pendingClose) return;
          closeFile(pendingClose.id, { force: true });
          setPendingQueue((prev) => prev.slice(1));
        }}
      />
    </>
  );
}
