import { useCallback, useEffect, useMemo, useState } from 'react';
import { Group, Panel, Separator, useGroupRef, usePanelRef } from 'react-resizable-panels';
import {
  Files, FolderKanban, GitBranch, LogOut, Moon, Play, Save, Search as SearchIcon,
  Settings as SettingsIcon, Bot, Sun, TerminalSquare, Command, Bug, AlertCircle, ListTree, History,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useEditor } from '../../context/EditorContext';
import { useToast } from '../../context/ToastContext';
import { useModelSettings } from '../../context/ModelSettingsContext';
import { useFileTreeContext } from '../../context/FileTreeContext';
import { useRunTerminal } from '../../hooks/useRunTerminal';
import { useIdeShortcuts } from '../../hooks/useIdeShortcuts';
import { useWorkspaceNotifications } from '../../hooks/useWorkspaceNotifications';
import FileTree from '../explorer/FileTree';
import SearchPanel from '../search/SearchPanel';
import GitPanel from '../git/GitPanel';
import AgentPanel from '../agents/AgentPanel';
import OutlinePanel from '../outline/OutlinePanel';
import HistoryPanel from '../history/HistoryPanel';
import EditorPane from '../editor/EditorPane';
import BottomDock from '../terminal/BottomDock';
import SettingsPanel from '../settings/SettingsPanel';
import CommandPalette from './CommandPalette';
import MenuBar from './MenuBar';
import ConfirmModal from '../ui/ConfirmModal';
import PromptModal from '../ui/PromptModal';
import { IconButton } from '../ui/primitives';
import * as gitService from '../../services/gitService';
import * as termSession from '../../lib/terminalSession';
import { formatShortcut, modKey } from '../../utils/platform';
import {
  lspFormatDocument, lspRename, lspGoToDefinition, lspFindReferences,
  setLspOpenFileHandler, subscribeLspStatus, disposeAllLsp, parseWorkspaceUri,
} from '../../editor/lsp/monacoLsp';

const ACTIVITIES = [
  { key: 'explorer', icon: Files, label: 'Explorer', shortcut: 'Ctrl+Shift+E' },
  { key: 'search', icon: SearchIcon, label: 'Search', shortcut: 'Ctrl+Shift+F' },
  { key: 'git', icon: GitBranch, label: 'Source Control', shortcut: 'Ctrl+Shift+G' },
  { key: 'outline', icon: ListTree, label: 'Outline', shortcut: 'Ctrl+Shift+O' },
  { key: 'history', icon: History, label: 'Local History' },
  { key: 'agents', icon: Bot, label: 'Agents' },
];

const SAVE_LABELS = { dirty: 'Unsaved', saving: 'Saving…', saved: 'Saved', error: 'Error', idle: '' };
const LAYOUT_KEY = 'orion_ide_layout';

function loadIdeLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export default function IDEShell({ projectId, projectName }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    activeFile, focusedFile, saveFile, cursorPosition, saveStatus, openFile,
    toggleSplit, closeFile, closeAll, requestReveal, openFiles,
  } = useEditor();
  const tree = useFileTreeContext();
  const { label: modelLabel, configured } = useModelSettings();
  const toast = useToast();
  const { outputLines, running, run, stop, clear, stdin, setStdin } = useRunTerminal();
  useWorkspaceNotifications(true);

  const savedLayout = useMemo(() => loadIdeLayout(), []);
  const [activity, setActivity] = useState(savedLayout.activity || 'explorer');
  const [sidebarOpen, setSidebarOpen] = useState(savedLayout.sidebarOpen !== false);
  const [dockOpen, setDockOpen] = useState(savedLayout.dockOpen !== false);
  const [dockTab, setDockTab] = useState(savedLayout.dockTab || 'terminal');
  const [hLayout, setHLayout] = useState(savedLayout.hLayout || null);
  const [vLayout, setVLayout] = useState(() => {
    const layout = savedLayout.vLayout;
    if (!layout || typeof layout !== 'object') return null;
    // Avoid restoring a permanently collapsed dock when dock should be open
    if (savedLayout.dockOpen !== false && (layout.dock ?? 0) < 12) {
      return { editor: 70, dock: 30 };
    }
    return layout;
  });
  const dockPanelRef = usePanelRef();
  const dockGroupRef = useGroupRef();
  const [palette, setPalette] = useState(null);
  const [branch, setBranch] = useState('—');
  const [syncing, setSyncing] = useState(false);
  const [pendingCloseAll, setPendingCloseAll] = useState(false);
  const [pendingCloseFile, setPendingCloseFile] = useState(null);
  const [promptModal, setPromptModal] = useState(null);
  const [problemCounts, setProblemCounts] = useState({ errors: 0, warnings: 0 });
  const [lspStatus, setLspStatus] = useState({ status: 'idle' });

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({
      activity,
      sidebarOpen,
      dockOpen,
      dockTab,
      hLayout,
      vLayout,
    }));
  }, [activity, sidebarOpen, dockOpen, dockTab, hLayout, vLayout]);

  useEffect(() => subscribeLspStatus(setLspStatus), []);

  useEffect(() => () => { disposeAllLsp(); }, [projectId]);

  useEffect(() => {
    setLspOpenFileHandler(async (uri, selection) => {
      const rel = parseWorkspaceUri(uri);
      if (!rel) return false;
      const files = tree.listFilesFlat?.() || [];
      const node = files.find((f) => {
        const parts = (tree.getPath(f.id) || []).map((n) => n.name);
        const path = parts.length > 1 ? parts.slice(1).join('/') : f.name;
        return path === rel || f.name === rel || path.endsWith(`/${rel}`);
      });
      if (!node) {
        toast.info(`Open ${rel} from Explorer to follow definition`);
        return false;
      }
      const line = selection?.startLineNumber || selection?.selectionStartLineNumber;
      const column = selection?.startColumn || selection?.selectionStartColumn || 1;
      await openFile(node, line ? { line, column } : {});
      return true;
    });
    return () => setLspOpenFileHandler(null);
  }, [tree, openFile, toast]);

  useEffect(() => {
    const recount = () => {
      let errors = 0;
      let warnings = 0;
      const seen = new Set();
      Object.entries(window.__orionMarkers || {}).forEach(([key, markers]) => {
        if (seen.has(key)) return;
        seen.add(key);
        (markers || []).forEach((m) => {
          if (m.severity === 8) errors += 1;
          else if (m.severity === 4) warnings += 1;
        });
      });
      setProblemCounts({ errors, warnings });
    };
    recount();
    window.addEventListener('orion-markers-changed', recount);
    const t = setInterval(recount, 2500);
    return () => {
      window.removeEventListener('orion-markers-changed', recount);
      clearInterval(t);
    };
  }, [openFiles]);

  useEffect(() => {
    const panel = dockPanelRef.current;
    const group = dockGroupRef.current;
    if (!panel) return;

    const openDock = () => {
      try {
        if (panel.isCollapsed?.()) panel.expand();
        // Numeric resize() is pixels; use "%" so we don't land below minSize and re-collapse.
        const size = panel.getSize?.();
        if (!size || size.asPercentage < 12) {
          panel.resize?.('30%');
          group?.setLayout?.({ editor: 70, dock: 30 });
        }
      } catch {
        /* panel API may not be ready on first paint */
      }
    };

    try {
      if (dockOpen) {
        openDock();
        // Expand/minSize prop updates need a frame before size sticks.
        const t = window.setTimeout(openDock, 0);
        const t2 = window.setTimeout(openDock, 50);
        return () => {
          window.clearTimeout(t);
          window.clearTimeout(t2);
        };
      }
      if (!panel.isCollapsed?.()) panel.collapse?.();
    } catch {
      /* panel API may not be ready on first paint */
    }
    return undefined;
  }, [dockOpen, dockPanelRef, dockGroupRef]);

  const statusFile = focusedFile || activeFile;

  useEffect(() => {
    let errors = 0;
    let warnings = 0;
    openFiles.forEach((f) => {
      (window.__orionMarkers?.[f.id] || []).forEach((m) => {
        if (m.severity === 8) errors += 1;
        else if (m.severity === 4) warnings += 1;
      });
    });
    setProblemCounts({ errors, warnings });
    const t = setInterval(() => {
      let e = 0;
      let w = 0;
      openFiles.forEach((f) => {
        (window.__orionMarkers?.[f.id] || []).forEach((m) => {
          if (m.severity === 8) e += 1;
          else if (m.severity === 4) w += 1;
        });
      });
      setProblemCounts({ errors: e, warnings: w });
    }, 2000);
    return () => clearInterval(t);
  }, [openFiles]);

  const openActivity = useCallback((key) => {
    setActivity(key);
    setSidebarOpen(true);
  }, []);

  const onActivity = (key) => {
    setActivity((prev) => {
      if (prev === key) {
        setSidebarOpen((o) => !o);
        return prev;
      }
      setSidebarOpen(true);
      return key;
    });
  };

  const refreshBranch = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await gitService.getStatus(projectId);
      setBranch(res.data?.data?.branch || '—');
    } catch {
      setBranch('—');
    }
  }, [projectId]);

  useEffect(() => {
    refreshBranch();
    const t = setInterval(refreshBranch, 30000);
    return () => clearInterval(t);
  }, [refreshBranch]);

  const handleSave = useCallback(() => {
    if (!statusFile) return;
    saveFile(statusFile.id)
      .catch((err) => toast.error(err?.response?.data?.error?.message || err.message));
  }, [statusFile, saveFile, toast]);

  const handleRun = useCallback(async () => {
    if (!statusFile) {
      toast.info('Open a file to run');
      return;
    }
    setDockOpen(true);
    setDockTab('output');
    const result = await run(statusFile);
    if (!result) return;
    if (result.ok) toast.success(`Ran ${statusFile.name}`);
    else if (result.exitCode != null && result.exitCode !== 0) {
      toast.error(`${statusFile.name} exited ${result.exitCode}`);
    }
  }, [statusFile, run, toast]);

  const handleCloseEditor = useCallback(() => {
    if (!statusFile) return;
    const result = closeFile(statusFile.id);
    if (result?.needsConfirm) setPendingCloseFile(result.file || statusFile);
  }, [statusFile, closeFile]);

  const handleCloseAll = useCallback(() => {
    const result = closeAll();
    if (result?.needsConfirm) setPendingCloseAll(true);
  }, [closeAll]);

  const handleGoToLine = useCallback(() => {
    if (!statusFile) {
      toast.info('Open a file first');
      return;
    }
    setPromptModal({
      kind: 'goto',
      title: 'Go to Line',
      label: 'Line number',
      initialValue: String(cursorPosition.line || 1),
      confirmLabel: 'Go',
    });
  }, [statusFile, cursorPosition.line, toast]);

  const handleNewFile = useCallback(() => {
    openActivity('explorer');
    setPromptModal({
      kind: 'newfile',
      title: 'New File',
      label: 'File name',
      initialValue: 'untitled.py',
      placeholder: 'e.g. main.py',
      confirmLabel: 'Create',
    });
  }, [openActivity]);

  const submitPrompt = useCallback((value) => {
    const kind = promptModal?.kind;
    setPromptModal(null);
    if (kind === 'goto') {
      const line = Number.parseInt(value, 10);
      if (!Number.isFinite(line) || line < 1) {
        toast.error('Invalid line number');
        return;
      }
      if (statusFile) requestReveal(statusFile.id, line, 1);
      return;
    }
    if (kind === 'newfile') {
      const name = String(value || '').trim();
      if (!name) return;
      tree.createItem(name, 'file')
        .then((node) => openFile(node))
        .catch((err) => toast.error(err?.response?.data?.error?.message || err.message));
    }
  }, [promptModal, statusFile, requestReveal, toast, tree, openFile]);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setDockOpen(true);
    setDockTab('terminal');
    try {
      await termSession.ensureSession(projectId);
      const result = await termSession.syncWithDrive('push');
      const push = result?.push || result || {};
      toast.success(`Synced (+${push.created || 0} ~${push.updated || 0})`);
      refreshBranch();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [syncing, projectId, toast, refreshBranch]);

  const openDebug = useCallback(() => {
    setDockOpen(true);
    setDockTab('debug');
  }, []);

  const commands = useMemo(() => ([
    { id: 'save', label: 'File: Save', shortcut: 'Ctrl+S', keywords: 'save write', run: handleSave },
    { id: 'newfile', label: 'File: New File', keywords: 'create', run: handleNewFile },
    { id: 'close', label: 'File: Close Editor', shortcut: 'Ctrl+W', run: handleCloseEditor },
    { id: 'closeall', label: 'File: Close All Editors', run: handleCloseAll },
    { id: 'run', label: 'Run: Execute Current File', shortcut: 'Ctrl+Enter', keywords: 'run execute', run: handleRun },
    { id: 'debug', label: 'Debug: Open Panel', keywords: 'breakpoint dap', run: openDebug },
    { id: 'goto', label: 'Go to Line…', shortcut: 'Ctrl+G', keywords: 'line jump', run: handleGoToLine },
    { id: 'format', label: 'Editor: Format Document', shortcut: 'Alt+Shift+F', keywords: 'prettier lsp format', run: () => { const ed = window.__orionActiveEditor; if (ed) lspFormatDocument(ed); } },
    { id: 'inline', label: 'Editor: Inline AI Edit', shortcut: 'Ctrl+K', keywords: 'ai rewrite cursor edit', run: () => { window.__orionOpenInlineEdit?.(); } },
    { id: 'rename', label: 'Editor: Rename Symbol', shortcut: 'F2', keywords: 'refactor lsp', run: () => { const ed = window.__orionActiveEditor; if (ed) lspRename(ed); } },
    { id: 'definition', label: 'Editor: Go to Definition', shortcut: 'F12', keywords: 'lsp jump', run: () => { const ed = window.__orionActiveEditor; if (ed) lspGoToDefinition(ed); } },
    { id: 'peek', label: 'Editor: Peek Definition', shortcut: 'Alt+F12', keywords: 'lsp peek', run: () => { const ed = window.__orionActiveEditor; if (ed) ed.trigger('orion', 'editor.action.peekDefinition', {}); } },
    { id: 'references', label: 'Editor: Find All References', shortcut: 'Shift+F12', keywords: 'lsp refs', run: () => { const ed = window.__orionActiveEditor; if (ed) lspFindReferences(ed); } },
    { id: 'outline', label: 'View: Show Outline', shortcut: 'Ctrl+Shift+O', keywords: 'symbols', run: () => openActivity('outline') },
    { id: 'history', label: 'View: Local History', keywords: 'timeline snapshot restore', run: () => openActivity('history') },
    { id: 'split', label: 'View: Toggle Split Editor', keywords: 'columns side', run: toggleSplit },
    { id: 'quickopen', label: 'Go to File…', shortcut: 'Ctrl+P', keywords: 'open file', run: () => setPalette('files') },
    { id: 'palette', label: 'Show All Commands', shortcut: 'Ctrl+Shift+P', run: () => setPalette('commands') },
    { id: 'explorer', label: 'View: Show Explorer', run: () => openActivity('explorer') },
    { id: 'search', label: 'View: Show Search', run: () => openActivity('search') },
    { id: 'git', label: 'View: Show Source Control', run: () => openActivity('git') },
    { id: 'agents', label: 'View: Show Agents', run: () => openActivity('agents') },
    { id: 'settings', label: 'Preferences: Open Settings', run: () => openActivity('settings') },
    { id: 'sidebar', label: 'View: Toggle Sidebar', shortcut: 'Ctrl+B', run: () => setSidebarOpen((o) => !o) },
    { id: 'terminal', label: 'View: Toggle Terminal', shortcut: 'Ctrl+`', run: () => setDockOpen((o) => !o) },
    { id: 'problems', label: 'View: Problems', run: () => { setDockOpen(true); setDockTab('problems'); } },
    { id: 'ports', label: 'View: Ports', run: () => { setDockOpen(true); setDockTab('ports'); } },
    { id: 'tests', label: 'View: Tests', keywords: 'pytest jest npm', run: () => { setDockOpen(true); setDockTab('tests'); } },
    { id: 'tasks', label: 'View: Tasks', keywords: 'tasks.json npm run', run: () => { setDockOpen(true); setDockTab('tasks'); } },
    { id: 'theme', label: 'Preferences: Toggle Color Theme', run: toggleTheme },
    { id: 'projects', label: 'File: Open Projects', run: () => navigate('/projects') },
    { id: 'sync', label: 'Drive: Sync Workspace', keywords: 'push drive', run: handleSync },
    { id: 'logout', label: 'Account: Sign Out', run: () => logout().then(() => navigate('/login')) },
  ]).map((c) => (c.shortcut ? { ...c, shortcut: formatShortcut(c.shortcut) } : c)), [
    handleSave, handleNewFile, handleCloseEditor, handleCloseAll, handleRun, openDebug,
    handleGoToLine, toggleSplit, openActivity, toggleTheme, navigate, logout, handleSync,
  ]);

  const menus = useMemo(() => ([
    {
      key: 'file',
      label: 'File',
      items: [
        { id: 'm-new', label: 'New File', run: handleNewFile },
        { id: 'm-open', label: 'Go to File…', shortcut: formatShortcut('Ctrl+P'), run: () => setPalette('files') },
        { divider: true },
        { id: 'm-save', label: 'Save', shortcut: formatShortcut('Ctrl+S'), run: handleSave, disabled: !statusFile },
        { id: 'm-close', label: 'Close Editor', shortcut: formatShortcut('Ctrl+W'), run: handleCloseEditor, disabled: !statusFile },
        { id: 'm-closeall', label: 'Close All', run: handleCloseAll, disabled: openFiles.length === 0 },
        { divider: true },
        { id: 'm-sync', label: 'Sync Workspace', run: handleSync },
        { id: 'm-projects', label: 'Open Projects', run: () => navigate('/projects') },
        { id: 'm-logout', label: 'Sign Out', run: () => logout().then(() => navigate('/login')) },
      ],
    },
    {
      key: 'edit',
      label: 'Edit',
      items: [
        { id: 'm-palette', label: 'Command Palette…', shortcut: formatShortcut('Ctrl+Shift+P'), run: () => setPalette('commands') },
        { id: 'm-goto', label: 'Go to Line…', shortcut: formatShortcut('Ctrl+G'), run: handleGoToLine, disabled: !statusFile },
        { divider: true },
        { id: 'm-format', label: 'Format Document', shortcut: formatShortcut('Alt+Shift+F'), run: () => { const ed = window.__orionActiveEditor; if (ed) lspFormatDocument(ed); }, disabled: !statusFile },
        { id: 'm-inline', label: 'Inline AI Edit…', shortcut: formatShortcut('Ctrl+K'), run: () => { window.__orionOpenInlineEdit?.(); }, disabled: !statusFile },
        { id: 'm-rename', label: 'Rename Symbol', shortcut: 'F2', run: () => { const ed = window.__orionActiveEditor; if (ed) lspRename(ed); }, disabled: !statusFile },
        { id: 'm-def', label: 'Go to Definition', shortcut: 'F12', run: () => { const ed = window.__orionActiveEditor; if (ed) lspGoToDefinition(ed); }, disabled: !statusFile },
        { id: 'm-peek', label: 'Peek Definition', shortcut: formatShortcut('Alt+F12'), run: () => { const ed = window.__orionActiveEditor; if (ed) ed.trigger('orion', 'editor.action.peekDefinition', {}); }, disabled: !statusFile },
        { id: 'm-refs', label: 'Find All References', shortcut: formatShortcut('Shift+F12'), run: () => { const ed = window.__orionActiveEditor; if (ed) lspFindReferences(ed); }, disabled: !statusFile },
      ],
    },
    {
      key: 'view',
      label: 'View',
      items: [
        { id: 'm-explorer', label: 'Explorer', shortcut: formatShortcut('Ctrl+Shift+E'), run: () => openActivity('explorer') },
        { id: 'm-search', label: 'Search', shortcut: formatShortcut('Ctrl+Shift+F'), run: () => openActivity('search') },
        { id: 'm-git', label: 'Source Control', shortcut: formatShortcut('Ctrl+Shift+G'), run: () => openActivity('git') },
        { id: 'm-outline', label: 'Outline', shortcut: formatShortcut('Ctrl+Shift+O'), run: () => openActivity('outline') },
        { id: 'm-history', label: 'Local History', run: () => openActivity('history') },
        { id: 'm-agents', label: 'Agents', run: () => openActivity('agents') },
        { divider: true },
        { id: 'm-sidebar', label: 'Toggle Sidebar', shortcut: formatShortcut('Ctrl+B'), run: () => setSidebarOpen((o) => !o) },
        { id: 'm-term', label: 'Toggle Terminal', shortcut: formatShortcut('Ctrl+`'), run: () => setDockOpen((o) => !o) },
        { id: 'm-split', label: 'Toggle Split Editor', shortcut: formatShortcut('Ctrl+\\'), run: toggleSplit },
        { id: 'm-problems', label: 'Problems', run: () => { setDockOpen(true); setDockTab('problems'); } },
        { id: 'm-ports', label: 'Ports', run: () => { setDockOpen(true); setDockTab('ports'); } },
        { id: 'm-tests', label: 'Tests', run: () => { setDockOpen(true); setDockTab('tests'); } },
        { id: 'm-tasks', label: 'Tasks', run: () => { setDockOpen(true); setDockTab('tasks'); } },
        { divider: true },
        { id: 'm-theme', label: 'Toggle Color Theme', run: toggleTheme },
        { id: 'm-settings', label: 'Settings', run: () => openActivity('settings') },
      ],
    },
    {
      key: 'run',
      label: 'Run',
      items: [
        { id: 'm-run', label: 'Run File', shortcut: formatShortcut('Ctrl+Enter'), run: handleRun, disabled: !statusFile },
        { id: 'm-debug', label: 'Open Debug', run: openDebug },
        { id: 'm-output', label: 'Show Output', run: () => { setDockOpen(true); setDockTab('output'); } },
      ],
    },
    {
      key: 'git',
      label: 'Git',
      items: [
        { id: 'm-scm', label: 'Source Control', run: () => openActivity('git') },
        { id: 'm-syncgit', label: 'Sync Workspace', run: handleSync },
      ],
    },
  ]), [
    handleNewFile, handleSave, handleCloseEditor, handleCloseAll, handleSync, navigate, logout,
    handleGoToLine, statusFile, openFiles.length, openActivity, toggleSplit, toggleTheme,
    handleRun, openDebug,
  ]);

  const fileEntries = useMemo(() => {
    return tree.listFilesFlat().map((f) => {
      const path = tree.getPath(f.id).map((n) => n.name).join('/');
      return { ...f, path };
    });
  }, [tree, tree.nodesById]);

  const shortcutHandlers = useMemo(() => ({
    'mod+s': handleSave,
    'mod+enter': handleRun,
    'mod+p': () => setPalette('files'),
    'mod+shift+p': () => setPalette('commands'),
    'mod+`': () => setDockOpen((o) => !o),
    'mod+b': () => setSidebarOpen((o) => !o),
    'mod+\\': toggleSplit,
    'mod+w': handleCloseEditor,
    'mod+g': handleGoToLine,
    'mod+shift+e': () => openActivity('explorer'),
    'mod+shift+f': () => openActivity('search'),
    'mod+shift+g': () => openActivity('git'),
    'mod+shift+o': () => openActivity('outline'),
    'mod+shift+m': () => { setDockOpen(true); setDockTab('problems'); },
    f12: () => { const ed = window.__orionActiveEditor; if (ed) lspGoToDefinition(ed); },
    'shift+f12': () => { const ed = window.__orionActiveEditor; if (ed) lspFindReferences(ed); },
    'alt+f12': () => {
      const ed = window.__orionActiveEditor;
      if (ed) ed.trigger('orion', 'editor.action.peekDefinition', {});
    },
    f2: () => { const ed = window.__orionActiveEditor; if (ed) lspRename(ed); },
    'alt+shift+f': () => { const ed = window.__orionActiveEditor; if (ed) lspFormatDocument(ed); },
    'mod+k': () => { window.__orionOpenInlineEdit?.(); },
    escape: () => setPalette(null),
  }), [handleSave, handleRun, openActivity, toggleSplit, handleCloseEditor, handleGoToLine]);

  useIdeShortcuts(shortcutHandlers);

  const saveLabel = statusFile
    ? (SAVE_LABELS[saveStatus[statusFile.id]] || (statusFile.isDirty ? 'Modified' : 'Saved'))
    : '';

  return (
    <div className="ide-root">
      <div className="ide-chrome">
        <header className="ide-menubar">
          <div className="brand">
            Orion
            <span>.</span>
          </div>
          <MenuBar menus={menus} />
          <div className="sep" />
          <span className="project-name" title={projectName}>{projectName || 'Project'}</span>
          <div className="grow" />
          <div className="menubar-actions">
            <IconButton title={`Command Palette (${formatShortcut('Ctrl+Shift+P')})`} onClick={() => setPalette('commands')}>
              <Command size={18} strokeWidth={2} />
            </IconButton>
            <IconButton title={`Save (${formatShortcut('Ctrl+S')})`} onClick={handleSave} disabled={!statusFile}>
              <Save size={18} strokeWidth={2} />
            </IconButton>
            <IconButton title={`Run (${formatShortcut('Ctrl+Enter')})`} onClick={handleRun} disabled={!statusFile || running} className="accent-icon">
              <Play size={18} strokeWidth={2} />
            </IconButton>
            <IconButton title="Debug" onClick={openDebug} className={dockTab === 'debug' && dockOpen ? 'active' : ''}>
              <Bug size={18} strokeWidth={2} />
            </IconButton>
            <IconButton
              title={`Toggle Terminal (${formatShortcut('Ctrl+`')})`}
              onClick={() => setDockOpen((o) => !o)}
              className={dockOpen ? 'active' : ''}
            >
              <TerminalSquare size={18} strokeWidth={2} />
            </IconButton>
            <span className="menubar-sep" aria-hidden="true" />
            <IconButton title="Projects" onClick={() => navigate('/projects')}>
              <FolderKanban size={18} strokeWidth={2} />
            </IconButton>
            <IconButton title="Toggle Theme" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
            </IconButton>
            <IconButton title="Sign out" onClick={() => logout().then(() => navigate('/login'))}>
              <LogOut size={18} strokeWidth={2} />
            </IconButton>
          </div>
        </header>

        <div className="ide-body">
          <nav className="activity-bar" aria-label="Activity">
            {ACTIVITIES.map(({ key, icon: Icon, label, shortcut }) => (
              <IconButton
                key={key}
                title={shortcut ? `${label} (${formatShortcut(shortcut)})` : label}
                className={`activity-btn ${activity === key && sidebarOpen ? 'active' : ''}`}
                onClick={() => onActivity(key)}
              >
                <Icon size={20} strokeWidth={1.6} />
              </IconButton>
            ))}
            <div className="spacer" />
            <IconButton
              title="Settings"
              className={`activity-btn ${activity === 'settings' && sidebarOpen ? 'active' : ''}`}
              onClick={() => onActivity('settings')}
            >
              <SettingsIcon size={20} strokeWidth={1.6} />
            </IconButton>
          </nav>

          <Group
            id="ide-h"
            orientation="horizontal"
            className="ide-panels"
            defaultLayout={hLayout || undefined}
            onLayoutChanged={(layout) => setHLayout(layout)}
          >
            {sidebarOpen && (
              <>
                <Panel id="sidebar" defaultSize="22%" minSize="18%" maxSize="40%" className="ide-panel">
                  <aside className="ide-sidebar">
                    {activity === 'explorer' && <FileTree projectId={projectId} />}
                    {activity === 'search' && <SearchPanel />}
                    {activity === 'git' && (
                      <GitPanel projectId={projectId} onBranchChange={setBranch} />
                    )}
                    {activity === 'outline' && (
                      <OutlinePanel
                        onReveal={(line, column) => {
                          if (statusFile?.id) requestReveal(statusFile.id, line, column);
                        }}
                      />
                    )}
                    {activity === 'history' && <HistoryPanel />}
                    {activity === 'settings' && (
                      <div className="side-panel">
                        <div className="ide-sidebar-title"><span>Settings</span></div>
                        <SettingsPanel />
                      </div>
                    )}
                    {activity === 'agents' && (
                      <AgentPanel projectId={projectId} projectName={projectName} />
                    )}
                  </aside>
                </Panel>
                <Separator className="ide-sep-v" />
              </>
            )}

            <Panel id="main" minSize="30%" className="ide-panel">
              <Group
                id="ide-v"
                orientation="vertical"
                className="ide-panels"
                groupRef={dockGroupRef}
                defaultLayout={vLayout || undefined}
                onLayoutChanged={(layout) => {
                  // Ignore transient 0-height layouts while the dock is meant to be open
                  if (dockOpen && (layout.dock ?? 0) < 8) return;
                  setVLayout(layout);
                }}
              >
                <Panel id="editor" defaultSize={dockOpen ? '70%' : '100%'} minSize="25%" className="ide-panel">
                  <EditorPane projectId={projectId} />
                </Panel>
                <Separator className={`ide-sep-h ${dockOpen ? '' : 'collapsed'}`} />
                <Panel
                  id="dock"
                  panelRef={dockPanelRef}
                  defaultSize={dockOpen ? '30%' : '0%'}
                  minSize={dockOpen ? '12%' : '0%'}
                  collapsedSize="0%"
                  collapsible
                  className={`ide-panel dock-panel ${dockOpen ? '' : 'dock-collapsed'}`}
                >
                  <BottomDock
                    projectId={projectId}
                    open={dockOpen}
                    activeTab={dockTab}
                    onTabChange={setDockTab}
                    outputLines={outputLines}
                    running={running}
                    onStop={stop}
                    onClear={clear}
                    stdin={stdin}
                    onStdinChange={setStdin}
                  />
                </Panel>
              </Group>
            </Panel>
          </Group>
        </div>

        <footer className="ide-status">
          <button type="button" className="status-item" onClick={() => openActivity('git')}>
            <GitBranch size={11} />
            {branch}
          </button>
          <button
            type="button"
            className={`status-item ${(problemCounts.errors || problemCounts.warnings) ? '' : 'muted'}`}
            onClick={() => { setDockOpen(true); setDockTab('problems'); }}
          >
            <AlertCircle size={11} className={problemCounts.errors ? 'sev-error' : ''} />
            <span className={problemCounts.errors ? 'sev-error' : ''}>{problemCounts.errors}</span>
            <span className="muted">·</span>
            <span className={problemCounts.warnings ? 'sev-warn' : ''}>{problemCounts.warnings}</span>
          </button>
          <span className="status-item">
            Ln
            {' '}
            {cursorPosition.line}
            , Col
            {' '}
            {cursorPosition.column}
          </span>
          {statusFile && (
            <span className="status-item" title={statusFile.name}>
              {statusFile.language}
            </span>
          )}
          <span
            className={`status-item lsp-status lsp-${lspStatus.status || 'idle'}`}
            title={
              lspStatus.message
              || `Language server${lspStatus.language ? ` (${lspStatus.language})` : ''}: ${lspStatus.status || 'idle'}`
            }
          >
            LSP
            {lspStatus.language ? ` · ${lspStatus.language}` : ''}
            {' '}
            {lspStatus.status === 'ready' || lspStatus.status === 'connected'
              ? '●'
              : lspStatus.status === 'connecting'
                ? '…'
                : lspStatus.status === 'unavailable'
                  ? '○'
                  : lspStatus.status === 'error'
                    ? '!'
                    : '·'}
          </span>
          {statusFile && (
            <span className={`status-item ${saveStatus[statusFile.id] === 'saved' ? 'ok' : ''} ${statusFile.isDirty ? 'dirty-status' : ''}`}>
              {saveLabel || (statusFile.isDirty ? '● Modified' : '')}
            </span>
          )}
          {syncing && <span className="status-item">Syncing…</span>}
          <span className="grow" />
          <button
            type="button"
            className={`status-item ${configured ? 'ok' : ''}`}
            onClick={() => openActivity('settings')}
            title="Model settings"
          >
            {configured ? modelLabel : 'Configure model'}
          </button>
          <span className="status-item muted">{user?.email || user?.name || ''}</span>
        </footer>
      </div>

      <CommandPalette
        open={Boolean(palette)}
        mode={palette === 'files' ? 'files' : 'commands'}
        commands={commands}
        files={fileEntries}
        onClose={() => setPalette(null)}
        onRunCommand={(cmd) => cmd.run?.()}
        onOpenFile={(file) => {
          openFile(file).catch((err) => toast.error(err.message));
        }}
      />

      <ConfirmModal
        open={pendingCloseAll}
        title="Unsaved changes"
        message="Close all editors without saving?"
        confirmLabel="Don't Save"
        cancelLabel="Cancel"
        danger
        onCancel={() => setPendingCloseAll(false)}
        onConfirm={() => {
          closeAll({ force: true });
          setPendingCloseAll(false);
        }}
      />

      <ConfirmModal
        open={Boolean(pendingCloseFile)}
        title="Unsaved changes"
        message={`Close "${pendingCloseFile?.name}" without saving?`}
        confirmLabel="Don't Save"
        cancelLabel="Cancel"
        danger
        onCancel={() => setPendingCloseFile(null)}
        onConfirm={() => {
          if (pendingCloseFile) closeFile(pendingCloseFile.id, { force: true });
          setPendingCloseFile(null);
        }}
      />

      <PromptModal
        open={Boolean(promptModal)}
        title={promptModal?.title}
        label={promptModal?.label}
        initialValue={promptModal?.initialValue || ''}
        placeholder={promptModal?.placeholder || ''}
        confirmLabel={promptModal?.confirmLabel || 'OK'}
        onCancel={() => setPromptModal(null)}
        onSubmit={submitPrompt}
      />
    </div>
  );
}
