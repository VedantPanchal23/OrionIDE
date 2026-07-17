import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEditor } from '../../context/EditorContext';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import EditorPane from '../Editor/EditorPane';
import TerminalPanel from '../Terminal/TerminalPanel';
import FileTree from '../FileTree/FileTree';
import AgentPanel from '../AgentPanel/AgentPanel';
import Settings from '../Settings/Settings';
import SearchPanel from '../Search/SearchPanel';
import CommandPalette from '../CommandPalette/CommandPalette';
import MenuBar from './MenuBar';
import GitPanel from '../Git/GitPanel';
import RunDebugPanel from '../Run/RunDebugPanel';
import useTerminal from '../../hooks/useTerminal';
import useFileTree from '../../hooks/useFileTree';
import { useToast } from '../Toast/Toast';

import {
  Files, Search, GitBranch, PlayCircle, Bot, Settings as SettingsIcon,
  ArrowLeft, ChevronLeft, ChevronRight, PanelLeft, PanelBottom, PanelRight,
  X, Minus, Square, Play, Loader2,
} from 'lucide-react';

/* ── Panel definitions ─────────────────────────────────────────────────── */
const PANELS = [
  { id: 'files',  Icon: Files,      title: 'Explorer' },
  { id: 'search', Icon: Search,     title: 'Search' },
  { id: 'git',    Icon: GitBranch,  title: 'Source Control' },
  { id: 'run',    Icon: PlayCircle, title: 'Run & Debug' },
  { id: 'agent',  Icon: Bot,        title: 'AI Agent' },
];

/* ── User Avatar + Menu ────────────────────────────────────────────────── */
const UserMenu = ({ onBackToProjects }) => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const initials = (user.name || user.email || '?')[0].toUpperCase();
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title={user.name || user.email}
        style={{
          width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border-default)',
          cursor: 'pointer', overflow: 'hidden', padding: 0,
          background: 'var(--bg-emphasis)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', transition: 'border-color var(--transition-fast)',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
      >
        {user.picture
          ? <img src={user.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ color: 'var(--text-primary)', fontSize: 11, fontWeight: 700 }}>{initials}</span>
        }
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', bottom: 36, left: 0, zIndex: 999,
            background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)', padding: '4px 0', minWidth: 200,
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', fontWeight: 600 }}>
                {user.name}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
                {user.email}
              </div>
            </div>
            <button onClick={() => { onBackToProjects(); setOpen(false); }} style={menuBtnStyle}>
              <ArrowLeft size={14} /> Switch Project
            </button>
            <button
              onClick={() => { logout(); setOpen(false); }}
              style={{ ...menuBtnStyle, color: 'var(--accent-red-emphasis)' }}
            >
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
};
const menuBtnStyle = {
  width: '100%', padding: '8px 14px', fontSize: 'var(--font-size-md)', color: 'var(--text-primary)',
  background: 'transparent', border: 'none', cursor: 'pointer',
  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
  fontFamily: 'var(--font-ui)', transition: 'background var(--transition-fast)',
};

/* ── Sidebar content switcher ──────────────────────────────────────────── */
const SidebarContent = ({ panel, tree, expandedFolders, isLoading, error, onToggleFolder, onCreateItem, onDeleteItem, onRenameItem, onRefresh, isRunning, onRun, onStop, lines }) => {
  if (panel === 'agent')    return <AgentPanel />;
  if (panel === 'settings') return <Settings />;
  if (panel === 'search')   return <SearchPanel tree={tree} />;
  if (panel === 'git')      return <GitPanel />;
  if (panel === 'run')      return <RunDebugPanel isRunning={isRunning} onRun={onRun} onStop={onStop} lines={lines} />;
  if (panel === 'files') {
    return (
      <FileTree
        tree={tree}
        expandedFolders={expandedFolders}
        isLoading={isLoading}
        error={error}
        onToggleFolder={onToggleFolder}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        onRenameItem={onRenameItem}
        onRefresh={onRefresh}
      />
    );
  }
  return null;
};

