/**
 * Orion IDE — main authenticated shell
 */

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  Files, Search as SearchIcon, GitBranch, Bot, Play, Settings as SettingsIcon,
  ChevronDown, Save, LogOut, Sun, Moon, TerminalSquare, FilePlus, FolderPlus,
  PanelLeft, FolderKanban,
} from 'lucide-react';

import { useEditor } from '../../context/EditorContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useRunTerminal } from '../../hooks/useRunTerminal';
import { getLanguageByFileName } from '../../utils/languageMap';

import MenuBar from './MenuBar';
import CommandPalette from './CommandPalette';
import FileTree from '../explorer/FileTree';
import EditorPane from '../editor/EditorPane';
import BottomDock from '../terminal/BottomDock';
import GitPanel from '../git/GitPanel';
import AgentPanel from '../agents/AgentPanel';
import SearchPanel from '../search/SearchPanel';
import SettingsPanel from '../settings/SettingsPanel';
import RunPanel from '../run/RunPanel';
import { BrandMark, IconButton, Kbd } from '../ui/primitives';

const ACTIVITIES = [
  { key: 'explorer', icon: <Files size={18} />, label: 'Explorer' },
  { key: 'search', icon: <SearchIcon size={18} />, label: 'Search' },
  { key: 'git', icon: <GitBranch size={18} />, label: 'Source Control' },
  { key: 'agents', icon: <Bot size={18} />, label: 'Agents' },
  { key: 'run', icon: <Play size={18} />, label: 'Run' },
  { key: 'settings', icon: <SettingsIcon size={18} />, label: 'Settings' },
];

const SAVE_LABELS = { saving: 'Saving…', saved: 'Saved', error: 'Save failed' };

