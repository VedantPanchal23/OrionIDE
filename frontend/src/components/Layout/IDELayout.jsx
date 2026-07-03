/**
 * Orion IDE — IDE Layout
 *
 * Main IDE layout using custom flex resizers instead of percentage-based panel libraries.
 * This guarantees the panels never stack or overlap, and maintains pixel-perfect boundaries.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEditor } from '../../context/EditorContext';
import EditorPane from '../Editor/EditorPane';
import TerminalPanel from '../Terminal/TerminalPanel';
import RunButton from '../Topbar/RunButton';
import FileTree from '../FileTree/FileTree';
import AgentPanel from '../AgentPanel/AgentPanel';
import Settings from '../Settings/Settings';
import SearchPanel from '../Search/SearchPanel';
import CommandPalette from '../CommandPalette/CommandPalette';
import useTerminal from '../../hooks/useTerminal';
import useFileTree from '../../hooks/useFileTree';

import { Files, Search, GitBranch, PlayCircle, Bot, Settings as SettingsIcon, ArrowLeft } from 'lucide-react';

const ICONS = {
  files: Files,
  search: Search,
  git: GitBranch,
  run: PlayCircle,
};

const PANELS = [
  { id: 'files', icon: ICONS.files, title: 'Explorer' },
  { id: 'search', icon: ICONS.search, title: 'Search' },
  { id: 'git', icon: ICONS.git, title: 'Source Control' },
  { id: 'run', icon: ICONS.run, title: 'Run & Debug' },
  { id: 'agent', title: 'AI Agent' },
  { id: 'settings', title: 'Settings' },
];

/* ── User Menu ────────────────────────────────────────────────────────── */
function UserMenu({ onBackToProjects }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} title={user.name || user.email} style={{
        width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border-default)',
        cursor: 'pointer', overflow: 'hidden', padding: 0, background: 'var(--bg-emphasis)',
      }}>
        {user.picture ? (
          <img src={user.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>
            {(user.name || '?')[0].toUpperCase()}
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: 40, left: 0, background: 'var(--bg-subtle)',
          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
          padding: 8, minWidth: 180, zIndex: 999, boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{ padding: '8px 12px', fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', fontWeight: 600 }}>{user.name}</div>
          <div style={{ padding: '4px 12px 8px', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>{user.email}</div>
          <div style={{ borderTop: '1px solid var(--bg-emphasis)', margin: '4px 0' }} />
          <button onClick={() => { onBackToProjects(); setOpen(false); }} style={menuBtnStyle}>
            <ArrowLeft size={14} /> Switch Project
          </button>
          <button onClick={() => { logout(); setOpen(false); }} style={{ ...menuBtnStyle, color: 'var(--accent-red-emphasis)' }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const menuBtnStyle = {
  width: '100%', padding: '8px 12px', fontSize: 'var(--font-size-md)',
  color: 'var(--text-primary)', background: 'transparent',
  border: 'none', cursor: 'pointer', textAlign: 'left',
  borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8,
  fontFamily: 'var(--font-ui)',
};

/* ── Sidebar Panel Content ────────────────────────────────────────────── */
function SidebarContent({ panel, tree, expandedFolders, isLoading, error, onToggleFolder, onCreateItem, onDeleteItem, onRenameItem, onRefresh }) {
  if (panel === 'agent') return <AgentPanel />;
  if (panel === 'settings') return <Settings />;
  if (panel === 'search') return <SearchPanel tree={tree} />;

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

  // Stub panels with helpful messages
  const stubs = {
    git: { icon: '⎇', title: 'Source Control', desc: 'Git integration requires a local repository. Coming in a future update.' },
    run: { icon: '▶', title: 'Run & Debug', desc: 'Use the Run button in the editor toolbar, or press Ctrl+P → "Run Active File".' },
  };
  const stub = stubs[panel];
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
      <div>
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>{stub?.icon || '⚙'}</div>
        <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>{stub?.title || panel}</div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-disabled)', lineHeight: 1.4 }}>{stub?.desc || ''}</div>
      </div>
    </div>
  );
}

/* ── IDE Layout ────────────────────────────────────────────────────────── */
const IDELayout = ({ projectId, projectName, onBackToProjects }) => {
  const { lines, isRunning, clearTerminal, runCode, stopExecution } = useTerminal();
  const fileTree = useFileTree();
  const [activePanel, setActivePanel] = useState('files');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Custom panel sizes in pixels
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [terminalHeight, setTerminalHeight] = useState(220);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);

  // Load file tree on mount
  useEffect(() => {
    if (projectId) fileTree.loadTree(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Sidebar drag handle
  const handleSidebarMouseDown = (e) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  };

  // Terminal drag handle
  const handleTerminalMouseDown = (e) => {
    e.preventDefault();
    setIsResizingTerminal(true);
  };

  // Mouse move resize listener
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingSidebar) {
        const newWidth = e.clientX - 48; // Substract activity bar (48px)
        if (newWidth >= 240 && newWidth <= 500) {
          setSidebarWidth(newWidth);
        }
      }
      if (isResizingTerminal) {
        const newHeight = window.innerHeight - e.clientY;
        if (newHeight >= 120 && newHeight <= window.innerHeight - 200) {
          setTerminalHeight(newHeight);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingTerminal(false);
    };

    if (isResizingSidebar || isResizingTerminal) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, isResizingTerminal]);

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden',
      background: 'var(--bg-default)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
    }}>
      <CommandPalette
        tree={fileTree.tree}
        onRun={() => {
          const activeFile = document.querySelector('[data-run-trigger]');
          if (activeFile) activeFile.click();
        }}
        onOpenSettings={() => setActivePanel('settings')}
        onNewTerminal={() => {
          const btn = document.querySelector('[data-new-terminal]');
          if (btn) btn.click();
        }}
      />

      {/* Activity Bar */}
      <aside style={{
        width: 48, background: 'var(--bg-canvas)', borderRight: '1px solid var(--border-default)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 6, flexShrink: 0,
        zIndex: 2,
      }}>
        {PANELS.map((p) => {
          const isActive = p.id === activePanel && !isSidebarCollapsed;
          return (
            <div key={p.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              {/* Vertical neon active indicator */}
              <div style={{
                position: 'absolute', left: 0, width: 2, height: 20,
                background: isActive ? 'var(--accent-blue-subtle)' : 'transparent',
                borderRadius: '0 4px 4px 0',
                boxShadow: isActive ? '0 0 10px var(--accent-blue-subtle)' : 'none',
                transition: 'all var(--transition-normal)',
              }} />

              <button title={p.title} onClick={() => {
                if (activePanel === p.id) {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                } else {
                  setActivePanel(p.id);
                  setIsSidebarCollapsed(false);
                }
              }} style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? 'rgba(31, 111, 235, 0.08)' : 'transparent', border: 'none', borderRadius: 8,
                cursor: 'pointer', transition: 'all var(--transition-normal)', padding: 0,
                color: isActive ? 'var(--accent-blue-subtle)' : 'var(--text-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-subtle)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
              >
                {p.icon ? <p.icon size={18} /> : p.id === 'settings' ? <SettingsIcon size={18} /> : <Bot size={18} />}
              </button>
            </div>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ marginBottom: 12 }}>
          <UserMenu onBackToProjects={onBackToProjects} />
        </div>
      </aside>

      {/* Main Workspace Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar Panel */}
        {!isSidebarCollapsed && (
          <div style={{
            width: sidebarWidth,
            minWidth: 240,
            maxWidth: 500,
            background: 'var(--bg-canvas)',
            borderRight: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {activePanel !== 'files' && (
              <div style={{
                padding: '12px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.5px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{activePanel === 'agent' ? 'AI Agent' : PANELS.find(p => p.id === activePanel)?.title}</span>
              </div>
            )}
            <SidebarContent
              panel={activePanel}
              tree={fileTree.tree}
              expandedFolders={fileTree.expandedFolders}
              isLoading={fileTree.isLoading}
              error={fileTree.error}
              onToggleFolder={fileTree.expandFolder}
              onCreateItem={fileTree.createItem}
              onDeleteItem={fileTree.deleteItem}
              onRenameItem={fileTree.renameItem}
              onRefresh={fileTree.refreshTree}
            />
          </div>
        )}

        {/* Sidebar Resizer Handle */}
        {!isSidebarCollapsed && (
          <div
            onMouseDown={handleSidebarMouseDown}
            style={{
              width: 4,
              cursor: 'col-resize',
              background: isResizingSidebar ? 'var(--accent-blue)' : 'transparent',
              transition: 'background 0.2s',
              zIndex: 10,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
            onMouseLeave={(e) => { if (!isResizingSidebar) e.currentTarget.style.background = 'transparent'; }}
          />
        )}

        {/* Main Editor & Terminal Container */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Topbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 16px', background: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-default)', flexShrink: 0,
            height: 38,
          }}>
            {/* Logo brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent-blue)', boxShadow: '0 0 8px var(--accent-blue)',
              }} />
              <div style={{
                fontSize: 12, fontWeight: 700,
                background: 'linear-gradient(135deg, var(--text-primary) 30%, var(--accent-blue-subtle) 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.3px',
              }}>
                Orion IDE
              </div>
            </div>

            {/* Center Command Pill button */}
            <button
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true });
                window.dispatchEvent(event);
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '4px 16px', background: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-ui)',
                cursor: 'pointer', transition: 'all var(--transition-normal)',
                width: '100%', maxWidth: 360,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-emphasis)';
                e.currentTarget.style.background = 'var(--bg-emphasis)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.background = 'var(--bg-subtle)';
              }}
            >
              <Search size={10} style={{ opacity: 0.6 }} />
              <span>Search files, commands... (Ctrl+P)</span>
            </button>

            {/* Right actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <RunButton onRun={runCode} onStop={stopExecution} isRunning={isRunning} />
            </div>
          </div>

          {/* Editor and Terminal Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Editor Area */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <EditorPane />
            </div>

            {/* Horizontal Resizer Handle */}
            <div
              onMouseDown={handleTerminalMouseDown}
              style={{
                height: 4,
                cursor: 'row-resize',
                background: isResizingTerminal ? 'var(--accent-blue)' : 'transparent',
                borderTop: '1px solid var(--border-default)',
                transition: 'background 0.2s',
                zIndex: 10,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
              onMouseLeave={(e) => { if (!isResizingTerminal) e.currentTarget.style.background = 'transparent'; }}
            />

            {/* Terminal Area */}
            <div style={{ height: terminalHeight, minHeight: 120, overflow: 'hidden', flexShrink: 0 }}>
              <TerminalPanel lines={lines} isRunning={isRunning} onClear={clearTerminal} projectId={projectId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IDELayout;
