import { useCallback, useEffect, useState } from 'react';
import {
  CloudUpload, Eraser, Square, TerminalSquare, AlertCircle, ListTree, Bug, Radio, Plus, X, FlaskConical, ListTodo,
} from 'lucide-react';
import TerminalView from './TerminalView';
import ProblemsPanel from '../problems/ProblemsPanel';
import DebugPanel from '../debug/DebugPanel';
import PortsPanel from './PortsPanel';
import TestPanel from '../test/TestPanel';
import TasksPanel from '../tasks/TasksPanel';
import { IconButton, Spinner } from '../ui/primitives';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import * as termSession from '../../lib/terminalSession';
import { formatApiError } from '../../utils/apiError';
import { TERM_CHIP_GROUPS } from '../../lib/terminalChips';

export default function BottomDock({
  projectId, open, activeTab, onTabChange, outputLines, running, onStop, onClear,
  stdin, onStdinChange,
}) {
  const toast = useToast();
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [sessions, setSessions] = useState(() => termSession.getSessions());
  const [activeTerminalId, setActiveTerminalId] = useState(
    () => termSession.getActiveSession()?.terminalId || null,
  );
  const [termBusy, setTermBusy] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [problemSummary, setProblemSummary] = useState({ errors: 0, warnings: 0 });
  const [termStatus, setTermStatus] = useState({});

  const onTermStatus = useCallback((terminalId, status) => {
    if (!terminalId) return;
    setTermStatus((prev) => (prev[terminalId] === status ? prev : { ...prev, [terminalId]: status }));
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const tick = () => {
      let errors = 0;
      let warnings = 0;
      Object.values(window.__orionMarkers || {}).forEach((markers) => {
        (markers || []).forEach((m) => {
          if (m.severity === 8) errors += 1;
          else if (m.severity === 4) warnings += 1;
        });
      });
      setProblemSummary({ errors, warnings });
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [open]);

  const maxTerminals = user?.entitlements?.limits?.maxTerminals
    || user?.entitlements?.maxTerminals
    || 2;

  useEffect(() => {
    const unsub = termSession.subscribe(() => {
      setSessions(termSession.getSessions());
      setActiveTerminalId(termSession.getActiveSession()?.terminalId || null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await termSession.ensureSession(projectId, { maxTerminals });
        if (!cancelled) {
          setSessions(termSession.getSessions());
          setActiveTerminalId(termSession.getActiveSession()?.terminalId || null);
        }
      } catch (err) {
        if (!cancelled && open) toast.error(formatApiError(err, 'Terminal failed to start'));
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, maxTerminals, toast, open]);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await termSession.ensureSession(projectId, { maxTerminals });
      const result = await termSession.syncWithDrive('push');
      const push = result?.push || result || {};
      toast.success(`Synced (+${push.created || 0} ~${push.updated || 0})`);
    } catch (err) {
      toast.error(formatApiError(err, 'Sync failed'));
    } finally {
      setSyncing(false);
    }
  }, [syncing, projectId, toast, maxTerminals]);

  const addTerminal = async () => {
    if (termBusy) return;
    setTermBusy(true);
    try {
      const s = await termSession.createSession(projectId, { maxTerminals });
      setSessions(termSession.getSessions());
      setActiveTerminalId(s.terminalId);
      onTabChange('terminal');
    } catch (err) {
      toast.error(formatApiError(err, 'Could not create terminal'));
    } finally {
      setTermBusy(false);
    }
  };

  const closeTerminal = async (terminalId, e) => {
    e?.stopPropagation?.();
    if (termBusy) return;
    setTermBusy(true);
    try {
      await termSession.closeSession(terminalId);
      setSessions(termSession.getSessions());
      setActiveTerminalId(termSession.getActiveSession()?.terminalId || null);
      if (termSession.getSessions().length === 0) {
        await termSession.ensureSession(projectId, { maxTerminals });
        setSessions(termSession.getSessions());
        setActiveTerminalId(termSession.getActiveSession()?.terminalId || null);
      }
    } catch (err) {
      toast.error(formatApiError(err, 'Could not close terminal'));
    } finally {
      setTermBusy(false);
    }
  };

  return (
    <div className={`dock ${open ? '' : 'dock-hidden'}`} aria-hidden={!open}>
      <div className="dock-tabs">
        <button
          type="button"
          className={`dock-tab ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => onTabChange('terminal')}
        >
          <TerminalSquare size={12} />
          Terminal
        </button>
        <button
          type="button"
          className={`dock-tab ${activeTab === 'output' ? 'active' : ''}`}
          onClick={() => onTabChange('output')}
        >
          <ListTree size={12} />
          Output
          {running && <span className="dock-badge">run</span>}
        </button>
        <button
          type="button"
          className={`dock-tab ${activeTab === 'problems' ? 'active' : ''}`}
          onClick={() => onTabChange('problems')}
        >
          <AlertCircle size={12} />
          Problems
          {(problemSummary.errors > 0 || problemSummary.warnings > 0) && (
            <span className="dock-badge-group">
              {problemSummary.errors > 0 && (
                <span className="dock-badge err">{problemSummary.errors}</span>
              )}
              {problemSummary.warnings > 0 && (
                <span className="dock-badge warn">{problemSummary.warnings}</span>
              )}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`dock-tab ${activeTab === 'debug' ? 'active' : ''}`}
          onClick={() => onTabChange('debug')}
        >
          <Bug size={12} />
          Debug
        </button>
        <button
          type="button"
          className={`dock-tab ${activeTab === 'ports' ? 'active' : ''}`}
          onClick={() => onTabChange('ports')}
        >
          <Radio size={12} />
          Ports
        </button>
        <button
          type="button"
          className={`dock-tab ${activeTab === 'tests' ? 'active' : ''}`}
          onClick={() => onTabChange('tests')}
        >
          <FlaskConical size={12} />
          Tests
        </button>
        <button
          type="button"
          className={`dock-tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => onTabChange('tasks')}
        >
          <ListTodo size={12} />
          Tasks
        </button>
        <span className="dock-spacer" />
        {activeTab === 'output' && (
          <>
            {running && (
              <IconButton title="Stop" onClick={onStop}><Square size={11} /></IconButton>
            )}
            <IconButton title="Clear" onClick={onClear}><Eraser size={11} /></IconButton>
          </>
        )}
        <IconButton
          title="Pull Drive files into the sandbox workspace (needed after Drive edits)"
          onClick={handleSync}
          disabled={syncing}
          className={syncing ? 'active' : ''}
        >
          {syncing ? <Spinner size={12} /> : <CloudUpload size={14} />}
        </IconButton>
        <span className="dock-sync-label muted" title="Sync Drive → workspace disk">
          {syncing ? 'Syncing Drive…' : 'Drive sync'}
        </span>
      </div>

      {activeTab === 'terminal' && (
        <div className="term-hint" role="note">
          <span>
            Powerful sandbox shell — Python, Node, C++, git, pip/npm, and any project you scaffold.
            Sync after Drive edits. Single-file DSA → ▶ Run. Web apps → Ports.
          </span>
          <div className="term-hint-groups">
            {TERM_CHIP_GROUPS.map((group) => (
              <span key={group.id} className="term-hint-cmds" title={group.label}>
                <span className="term-chip-group-label muted">{group.label}</span>
                {group.chips.map((item) => (
                  <button
                    key={`${group.id}-${item.label}`}
                    type="button"
                    className="term-chip"
                    title={`Send: ${item.cmd.trim()}`}
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('orion-term-input', {
                        detail: { text: item.cmd },
                      }));
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'terminal' && (
        <div className="term-tabs" role="tablist">
          {sessions.map((s, i) => (
            <div
              key={s.terminalId}
              role="tab"
              tabIndex={0}
              aria-selected={s.terminalId === activeTerminalId}
              className={`term-tab ${s.terminalId === activeTerminalId ? 'active' : ''}`}
              onClick={() => {
                termSession.setActiveSession(s.terminalId);
                setActiveTerminalId(s.terminalId);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  termSession.setActiveSession(s.terminalId);
                  setActiveTerminalId(s.terminalId);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenamingId(s.terminalId);
                setRenameValue(s.title || `Terminal ${i + 1}`);
              }}
            >
              {renamingId === s.terminalId ? (
                <input
                  className="term-rename-input"
                  value={renameValue}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      termSession.renameSession(s.terminalId, renameValue);
                      setRenamingId(null);
                    }
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={() => {
                    termSession.renameSession(s.terminalId, renameValue);
                    setRenamingId(null);
                  }}
                />
              ) : (
                <span className="term-tab-label">
                  <span
                    className={`term-conn-dot term-conn-${termStatus[s.terminalId] || 'idle'}`}
                    title={termStatus[s.terminalId] || 'idle'}
                    aria-hidden="true"
                  />
                  {s.title || `Terminal ${i + 1}`}
                </span>
              )}
              {sessions.length > 1 ? (
                <button
                  type="button"
                  className="term-tab-close"
                  title="Close terminal"
                  onClick={(e) => closeTerminal(s.terminalId, e)}
                >
                  <X size={10} />
                </button>
              ) : (
                <button
                  type="button"
                  className="term-tab-close"
                  title="Reset terminal"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await closeTerminal(s.terminalId, e);
                  }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
          <IconButton
            title={`New Terminal (${sessions.length}/${maxTerminals})`}
            onClick={addTerminal}
            disabled={termBusy || sessions.length >= maxTerminals}
          >
            {termBusy ? <Spinner size={11} /> : <Plus size={12} />}
          </IconButton>
        </div>
      )}

      <div className="dock-body">
        <div className={`dock-pane ${activeTab === 'terminal' ? 'active' : ''}`}>
          {sessions.length === 0 ? (
            <div className="editor-empty compact">
              <span className="muted">{termBusy ? 'Starting terminal…' : 'No terminal — click + to start'}</span>
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.terminalId}
                className={`term-session ${s.terminalId === activeTerminalId ? 'active' : ''}`}
                hidden={activeTab !== 'terminal'}
                aria-hidden={activeTab !== 'terminal'}
              >
                <TerminalView
                  session={s}
                  active={s.terminalId === activeTerminalId}
                  visible={open && activeTab === 'terminal'}
                  onStatusChange={onTermStatus}
                />
              </div>
            ))
          )}
        </div>
        <div className={`dock-pane ${activeTab === 'output' ? 'active' : ''}`}>
          <div className="output-pane">
            <div className="output-lines">
              {outputLines.length === 0
                ? (
                  <div className="output-empty">
                    <span className="muted">No output yet</span>
                    <span className="muted">Open a file and press ▶ or Ctrl+Enter to run</span>
                  </div>
                )
                : outputLines.map((l, i) => (
                  <div key={`${l.at}-${i}`} className={l.kind}>{l.text}</div>
                ))}
            </div>
            <div className="stdin-box">
              <label htmlFor="orion-stdin">Program input (stdin)</label>
              <textarea
                id="orion-stdin"
                rows={2}
                value={stdin || ''}
                disabled={running}
                onChange={(e) => onStdinChange?.(e.target.value)}
                placeholder="Optional input sent to the next run"
              />
            </div>
          </div>
        </div>
        <div className={`dock-pane ${activeTab === 'problems' ? 'active' : ''}`}>
          <ProblemsPanel projectId={projectId} active={activeTab === 'problems'} />
        </div>
        <div className={`dock-pane ${activeTab === 'debug' ? 'active' : ''}`}>
          <DebugPanel projectId={projectId} active={activeTab === 'debug'} />
        </div>
        <div className={`dock-pane ${activeTab === 'ports' ? 'active' : ''}`}>
          <PortsPanel projectId={projectId} active={activeTab === 'ports'} />
        </div>
        <div className={`dock-pane ${activeTab === 'tests' ? 'active' : ''}`}>
          <TestPanel
            projectId={projectId}
            active={activeTab === 'tests'}
            onOpenTerminal={() => onTabChange('terminal')}
          />
        </div>
        <div className={`dock-pane ${activeTab === 'tasks' ? 'active' : ''}`}>
          <TasksPanel
            projectId={projectId}
            active={activeTab === 'tasks'}
            onOpenTerminal={() => onTabChange('terminal')}
          />
        </div>
      </div>
    </div>
  );
}