/* ── Resize handles ────────────────────────────────────────────────────── */
const ResizeHandleH = () => (
  <PanelResizeHandle style={{ width: 1, background: 'var(--border-default)', flexShrink: 0, cursor: 'col-resize', outline: 'none', transition: 'background var(--transition-fast)' }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--border-default)'; }}
  />
);
const ResizeHandleV = () => (
  <PanelResizeHandle style={{ height: 1, background: 'var(--border-default)', flexShrink: 0, cursor: 'row-resize', outline: 'none', transition: 'background var(--transition-fast)' }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--border-default)'; }}
  />
);

/* ── Run Button ─────────────────────────────────────────────────────────── */
const RunButton = ({ activeFile, isRunning, onRun, onStop }) => {
  const canRun = !!activeFile;
  return (
    <button
      onClick={isRunning ? onStop : onRun}
      disabled={!canRun && !isRunning}
      title={isRunning ? 'Stop Execution' : activeFile ? `Run ${activeFile.fileName}` : 'Open a file to run'}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px',
        borderRadius: 'var(--radius-sm)', border: 'none',
        cursor: canRun || isRunning ? 'pointer' : 'not-allowed',
        fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-ui)', fontWeight: 600,
        background: isRunning ? 'var(--accent-red)' : 'var(--accent-green)',
        color: '#fff', opacity: !canRun && !isRunning ? 0.4 : 1,
        transition: 'background var(--transition-fast), opacity var(--transition-fast)',
      }}
      onMouseEnter={e => {
        if (canRun || isRunning)
          e.currentTarget.style.background = isRunning ? 'var(--accent-red-emphasis)' : 'var(--accent-green-emphasis)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = isRunning ? 'var(--accent-red)' : 'var(--accent-green)';
      }}
    >
      {isRunning
        ? <><Loader2 size={12} className="spin" /> Stop</>
        : <><Play size={12} /> Run</>
      }
    </button>
  );
};

/* ── Status info (reads EditorContext directly) ─────────────────────────── */
const StatusInfo = () => {
  const { activeFile, cursorPosition, saveStatus } = useEditor();
  // These colors must be legible on the blue status bar background
  const saveColors = { saving: 'rgba(255,255,255,0.85)', saved: 'rgba(255,255,255,1)', error: '#ffa198', idle: 'rgba(255,255,255,0.7)' };
  const saveLabels = { saving: 'Saving…', saved: 'Saved ✓', error: 'Save failed', idle: '' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
      {saveLabels[saveStatus] && (
        <span style={{ color: saveColors[saveStatus] }}>{saveLabels[saveStatus]}</span>
      )}
      {activeFile && (
        <>
          <span style={{ opacity: 0.85, fontFamily: 'var(--font-mono)' }}>
            Ln {cursorPosition?.line || 1}, Col {cursorPosition?.column || 1}
          </span>
          <span style={{ opacity: 0.75, textTransform: 'capitalize' }}>
            {activeFile.language || 'plaintext'}
          </span>
        </>
      )}
    </div>
  );
};

/* ── Icon button helper ────────────────────────────────────────────────── */
const IconBtn = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      background: 'transparent', border: 'none', color: 'var(--text-muted)',
      cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
      borderRadius: 4, transition: 'color var(--transition-fast), background var(--transition-fast)',
    }}
    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
  >
    {children}
  </button>
);

