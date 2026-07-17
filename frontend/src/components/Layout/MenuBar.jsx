/**
 * Orion IDE — Menu Bar
 *
 * VS Code-style top menu with working dropdowns for:
 * File, Edit, View, Go, Run, Terminal, Help
 *
 * Each item calls into context hooks or dispatches keyboard events
 * to trigger existing IDE functionality.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor } from '../../context/EditorContext';

/* ── One dropdown menu ─────────────────────────────────────────────────── */
const DropdownMenu = ({ items, onClose, anchorRect }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: anchorRect ? anchorRect.bottom : 0,
        left: anchorRect ? anchorRect.left : 0,
        zIndex: 9998,
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: '4px 0',
        minWidth: 220,
        fontFamily: 'var(--font-ui)',
      }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} style={{ height: 1, background: 'var(--border-default)', margin: '4px 0' }} />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => { if (!item.disabled) { item.action?.(); onClose(); } }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '6px 14px',
              background: 'transparent', border: 'none', cursor: item.disabled ? 'default' : 'pointer',
              fontSize: 'var(--font-size-md)', color: item.disabled ? 'var(--text-disabled)' : item.danger ? 'var(--accent-red-emphasis)' : 'var(--text-primary)',
              textAlign: 'left', fontFamily: 'var(--font-ui)',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span>{item.label}</span>
            {item.kbd && (
              <kbd style={{
                fontSize: 10, padding: '1px 5px',
                background: 'var(--bg-emphasis)', border: '1px solid var(--border-emphasis)',
                borderRadius: 3, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                marginLeft: 24,
              }}>
                {item.kbd}
              </kbd>
            )}
          </button>
        )
      )}
    </div>
  );
};

/* ── MenuBar ────────────────────────────────────────────────────────────── */
const MenuBar = ({ onToggleSidebar, onToggleTerminal, onNewTerminal, onOpenSettings, onRun, onStop, isRunning, onBackToProjects }) => {
  const [openMenu, setOpenMenu] = useState(null); // label of open menu
  const [anchorRect, setAnchorRect] = useState(null);
  const { activeFile, saveFile, openFiles } = useEditor();

  const dispatch = useCallback((key, ctrl = true, shift = false) => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key, ctrlKey: ctrl, shiftKey: shift, metaKey: false, bubbles: true,
    }));
  }, []);

  const open = useCallback((label, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setAnchorRect(rect);
    setOpenMenu(prev => prev === label ? null : label);
  }, []);

  const MENUS = [
    {
      label: 'File',
      items: [
        { label: 'New File',          kbd: 'Ctrl+N',       action: () => {}, disabled: true },
        { label: 'Open Folder…',      kbd: 'Ctrl+K Ctrl+O',action: () => onBackToProjects?.(), },
        { separator: true },
        { label: 'Save',              kbd: 'Ctrl+S',       action: () => activeFile && saveFile(activeFile.fileId), disabled: !activeFile },
        { label: 'Save All',          kbd: 'Ctrl+Shift+S', action: () => openFiles.forEach(f => f.isDirty && saveFile(f.fileId)), disabled: openFiles.length === 0 },
        { separator: true },
        { label: 'Switch Project',                         action: () => onBackToProjects?.() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo',              kbd: 'Ctrl+Z',       action: () => document.execCommand('undo') },
        { label: 'Redo',              kbd: 'Ctrl+Y',       action: () => document.execCommand('redo') },
        { separator: true },
        { label: 'Cut',               kbd: 'Ctrl+X',       action: () => document.execCommand('cut') },
        { label: 'Copy',              kbd: 'Ctrl+C',       action: () => document.execCommand('copy') },
        { label: 'Paste',             kbd: 'Ctrl+V',       action: () => document.execCommand('paste') },
        { separator: true },
        { label: 'Find',              kbd: 'Ctrl+F',       action: () => dispatch('f') },
        { label: 'Find in Files',     kbd: 'Ctrl+Shift+F', action: () => dispatch('f', true, true) },
        { label: 'Replace',           kbd: 'Ctrl+H',       action: () => dispatch('h') },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Command Palette',   kbd: 'Ctrl+P',       action: () => dispatch('p') },
        { separator: true },
        { label: 'Explorer',          kbd: 'Ctrl+Shift+E', action: () => dispatch('e', true, true) },
        { label: 'Search',            kbd: 'Ctrl+Shift+F', action: () => dispatch('f', true, true) },
        { separator: true },
        { label: 'Toggle Sidebar',    kbd: 'Ctrl+B',       action: () => onToggleSidebar?.() },
        { label: 'Toggle Terminal',   kbd: 'Ctrl+`',       action: () => onToggleTerminal?.() },
        { separator: true },
        { label: 'Settings',          kbd: 'Ctrl+,',       action: () => onOpenSettings?.() },
      ],
    },
    {
      label: 'Go',
      items: [
        { label: 'Go to File…',       kbd: 'Ctrl+P',       action: () => dispatch('p') },
        { label: 'Go to Line…',       kbd: 'Ctrl+G',       action: () => dispatch('g') },
        { separator: true },
        { label: 'Go Back',           kbd: 'Alt+←',        action: () => {}, disabled: true },
        { label: 'Go Forward',        kbd: 'Alt+→',        action: () => {}, disabled: true },
      ],
    },
    {
      label: 'Run',
      items: [
        { label: isRunning ? 'Stop Execution' : 'Run Active File', kbd: 'F5', action: () => isRunning ? onStop?.() : onRun?.(), disabled: !activeFile && !isRunning },
        { separator: true },
        { label: 'Open Run & Debug',  action: () => {}, disabled: true },
      ],
    },
    {
      label: 'Terminal',
      items: [
        { label: 'New Terminal',      kbd: 'Ctrl+Shift+`', action: () => onNewTerminal?.() },
        { label: 'Toggle Terminal',   kbd: 'Ctrl+`',       action: () => onToggleTerminal?.() },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts', action: () => window.open('https://code.visualstudio.com/shortcuts/keyboard-shortcuts-windows.pdf', '_blank') },
        { separator: true },
        { label: 'Report Issue',       action: () => window.open('https://github.com/VedantPanchal23/OrionIDE/issues', '_blank') },
        { label: 'View on GitHub',     action: () => window.open('https://github.com/VedantPanchal23/OrionIDE', '_blank') },
      ],
    },
  ];

  return (
    <>
      {/* Click-away backdrop */}
      {openMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9997 }} onClick={() => setOpenMenu(null)} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingLeft: 8 }}>
        {MENUS.map(menu => (
          <button
            key={menu.label}
            onClick={e => open(menu.label, e)}
            style={{
              padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center',
              cursor: 'pointer', fontSize: 13, color: openMenu === menu.label ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: openMenu === menu.label ? 'var(--bg-emphasis)' : 'transparent',
              border: 'none', fontFamily: 'var(--font-ui)',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-emphasis)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => {
              if (openMenu !== menu.label) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {menu.label}
          </button>
        ))}
      </div>

      {openMenu && (() => {
        const menu = MENUS.find(m => m.label === openMenu);
        return menu ? (
          <DropdownMenu
            items={menu.items}
            onClose={() => setOpenMenu(null)}
            anchorRect={anchorRect}
          />
        ) : null;
      })()}
    </>
  );
};

export default MenuBar;
