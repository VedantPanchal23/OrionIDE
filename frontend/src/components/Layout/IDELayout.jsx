/**
 * Orion IDE — IDE Layout
 *
 * Main IDE: Activity bar, sidebar (file tree / agent / settings), editor, terminal.
 * Loads file tree on mount using projectId.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEditor } from '../../context/EditorContext';
import EditorPane from '../Editor/EditorPane';
import TerminalPanel from '../Terminal/TerminalPanel';
import RunButton from '../Topbar/RunButton';
import FileTree from '../FileTree/FileTree';
import AgentPanel from '../AgentPanel/AgentPanel';
import CommandPalette from '../CommandPalette/CommandPalette';
import useTerminal from '../../hooks/useTerminal';
import useFileTree from '../../hooks/useFileTree';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';

import { Files, Search, GitBranch, PlayCircle, Bot, ArrowLeft } from 'lucide-react';

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

  // Placeholder for other panels
  const labels = { search: 'Search across files', git: 'Source control', run: 'Run & Debug' };
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-disabled)' }}>{labels[panel] || 'Coming soon'}</div>
    </div>
  );
}

/* ── IDE Layout ────────────────────────────────────────────────────────── */
const IDELayout = ({ projectId, projectName, onBackToProjects }) => {
  const { lines, isRunning, clearTerminal, runCode, stopExecution } = useTerminal();
  const fileTree = useFileTree();
  const [activePanel, setActivePanel] = useState('files');

  // Load file tree on mount
  useEffect(() => {
    if (projectId) fileTree.loadTree(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden',
      background: 'var(--bg-default)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
    }}>
      <CommandPalette tree={fileTree.tree} />
      {/* Activity bar */}
      <aside style={{
        width: 48, background: 'var(--bg-canvas)', borderRight: '1px solid var(--border-default)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 4, flexShrink: 0,
      }}>
        {PANELS.map((p) => {
          const isActive = p.id === activePanel;
          return (
            <button key={p.id} title={p.title} onClick={() => setActivePanel(p.id)} style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isActive ? 'var(--bg-subtle)' : 'transparent', border: 'none', borderRadius: 8,
              cursor: 'pointer', transition: 'background var(--transition-normal)', padding: 0,
              borderLeft: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-subtle)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {p.icon ? <p.icon size={20} color={isActive ? 'var(--text-primary)' : 'var(--text-muted)'} /> : <Bot size={20} color={isActive ? 'var(--text-primary)' : 'var(--text-muted)'} />}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ marginBottom: 12 }}>
          <UserMenu onBackToProjects={onBackToProjects} />
        </div>
      </aside>

      {/* Resizable layout */}
      <PanelGroup direction="horizontal" style={{ flex: 1 }}>
        {/* Sidebar Panel */}
        <Panel
          defaultSize={20}
          minSize={15}
          maxSize={40}
          style={{
            background: 'var(--bg-canvas)', borderRight: '1px solid var(--border-default)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '12px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.5px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{activePanel === 'agent' ? 'AI Agent' : activePanel === 'files' ? projectName || 'Explorer' : PANELS.find(p => p.id === activePanel)?.title}</span>
          </div>
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
        </Panel>

        {/* Vertical Resize Handle */}
        <PanelResizeHandle style={{ width: 4, background: 'transparent', cursor: 'col-resize', transition: 'background 0.2s' }} 
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        />

        {/* Main Editor/Terminal Area */}
        <Panel style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Topbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 16px', background: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-default)', flexShrink: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '-0.3px' }}>Orion IDE</div>
            <RunButton onRun={runCode} onStop={stopExecution} isRunning={isRunning} />
          </div>
          
          <PanelGroup direction="vertical">
            {/* Editor Panel */}
            <Panel defaultSize={70} minSize={30}>
              <div style={{ height: '100%', overflow: 'hidden' }}>
                <EditorPane />
              </div>
            </Panel>

            {/* Horizontal Resize Handle */}
            <PanelResizeHandle style={{ height: 4, background: 'transparent', cursor: 'row-resize', transition: 'background 0.2s', borderTop: '1px solid var(--border-default)' }} 
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            />

            {/* Terminal Panel */}
            <Panel defaultSize={30} minSize={15}>
              <TerminalPanel lines={lines} isRunning={isRunning} onClear={clearTerminal} />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default IDELayout;