/* ── IDELayout ──────────────────────────────────────────────────────────── */
const IDELayout = ({ projectId, projectName, onBackToProjects }) => {
  const { lines, isRunning, clearTerminal, runCode, stopExecution } = useTerminal();
  const fileTree = useFileTree();
  const { activeFile } = useEditor();
  const { toast } = useToast();
  // Note: SSE notification connection is managed by AuthContext — no need to open it here

  const [activePanel,         setActivePanel]         = useState('files');
  const [isSidebarCollapsed,  setIsSidebarCollapsed]  = useState(false);
  const [isTerminalVisible,   setIsTerminalVisible]   = useState(true);

  // Imperative ref to TerminalPanel's exposed methods
  const terminalPanelRef = useRef(null);

  /* Load project file tree */
  useEffect(() => {
    if (projectId) fileTree.loadTree(projectId);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps



  /* Handlers */
  const handleRun = useCallback(() => {
    if (!activeFile || isRunning) return;
    terminalPanelRef.current?.showOutput();
    setIsTerminalVisible(true);
    runCode(activeFile.fileName, activeFile.content || '');
  }, [activeFile, isRunning, runCode]);

  const handleStop = useCallback(() => stopExecution(), [stopExecution]);

  /* Keyboard shortcuts — declared after handlers so deps are in scope */
  useEffect(() => {
    const onKey = e => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === '`' && !e.shiftKey) { e.preventDefault(); setIsTerminalVisible(v => !v); }
      if (ctrl && e.key === '`' &&  e.shiftKey) { e.preventDefault(); setIsTerminalVisible(true); setTimeout(() => terminalPanelRef.current?.createNewTerminal(), 60); }
      if (ctrl && e.key === 'b') { e.preventDefault(); setIsSidebarCollapsed(v => !v); }
      if (ctrl && e.key === ',') { e.preventDefault(); setActivePanel('settings'); setIsSidebarCollapsed(false); }
      if (ctrl && e.shiftKey && e.key === 'E') { e.preventDefault(); setActivePanel('files');  setIsSidebarCollapsed(false); }
      if (ctrl && e.shiftKey && e.key === 'F') { e.preventDefault(); setActivePanel('search'); setIsSidebarCollapsed(false); }
      if (ctrl && e.shiftKey && e.key === 'G') { e.preventDefault(); setActivePanel('git');    setIsSidebarCollapsed(false); }
      if (e.key === 'F5' && !e.shiftKey) { e.preventDefault(); handleRun(); }
      if (e.key === 'F5' &&  e.shiftKey) { e.preventDefault(); handleStop(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun, handleStop]);

  const handleNewTerminal = useCallback(() => {
    setIsTerminalVisible(true);
    setTimeout(() => terminalPanelRef.current?.createNewTerminal(), 60);
  }, []);

  const handleActivityClick = useCallback((panelId) => {
    if (activePanel === panelId) setIsSidebarCollapsed(v => !v);
    else { setActivePanel(panelId); setIsSidebarCollapsed(false); }
  }, [activePanel]);

  /* Toasted FileTree callbacks */
  const handleCreateItem = useCallback(async (parentId, name, type) => {
    try {
      await fileTree.createItem(parentId, name, type);
      toast({ type: 'success', title: `${type === 'folder' ? 'Folder' : 'File'} created`, message: name });
    } catch (err) {
      toast({ type: 'error', title: 'Create failed', message: err?.response?.data?.error?.message || err.message || 'Unknown error' });
    }
  }, [fileTree, toast]);

  const handleDeleteItem = useCallback(async (itemId, itemName) => {
    try {
      await fileTree.deleteItem(itemId);
      toast({ type: 'info', title: 'Deleted', message: itemName || 'Item deleted' });
    } catch (err) {
      toast({ type: 'error', title: 'Delete failed', message: err?.response?.data?.error?.message || err.message || 'Unknown error' });
    }
  }, [fileTree, toast]);

  const handleRenameItem = useCallback(async (itemId, newName) => {
    try {
      await fileTree.renameItem(itemId, newName);
      toast({ type: 'success', title: 'Renamed', message: `→ ${newName}` });
    } catch (err) {
      toast({ type: 'error', title: 'Rename failed', message: err?.response?.data?.error?.message || err.message || 'Unknown error' });
    }
  }, [fileTree, toast]);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw',
      overflow: 'hidden', background: 'var(--bg-default)',
      color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
    }}>

      {/* Global Command Palette */}
      <CommandPalette
        tree={fileTree.tree}
        onRun={handleRun}
        onOpenSettings={() => { setActivePanel('settings'); setIsSidebarCollapsed(false); }}
        onNewTerminal={handleNewTerminal}
      />

      {/* ── Title Bar ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 35, background: 'var(--bg-subtle)',
        borderBottom: '1px solid var(--border-default)',
        flexShrink: 0, userSelect: 'none',
      }}>
        {/* Left: working menu bar */}
        <MenuBar
          onToggleSidebar={() => setIsSidebarCollapsed(v => !v)}
          onToggleTerminal={() => setIsTerminalVisible(v => !v)}
          onNewTerminal={handleNewTerminal}
          onOpenSettings={() => { setActivePanel('settings'); setIsSidebarCollapsed(false); }}
          onRun={handleRun}
          onStop={handleStop}
          isRunning={isRunning}
          onBackToProjects={onBackToProjects}
        />

        {/* Center: nav + search pill + run */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChevronLeft  size={16} color="var(--text-muted)" style={{ cursor: 'pointer', opacity: 0.6 }} />
          <ChevronRight size={16} color="var(--text-muted)" style={{ cursor: 'pointer', opacity: 0.6 }} />
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true }))}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '3px 14px',
              background: 'var(--bg-emphasis)', border: '1px solid var(--border-default)',
              borderRadius: 6, color: 'var(--text-muted)', fontSize: 13,
              fontFamily: 'var(--font-ui)', cursor: 'pointer', width: 300,
              transition: 'border-color var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          >
            <Search size={13} style={{ opacity: 0.7, flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: 'left' }}>{projectName || 'Orion IDE'}</span>
            <span style={{ fontSize: 11, opacity: 0.45 }}>Ctrl+P</span>
          </button>
          <RunButton activeFile={activeFile} isRunning={isRunning} onRun={handleRun} onStop={handleStop} />
        </div>

        {/* Right: layout toggles + window controls */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <div style={{ display: 'flex', gap: 2, marginRight: 8, alignItems: 'center' }}>
            <IconBtn onClick={() => setIsSidebarCollapsed(v => !v)} title="Toggle Sidebar (Ctrl+B)">
              <PanelLeft size={16} />
            </IconBtn>
            <IconBtn onClick={() => setIsTerminalVisible(v => !v)} title="Toggle Terminal (Ctrl+`)">
              <PanelBottom size={16} />
            </IconBtn>
            <IconBtn onClick={() => {}} title="Toggle Right Panel">
              <PanelRight size={16} />
            </IconBtn>
          </div>
          {[
            { icon: <Minus size={14} />, tip: 'Minimize', hoverBg: 'var(--bg-emphasis)', hoverColor: 'var(--text-primary)' },
            { icon: <Square size={12} />, tip: 'Maximize', hoverBg: 'var(--bg-emphasis)', hoverColor: 'var(--text-primary)' },
            { icon: <X size={14} />, tip: 'Close', hoverBg: '#e81123', hoverColor: '#fff' },
          ].map(({ icon, tip, hoverBg, hoverColor }) => (
            <div key={tip} title={tip}
              style={{
                width: 46, height: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)',
                transition: 'background var(--transition-fast), color var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = hoverColor; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >{icon}</div>
          ))}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Activity Bar */}
        <aside style={{
          width: 48, background: 'var(--bg-subtle)',
          borderRight: '1px solid var(--border-default)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 4, flexShrink: 0,
        }}>
          {PANELS.map(({ id, Icon, title }) => {
            const isActive = activePanel === id && !isSidebarCollapsed;
            return (
              <div key={id} style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                {/* Blue left indicator */}
                <div style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 2, height: isActive ? 24 : 0,
                  background: 'var(--accent-blue)',
                  transition: 'height var(--transition-normal)',
                }} />
                <button
                  title={title}
                  onClick={() => handleActivityClick(id)}
                  style={{
                    width: 32, height: 32, margin: '3px 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderRadius: 6,
                    transition: 'color var(--transition-fast), background var(--transition-fast)',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-emphasis)'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; } }}
                >
                  <Icon size={22} strokeWidth={1.5} />
                </button>
              </div>
            );
          })}

          <div style={{ flex: 1 }} />

          {/* Bottom: Settings + User */}
          <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button
              title="Settings"
              onClick={() => { setActivePanel('settings'); setIsSidebarCollapsed(false); }}
              style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                color: activePanel === 'settings' && !isSidebarCollapsed ? 'var(--text-primary)' : 'var(--text-muted)',
                borderRadius: 6, transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => {
                e.currentTarget.style.color = activePanel === 'settings' && !isSidebarCollapsed
                  ? 'var(--text-primary)' : 'var(--text-muted)';
              }}
            >
              <SettingsIcon size={22} strokeWidth={1.5} />
            </button>
            <UserMenu onBackToProjects={onBackToProjects} />
          </div>
        </aside>

        {/* Main resizable layout */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <PanelGroup direction="horizontal" style={{ flex: 1 }}>

            {/* Sidebar */}
            {!isSidebarCollapsed && (
              <>
                <Panel defaultSize={22} minSize={14} maxSize={45} style={{
                  display: 'flex', flexDirection: 'column',
                  background: 'var(--bg-subtle)',
                  borderRight: '1px solid var(--border-default)',
                }}>
                  <div style={{
                    padding: '0 12px', fontSize: 11, fontWeight: 600,
                    color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.6px', flexShrink: 0, display: 'flex',
                    alignItems: 'center', borderBottom: '1px solid var(--border-default)',
                    height: 30, minHeight: 30,
                  }}>
                    {activePanel === 'agent' ? 'AI Agent'
                      : activePanel === 'settings' ? 'Settings'
                      : PANELS.find(p => p.id === activePanel)?.title || activePanel}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <SidebarContent
                      panel={activePanel}
                      tree={fileTree.tree}
                      expandedFolders={fileTree.expandedFolders}
                      isLoading={fileTree.isLoading}
                      error={fileTree.error}
                      onToggleFolder={fileTree.expandFolder}
                      onCreateItem={handleCreateItem}
                      onDeleteItem={handleDeleteItem}
                      onRenameItem={handleRenameItem}
                      onRefresh={fileTree.refreshTree}
                      isRunning={isRunning}
                      onRun={handleRun}
                      onStop={handleStop}
                      lines={lines}
                    />
                  </div>
                </Panel>
                <ResizeHandleH />
              </>
            )}

            {/* Editor + Terminal column */}
            <Panel minSize={30} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <PanelGroup direction="vertical">

                {/* Editor area */}
                <Panel
                  defaultSize={isTerminalVisible ? 65 : 100}
                  minSize={20}
                  style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                  <EditorPane />
                </Panel>

                {/* Terminal */}
                {isTerminalVisible && (
                  <>
                    <ResizeHandleV />
                    <Panel
                      defaultSize={35}
                      minSize={8}
                      maxSize={70}
                      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                    >
                      <TerminalPanel
                        ref={terminalPanelRef}
                        lines={lines}
                        isRunning={isRunning}
                        onClear={clearTerminal}
                        projectId={projectId}
                        onClose={() => setIsTerminalVisible(false)}
                      />
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </div>
      </div>

      {/* ── Status Bar ─────────────────────────────────────────────────── */}
      <div style={{
        height: 22, background: 'var(--accent-blue)', color: '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 8px', fontSize: 12, flexShrink: 0,
        fontFamily: 'var(--font-ui)', userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', opacity: 0.9 }}>
            <GitBranch size={12} /> {projectName || 'main'}
          </span>
          <span style={{ opacity: 0.65 }}>⊗ 0  ⚠ 0</span>
        </div>
        <StatusInfo />
      </div>
    </div>
  );
};

export default IDELayout;
