import { useCallback, useEffect, useState } from 'react';
import { ListTodo, Play, RefreshCw } from 'lucide-react';
import { useFileTreeContext } from '../../context/FileTreeContext';
import { useToast } from '../../context/ToastContext';
import { IconButton, Spinner } from '../ui/primitives';
import * as driveService from '../../services/driveService';
import * as termSession from '../../lib/terminalSession';
import { formatApiError } from '../../utils/apiError';

const DEFAULT_TASKS = [
  { label: 'npm install', command: 'npm install' },
  { label: 'npm test', command: 'npm test -- --watchAll=false' },
  { label: 'npm run build', command: 'npm run build' },
  { label: 'pytest', command: 'python -m pytest -q' },
];

function normalizeTasks(raw) {
  const list = Array.isArray(raw?.tasks) ? raw.tasks : Array.isArray(raw) ? raw : [];
  return list
    .map((t, i) => {
      const label = t.label || t.name || `Task ${i + 1}`;
      let command = t.command || '';
      if (t.type === 'npm' && t.script) {
        command = `npm run ${t.script}`;
      }
      if (Array.isArray(t.args) && t.command) {
        command = [t.command, ...t.args].join(' ');
      }
      if (!command && typeof t === 'string') command = t;
      return command ? { label: String(label), command: String(command).trim() } : null;
    })
    .filter(Boolean)
    .slice(0, 40);
}

function findTasksNode(tree) {
  const files = tree.listFilesFlat?.() || [];
  const prefer = [
    (f) => f.name === 'tasks.json' && (tree.getPath?.(f.id) || []).some((n) => n.name === '.vscode' || n.name === '.orion'),
    (f) => f.name === 'tasks.json',
    (f) => f.name === '.orion-tasks.json',
  ];
  for (const pred of prefer) {
    const hit = files.find(pred);
    if (hit) return hit;
  }
  return null;
}

/**
 * Run VS Code–style tasks.json (or built-in presets) via the active PTY.
 */
export default function TasksPanel({ projectId, active, onOpenTerminal }) {
  const tree = useFileTreeContext();
  const toast = useToast();
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [source, setSource] = useState('defaults');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const node = findTasksNode(tree);
      if (!node?.id) {
        setTasks(DEFAULT_TASKS);
        setSource('defaults');
        return;
      }
      const res = await driveService.readFile(node.id);
      const content = res.data?.data?.content ?? res.data?.content ?? '';
      const parsed = JSON.parse(String(content).replace(/^\uFEFF/, ''));
      const next = normalizeTasks(parsed);
      if (next.length) {
        setTasks(next);
        setSource(node.name);
      } else {
        setTasks(DEFAULT_TASKS);
        setSource('defaults');
      }
    } catch {
      setTasks(DEFAULT_TASKS);
      setSource('defaults');
    } finally {
      setLoading(false);
    }
  }, [projectId, tree]);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const run = async (command) => {
    if (!projectId || busy) return;
    setBusy(true);
    try {
      await termSession.ensureSession(projectId);
      onOpenTerminal?.();
      await new Promise((r) => setTimeout(r, 80));
      const text = command.endsWith('\n') ? command : `${command}\n`;
      window.dispatchEvent(new CustomEvent('orion-term-input', { detail: { text } }));
      toast.success(`Running: ${command}`);
    } catch (err) {
      toast.error(formatApiError(err, 'Could not run task'));
    } finally {
      setBusy(false);
    }
  };

  if (!active) {
    return <div className="editor-empty compact"><span className="muted">Tasks</span></div>;
  }

  return (
    <div className="test-panel">
      <div className="test-panel-head">
        <ListTodo size={14} />
        <span>Tasks</span>
        {loading && <Spinner size={12} />}
        <span className="title-actions" style={{ marginLeft: 'auto' }}>
          <IconButton title="Reload tasks.json" onClick={load} disabled={loading}>
            <RefreshCw size={12} />
          </IconButton>
        </span>
      </div>
      <p className="settings-hint">
        Source:
        {' '}
        <code>{source}</code>
        {' '}
        — add
        {' '}
        <code>.vscode/tasks.json</code>
        {' '}
        or
        {' '}
        <code>.orion/tasks.json</code>
        {' '}
        in the project.
      </p>
      <div className="test-presets">
        {tasks.map((t) => (
          <button
            key={`${t.label}-${t.command}`}
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            title={t.command}
            onClick={() => run(t.command)}
          >
            <Play size={12} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
