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
import Terminal from '../Terminal/Terminal';
import RunButton from '../Topbar/RunButton';
import FileTree from '../FileTree/FileTree';
import AgentPanel from '../AgentPanel/AgentPanel';
import useTerminal from '../../hooks/useTerminal';
import useFileTree from '../../hooks/useFileTree';

/* ── SVG Icons ────────────────────────────────────────────────────────── */
const Icon = ({ d, active }) => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill={active ? '#c9d1d9' : '#7d8590'}><path fillRule="evenodd" d={d} /></svg>
);

const ICONS = {
  files: "M3.75 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v8.086A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25V1.75z",
  search: "M11.5 7a4.499 4.499 0 11-8.998 0A4.499 4.499 0 0111.5 7zm-.82 4.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04z",
  git: "M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6.5A3.5 3.5 0 019 10H6.5v1.128a2.25 2.25 0 11-1.5 0V4.872a2.25 2.25 0 111.5 0v3.628H9a2 2 0 002-2V5.372a2.25 2.25 0 01-1.5-2.122zM5.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm0 9.5a.75.75 0 100 1.5.75.75 0 000-1.5z",
  run: "M1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zM8 0a8 8 0 100 16A8 8 0 008 0zM6.379 5.227A.25.25 0 006 5.442v5.117a.25.25 0 00.379.214l4.264-2.559a.25.25 0 000-.428L6.379 5.227z",
};

const AgentIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill={active ? '#c9d1d9' : '#7d8590'}>
    <path d="M5.433 2.304A4.492 4.492 0 008 3.5a4.492 4.492 0 002.567-1.196c.136.046.27.096.401.15A5.5 5.5 0 018 5a5.5 5.5 0 01-2.968-2.546c.131-.054.265-.104.401-.15zM8 6.5a6.5 6.5 0 003.25-5.75.75.75 0 00-1.064-.682A3 3 0 018 1.5 3 3 0 015.814.068a.75.75 0 00-1.064.682A6.5 6.5 0 008 6.5zM4.75 9a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM3.5 12.25a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM5.75 14a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" />
  </svg>
);

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M7.78 12.53a.75.75 0 01-1.06 0L2.47 8.28a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L4.81 7h7.44a.75.75 0 010 1.5H4.81l2.97 2.97a.75.75 0 010 1.06z" />
  </svg>
);

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
        width: 28, height: 28, borderRadius: '50%', border: '2px solid #30363d',
        cursor: 'pointer', overflow: 'hidden', padding: 0, background: '#21262d',
      }}>
        {user.picture ? (
          <img src={user.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: '#c9d1d9', fontSize: 12, fontWeight: 600 }}>
            {(user.name || '?')[0].toUpperCase()}
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: 40, left: 0, background: '#161b22', border: '1px solid #30363d',
          borderRadius: 8, padding: 8, minWidth: 180, zIndex: 999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '8px 12px', fontSize: 13, color: '#e6edf3', fontWeight: 600 }}>{user.name}</div>
          <div style={{ padding: '4px 12px 8px', fontSize: 12, color: '#7d8590' }}>{user.email}</div>
          <div style={{ borderTop: '1px solid #21262d', margin: '4px 0' }} />
          <button onClick={() => { onBackToProjects(); setOpen(false); }} style={menuBtnStyle}>
            <BackIcon /> Switch Project
          </button>
          <button onClick={() => { logout(); setOpen(false); }} style={{ ...menuBtnStyle, color: '#f85149' }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const menuBtnStyle = {
  width: '100%', padding: '8px 12px', fontSize: 13, color: '#c9d1d9', background: 'transparent',
  border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 4, display: 'flex',
  alignItems: 'center', gap: 8, fontFamily: "'Inter', sans-serif",
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
      <div style={{ fontSize: 13, color: '#484f58' }}>{labels[panel] || 'Coming soon'}</div>
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
      background: '#0d1117', color: '#c9d1d9', fontFamily: "'Inter', sans-serif",
    }}>
      {/* Activity bar */}
      <aside style={{
        width: 48, background: '#010409', borderRight: '1px solid #21262d',
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 4, flexShrink: 0,
      }}>
        {PANELS.map((p) => {
          const isActive = p.id === activePanel;
          return (
            <button key={p.id} title={p.title} onClick={() => setActivePanel(p.id)} style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isActive ? '#161b22' : 'transparent', border: 'none', borderRadius: 8,
              cursor: 'pointer', transition: 'background 0.15s', padding: 0,
              borderLeft: isActive ? '2px solid #58a6ff' : '2px solid transparent',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#161b22'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {p.icon ? <Icon d={p.icon} active={isActive} /> : <AgentIcon active={isActive} />}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ marginBottom: 12 }}>
          <UserMenu onBackToProjects={onBackToProjects} />
        </div>
      </aside>

      {/* Sidebar */}
      <div style={{
        width: 260, background: '#010409', borderRight: '1px solid #21262d',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          padding: '12px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.5px', color: '#7d8590', borderBottom: '1px solid #21262d',
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
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 16px', background: '#010409', borderBottom: '1px solid #21262d', flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#7d8590', letterSpacing: '-0.3px' }}>Orion IDE</div>
          <RunButton onRun={runCode} onStop={stopExecution} isRunning={isRunning} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <EditorPane />
        </div>
        <Terminal lines={lines} isRunning={isRunning} onClear={clearTerminal} />
      </div>
    </div>
  );
};

export default IDELayout;
