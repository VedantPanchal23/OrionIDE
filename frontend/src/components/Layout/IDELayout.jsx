import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEditor } from '../../context/EditorContext';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
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

import { Files, Search, GitBranch, PlayCircle, Bot, Settings as SettingsIcon, ArrowLeft, ChevronLeft, ChevronRight, PanelLeft, PanelBottom, PanelRight, X, Minus, Square } from 'lucide-react';

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
  { id: 'agent', title: 'Extensions' },
  { id: 'account', title: 'Account' },
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
        width: 24, height: 24, borderRadius: '50%', border: 'none',
        cursor: 'pointer', overflow: 'hidden', padding: 0, background: 'var(--bg-emphasis)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {user.picture ? (
          <img src={user.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: 'var(--text-primary)', fontSize: 10, fontWeight: 600 }}>
            {(user.name || '?')[0].toUpperCase()}
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: 30, left: 30, background: 'var(--bg-subtle)',
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

  const stubs = {
    git: { icon: '⎇', title: 'Source Control', desc: 'Git integration coming soon.' },
    run: { icon: '▶', title: 'Run & Debug', desc: 'Use the topbar Run button.' },
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

const CustomResizeHandle = () => (
  <PanelResizeHandle style={{ width: 1, background: 'var(--border-default)', transition: 'background 0.2s', outline: 'none' }} />
);

const CustomHorizontalResizeHandle = () => (
  <PanelResizeHandle style={{ height: 1, background: 'var(--border-default)', transition: 'background 0.2s', outline: 'none' }} />
);

/* ── IDE Layout ────────────────────────────────────────────────────────── */
const IDELayout = ({ projectId, projectName, onBackToProjects }) => {
  const { lines, isRunning, clearTerminal, runCode, stopExecution } = useTerminal();
  const fileTree = useFileTree();
  const [activePanel, setActivePanel] = useState('files');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (projectId) fileTree.loadTree(projectId);
  }, [projectId]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden',
      background: '#1e1e1e', color: '#cccccc', fontFamily: 'var(--font-ui)',
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

      {/* Topbar / Titlebar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 35, background: '#333333', borderBottom: '1px solid #252526', flexShrink: 0,
        paddingLeft: 8, paddingRight: 0, userSelect: 'none'
      }}>
        {/* Left Menu Items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#cccccc' }}>
          <div style={{ cursor: 'pointer', padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center' }}>File</div>
          <div style={{ cursor: 'pointer', padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center' }}>Edit</div>
          <div style={{ cursor: 'pointer', padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center' }}>Selection</div>
          <div style={{ cursor: 'pointer', padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center' }}>View</div>
          <div style={{ cursor: 'pointer', padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center' }}>Go</div>
          <div style={{ cursor: 'pointer', padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center' }}>Run</div>
          <div style={{ cursor: 'pointer', padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center' }}>Terminal</div>
          <div style={{ cursor: 'pointer', padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center' }}>Help</div>
        </div>

        {/* Center Search Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChevronLeft size={16} color="#cccccc" style={{ cursor: 'pointer', opacity: 0.8 }} />
          <ChevronRight size={16} color="#cccccc" style={{ cursor: 'pointer', opacity: 0.8 }} />
          <button
            onClick={() => {
              const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true });
              window.dispatchEvent(event);
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '2px 24px', background: '#3c3c3c',
              border: '1px solid #3c3c3c', borderRadius: 6,
              color: '#cccccc', fontSize: 13, fontFamily: 'var(--font-ui)',
              cursor: 'pointer', width: 350,
            }}
          >
            <Search size={14} style={{ opacity: 0.8 }} />
            <span>Orion IDE</span>
          </button>
        </div>

        {/* Right Actions & Window Controls */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <div style={{ display: 'flex', gap: 8, marginRight: 16 }}>
             <PanelLeft size={16} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
             <PanelBottom size={16} style={{ cursor: 'pointer', opacity: 0.8 }} />
             <PanelRight size={16} style={{ cursor: 'pointer', opacity: 0.8 }} />
          </div>
          <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ width: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={16} /></div>
            <div style={{ width: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Square size={14} /></div>
            <div style={{ width: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#e81123'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}><X size={16} /></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Activity Bar */}
        <aside style={{
          width: 48, background: '#333333',
          display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 16, flexShrink: 0,
          zIndex: 2,
        }}>
          {PANELS.filter(p => !['settings', 'account'].includes(p.id)).map((p) => {
            const isActive = p.id === activePanel && !isSidebarCollapsed;
            return (
              <div key={p.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: 2, background: isActive ? '#007acc' : 'transparent',
                }} />
                <button title={p.title} onClick={() => {
                  if (activePanel === p.id) setIsSidebarCollapsed(!isSidebarCollapsed);
                  else { setActivePanel(p.id); setIsSidebarCollapsed(false); }
                }} style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                  color: isActive ? '#ffffff' : '#858585',
                }}>
                  {p.icon ? <p.icon size={24} strokeWidth={1.5} /> : <Bot size={24} strokeWidth={1.5} />}
                </button>
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
               <div style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 2, background: activePanel === 'account' ? '#007acc' : 'transparent' }} />
               <UserMenu onBackToProjects={onBackToProjects} />
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
               <div style={{ position: 'absolute', left: -8, top: 0, bottom: 0, width: 2, background: activePanel === 'settings' ? '#007acc' : 'transparent' }} />
               <button title="Settings" onClick={() => { setActivePanel('settings'); setIsSidebarCollapsed(false); }} style={{
                 background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                 color: activePanel === 'settings' ? '#ffffff' : '#858585',
               }}>
                 <SettingsIcon size={24} strokeWidth={1.5} />
               </button>
            </div>
          </div>
        </aside>

        {/* Resizable Layout */}
        <PanelGroup direction="horizontal">
          {!isSidebarCollapsed && (
            <>
              <Panel defaultSize={20} minSize={15} maxSize={40} style={{ display: 'flex', flexDirection: 'column', background: '#252526' }}>
                <div style={{
                  padding: '10px 20px', fontSize: 11, fontWeight: 400, color: '#cccccc',
                  textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>{activePanel === 'agent' ? 'EXTENSIONS' : PANELS.find(p => p.id === activePanel)?.title.toUpperCase()}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                     <span style={{ cursor: 'pointer', fontWeight: 'bold' }}>...</span>
                  </div>
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
              <CustomResizeHandle />
            </>
          )}

          <Panel minSize={30} style={{ display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={70} minSize={20} style={{ display: 'flex', flexDirection: 'column' }}>
                <EditorPane />
              </Panel>
              <CustomHorizontalResizeHandle />
              <Panel defaultSize={30} minSize={10} style={{ display: 'flex', flexDirection: 'column' }}>
                 <TerminalPanel lines={lines} isRunning={isRunning} onClear={clearTerminal} projectId={projectId} />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {/* Status Bar */}
      <div style={{
        height: 22, background: '#007acc', color: '#ffffff', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 8px', fontSize: 12, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <GitBranch size={12} /> main
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            ⟳ 0 ↓ 0 ↑
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            ⊗ 0 ⚠ 0
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <span style={{ fontWeight: 'bold' }}>((•))</span> Go Live
           </div>
           <div style={{ cursor: 'pointer' }}>🔔</div>
        </div>
      </div>
    </div>
  );
};

export default IDELayout;