export default function IDEShell({
  projectId, projectName, onBackToProjects,
}) {
  const {
    activeFile, saveFile, closeFile, cursorPosition, saveStatus, revealLine,
  } = useEditor();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const toast = useToast();
  const { outputLines, running, run, stop, clear } = useRunTerminal();

  const [activity, setActivity] = useState('explorer');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dockOpen, setDockOpen] = useState(false);
  const [dockTab, setDockTab] = useState('terminal');
  const [paletteOpen, setPaletteOpen] = useState(false);

  const fileTreeRef = useRef(null);

  const openTerminal = useCallback(() => {
    setDockOpen(true);
    setDockTab('terminal');
  }, []);

  const handleActivityClick = useCallback((key) => {
    setActivity((prevActivity) => {
      if (prevActivity === key) {
        setSidebarOpen((open) => !open);
        return prevActivity;
      }
      setSidebarOpen(true);
      return key;
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!activeFile) return;
    saveFile(activeFile.id)
      .then(() => toast.success('Saved to Drive'))
      .catch((err) => toast.error(err?.response?.data?.error?.message || err.message || 'Save failed'));
  }, [activeFile, saveFile, toast]);

  const handleRun = useCallback(() => {
    if (!activeFile) return;
    run(activeFile);
    setDockOpen(true);
    setDockTab('output');
  }, [activeFile, run]);

  const handleOpenProblem = useCallback((problem) => {
    const name = problem.filePath ? problem.filePath.split('/').pop() : 'file';
    revealLine({ id: problem.fileId, name }, problem.line || 1);
  }, [revealLine]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === '`') {
        e.preventDefault();
        setDockTab('terminal');
        setDockOpen((o) => !o);
      } else if (key === 'b') {
        e.preventDefault();
        setSidebarOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const commands = useMemo(() => [
    { id: 'new-file', label: 'File: New File', icon: <FilePlus size={14} />, action: () => fileTreeRef.current?.newFile() },
    { id: 'new-folder', label: 'File: New Folder', icon: <FolderPlus size={14} />, action: () => fileTreeRef.current?.newFolder() },
    { id: 'save', label: 'File: Save', hint: 'Ctrl S', icon: <Save size={14} />, action: handleSave },
    { id: 'close-file', label: 'File: Close Editor', action: () => activeFile && closeFile(activeFile.id) },
    { id: 'run', label: 'Run: Run Active File', icon: <Play size={14} />, action: handleRun },
    { id: 'toggle-terminal', label: 'View: Toggle Terminal', hint: 'Ctrl `', icon: <TerminalSquare size={14} />, action: openTerminal },
    { id: 'toggle-sidebar', label: 'View: Toggle Sidebar', hint: 'Ctrl B', icon: <PanelLeft size={14} />, action: () => setSidebarOpen((o) => !o) },
    { id: 'goto-explorer', label: 'View: Explorer', icon: <Files size={14} />, action: () => handleActivityGoto('explorer') },
    { id: 'goto-search', label: 'View: Search', icon: <SearchIcon size={14} />, action: () => handleActivityGoto('search') },
    { id: 'goto-git', label: 'View: Source Control', icon: <GitBranch size={14} />, action: () => handleActivityGoto('git') },
    { id: 'goto-agents', label: 'View: Agents', icon: <Bot size={14} />, action: () => handleActivityGoto('agents') },
    { id: 'goto-settings', label: 'View: Settings', icon: <SettingsIcon size={14} />, action: () => handleActivityGoto('settings') },
    { id: 'toggle-theme', label: 'Preferences: Toggle Theme', icon: theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />, action: toggleTheme },
    { id: 'back-projects', label: 'Workspace: Back to Projects', icon: <FolderKanban size={14} />, action: onBackToProjects },
    { id: 'sign-out', label: 'Account: Sign Out', icon: <LogOut size={14} />, action: logout },
  ], [handleSave, handleRun, openTerminal, theme, toggleTheme, onBackToProjects, logout, activeFile, closeFile]);

  function handleActivityGoto(key) {
    setActivity(key);
    setSidebarOpen(true);
  }

  const saveLabel = activeFile ? (SAVE_LABELS[saveStatus[activeFile.id]] || (activeFile.isDirty ? 'Unsaved changes' : 'Synced')) : '';
  const lang = activeFile ? getLanguageByFileName(activeFile.name) : null;

  return (
    <div className="ide">
      <div className="ide-titlebar">
        <div className="ide-title-brand">
          <BrandMark size={20} />
          <span>Orion</span>
        </div>
        <button type="button" className="ide-project-btn" onClick={onBackToProjects} title="Back to projects">
          <FolderKanban size={13} />
          <strong>{projectName}</strong>
          <ChevronDown size={12} />
        </button>
        <MenuBar
          hasActiveFile={Boolean(activeFile)}
          onNewFile={() => fileTreeRef.current?.newFile()}
          onNewFolder={() => fileTreeRef.current?.newFolder()}
          onSave={handleSave}
          onCloseFile={() => activeFile && closeFile(activeFile.id)}
          onBackToProjects={onBackToProjects}
          onTogglePalette={() => setPaletteOpen((o) => !o)}
          onToggleTerminal={openTerminal}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          onToggleDock={() => setDockOpen((o) => !o)}
          onToggleActivity={handleActivityGoto}
          onToggleTheme={toggleTheme}
          onAbout={() => toast.info('Orion IDE — a cloud IDE backed by your Google Drive.')}
        />
        <div className="ide-title-center">
          <button type="button" className="ide-search-chip" onClick={() => setPaletteOpen(true)}>
            <SearchIcon size={13} />
            <span style={{ flex: 1, textAlign: 'left' }}>Search or run a command</span>
            <Kbd>Ctrl K</Kbd>
          </button>
        </div>
        <div className="ide-title-right">
          <IconButton title="Run active file" onClick={handleRun} disabled={!activeFile}>
            <Play size={15} />
          </IconButton>
          <IconButton title="Toggle theme" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </IconButton>
          <IconButton title={user?.email || 'Sign out'} onClick={logout}>
            <LogOut size={15} />
          </IconButton>
        </div>
      </div>

      <div className="ide-body">
        <div className="ide-activity">
          {ACTIVITIES.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`ide-activity-btn ${activity === a.key && sidebarOpen ? 'active' : ''}`}
              title={a.label}
              onClick={() => handleActivityClick(a.key)}
            >
              {a.icon}
            </button>
          ))}
          <div className="ide-activity-spacer" />
        </div>

        <PanelGroup direction="horizontal" autoSaveId="orion-h-layout">
          {sidebarOpen && (
            <>
              <Panel id="sidebar" order={1} defaultSize={20} minSize={14} maxSize={42}>
                <div className="ide-sidebar">
                  {activity === 'explorer' && <FileTree ref={fileTreeRef} projectId={projectId} projectName={projectName} />}
                  {activity === 'search' && <SearchPanel projectId={projectId} />}
                  {activity === 'git' && <GitPanel projectId={projectId} onOpenTerminal={openTerminal} />}
                  {activity === 'agents' && <AgentPanel onFilesWritten={() => fileTreeRef.current?.refresh()} />}
                  {activity === 'run' && <RunPanel activeFile={activeFile} running={running} onRun={handleRun} onStop={stop} />}
                  {activity === 'settings' && <SettingsPanel />}
                </div>
              </Panel>
              <PanelResizeHandle />
            </>
          )}

          <Panel id="main" order={2}>
            <PanelGroup direction="vertical" autoSaveId="orion-v-layout">
              <Panel id="editor" order={1} defaultSize={dockOpen ? 68 : 100} minSize={30}>
                <EditorPane />
              </Panel>
              {dockOpen && (
                <>
                  <PanelResizeHandle />
                  <Panel id="dock" order={2} defaultSize={32} minSize={12} maxSize={75}>
                    <BottomDock
                      projectId={projectId}
                      open={dockOpen}
                      onClose={() => setDockOpen(false)}
                      activeTab={dockTab}
                      onTabChange={setDockTab}
                      outputLines={outputLines}
                      onClearOutput={clear}
                      running={running}
                      onOpenProblem={handleOpenProblem}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      <div className="ide-status">
        <button type="button" className="ide-status-item" onClick={() => { setDockTab('terminal'); setDockOpen((o) => !o); }}>
          <TerminalSquare size={12} /> Terminal
        </button>
        <div className="ide-status-spacer" />
        {activeFile && (
          <>
            <span className="ide-status-item">{lang?.displayName}</span>
            <span className="ide-status-item">Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
            <span className={`ide-status-item ${saveStatus[activeFile.id] === 'saved' ? 'ide-status-accent' : ''}`}>
              {saveLabel}
            </span>
          </>
        )}
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </div>
  );
}
