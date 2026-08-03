/**
 * Orion IDE — menubar-lite (File / Edit / View / Help)
 */

import { useEffect, useRef, useState } from 'react';

function Menu({ label, open, onToggle, children }) {
  return (
    <div className={`menubar-item ${open ? 'open' : ''}`} onClick={onToggle}>
      {label}
      {open && (
        <div className="menubar-dropdown" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}

function Action({ onClick, disabled, hint, children }) {
  return (
    <button type="button" className="menubar-action" onClick={onClick} disabled={disabled}>
      <span>{children}</span>
      {hint && <span className="hint">{hint}</span>}
    </button>
  );
}

export default function MenuBar({
  hasActiveFile, onNewFile, onNewFolder, onSave, onCloseFile, onBackToProjects,
  onTogglePalette, onToggleTerminal, onToggleSidebar, onToggleDock, onToggleActivity,
  onToggleTheme, onAbout,
}) {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  const run = (fn) => { fn?.(); setOpen(null); };

  return (
    <div className="menubar" ref={ref}>
      <Menu label="File" open={open === 'file'} onToggle={() => setOpen(open === 'file' ? null : 'file')}>
        <Action onClick={() => run(onNewFile)} hint="">New File</Action>
        <Action onClick={() => run(onNewFolder)} hint="">New Folder</Action>
        <div className="menubar-sep" />
        <Action onClick={() => run(onSave)} disabled={!hasActiveFile} hint="Ctrl S">Save</Action>
        <Action onClick={() => run(onCloseFile)} disabled={!hasActiveFile} hint="Ctrl W">Close Editor</Action>
        <div className="menubar-sep" />
        <Action onClick={() => run(onBackToProjects)}>Back to Projects</Action>
      </Menu>

      <Menu label="Edit" open={open === 'edit'} onToggle={() => setOpen(open === 'edit' ? null : 'edit')}>
        <Action onClick={() => run(onTogglePalette)} hint="Ctrl K">Command Palette</Action>
        <Action onClick={() => run(onToggleTerminal)} hint="Ctrl `">Toggle Terminal</Action>
      </Menu>

      <Menu label="View" open={open === 'view'} onToggle={() => setOpen(open === 'view' ? null : 'view')}>
        <Action onClick={() => run(onToggleSidebar)} hint="Ctrl B">Toggle Sidebar</Action>
        <Action onClick={() => run(onToggleDock)}>Toggle Panel</Action>
        <div className="menubar-sep" />
        <Action onClick={() => run(() => onToggleActivity('explorer'))}>Explorer</Action>
        <Action onClick={() => run(() => onToggleActivity('search'))}>Search</Action>
        <Action onClick={() => run(() => onToggleActivity('git'))}>Source Control</Action>
        <Action onClick={() => run(() => onToggleActivity('agents'))}>Agents</Action>
        <Action onClick={() => run(() => onToggleActivity('run'))}>Run</Action>
        <Action onClick={() => run(() => onToggleActivity('settings'))}>Settings</Action>
        <div className="menubar-sep" />
        <Action onClick={() => run(onToggleTheme)}>Toggle Theme</Action>
      </Menu>

      <Menu label="Help" open={open === 'help'} onToggle={() => setOpen(open === 'help' ? null : 'help')}>
        <Action onClick={() => run(onAbout)}>About Orion IDE</Action>
      </Menu>
    </div>
  );
}
