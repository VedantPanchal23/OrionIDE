import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Play, Square, X } from 'lucide-react';
import * as agentService from '../../services/agentService';
import { useModelSettings } from '../../context/ModelSettingsContext';
import { useFileTreeContext } from '../../context/FileTreeContext';
import { useEditor } from '../../context/EditorContext';
import { useToast } from '../../context/ToastContext';
import { IconButton, Spinner } from '../ui/primitives';
import { formatApiError } from '../../utils/apiError';
import PromptModal from '../ui/PromptModal';
import { buildProjectIndex, indexToAgentContext } from '../../lib/projectIndex';
import { collectIndexFiles } from '../../lib/projectIndexCache';

const STEP_LABELS = {
  1: 'Planner',
  2: 'Designer',
  3: 'Implement · Review · Write',
  4: 'Run config',
  5: 'Execute',
  6: 'Complete',
};

function formatRunResult(result) {
  if (!result) return null;
  if (result.error) return `Error: ${result.error}`;
  const parts = [
    result.status != null && `Status: ${result.status}`,
    result.exitCode != null && `Exit: ${result.exitCode}`,
    result.language && `Lang: ${result.language}`,
  ].filter(Boolean);
  const out = String(result.stdout || result.output || '').trim();
  const err = String(result.stderr || '').trim();
  return [
    parts.join(' · '),
    out && `── stdout ──\n${out.slice(0, 4000)}${out.length > 4000 ? '\n…' : ''}`,
    err && `── stderr ──\n${err.slice(0, 2000)}${err.length > 2000 ? '\n…' : ''}`,
  ].filter(Boolean).join('\n\n');
}

function PreviewBlock({ title, children }) {
  if (!children) return null;
  return (
    <div className="agent-preview">
      <div className="search-section-label">{title}</div>
      <pre className="agent-preview-body">{children}</pre>
    </div>
  );
}

function approvalPreview(session, step) {
  if (!session || step == null) return null;
  if (step === 1 && session.planner?.output) {
    const o = session.planner.output;
    return [
      o.projectName && `Project: ${o.projectName}`,
      o.description,
      o.techStack?.length && `Stack: ${o.techStack.join(', ')}`,
      o.buildOrder?.length && `Build order:\n${o.buildOrder.map((f) => `  - ${f}`).join('\n')}`,
      o.estimatedFiles != null && `Files: ${o.estimatedFiles}`,
    ].filter(Boolean).join('\n');
  }
  if (step === 2 && session.designer?.output) {
    const o = session.designer.output;
    const files = (o.files || []).map((f) => `  - ${f.path} (${f.language || '?'})`).join('\n');
    const folders = (o.folders || []).map((f) => `  - ${f.path}`).join('\n');
    return [
      folders && `Folders:\n${folders}`,
      files && `Files:\n${files}`,
      o.implementationOrder?.length && `Order:\n${o.implementationOrder.map((f) => `  - ${f}`).join('\n')}`,
    ].filter(Boolean).join('\n');
  }
  if (step === 4 && session.runAgent?.command) {
    const c = session.runAgent.command;
    return [
      c.mainFile && `Main: ${c.mainFile}`,
      c.pistonLanguage && `Language: ${c.pistonLanguage}`,
      c.runCommand && `Command: ${c.runCommand}`,
      c.explanation,
    ].filter(Boolean).join('\n');
  }
  if (session.implementer?.files?.length) {
    const reviews = session.reviewer?.reviews || [];
    const fileBlock = session.implementer.files
      .map((f) => {
        const rev = reviews.find((r) => r.filePath === f.path);
        const head = rev
          ? `${f.path}  [review ${rev.approved ? 'ok' : 'reject'} score=${rev.score}]`
          : f.path;
        return `${head}\n${String(f.code || '').slice(0, 400)}${(f.code || '').length > 400 ? '\n…' : ''}`;
      })
      .join('\n\n');
    return fileBlock;
  }
  return null;
}

function eventLabel(type) {
  const map = {
    PIPELINE_COMPLETE: 'Pipeline finished',
    PIPELINE_FAILED: 'Pipeline failed',
    PIPELINE_CANCELLED: 'Pipeline cancelled',
    WAITING_APPROVAL: 'Waiting for approval',
    AGENT_COMPLETE: 'Agent step complete',
    AGENT_ERROR: 'Agent error',
    FILE_PROGRESS: 'Writing files',
    FILE_WRITTEN: 'File written',
    ALL_FILES_COMPLETE: 'All files written',
    REVIEW_RETRY: 'Review retry',
    REVIEW_COMPLETE: 'Review complete',
    STEP_APPROVED: 'Step approved',
    PROJECT_FOLDER_READY: 'Project folder ready',
  };
  return map[type] || String(type || 'Event').replace(/_/g, ' ').toLowerCase();
}

function eventDetail(ev) {
  if (ev.type === 'FILE_PROGRESS') {
    return `${ev.currentFile || '?'}/${ev.totalFiles || '?'} ${ev.filePath || ev.file || ''}`;
  }
  if (ev.type === 'REVIEW_RETRY') {
    return `${ev.file || ''} attempt ${ev.attempt} score=${ev.score ?? '?'}${ev.issues != null ? ` issues=${ev.issues}` : ''}`;
  }
  if (ev.type === 'REVIEW_COMPLETE') {
    return `${ev.file || ev.filePath || ''} ${ev.approved ? 'approved' : 'rejected'} score=${ev.score ?? '?'}`;
  }
  if (ev.type === 'PIPELINE_COMPLETE') {
    const r = ev.executionResult;
    if (!r) return ev.projectName || 'done';
    if (r.error) return r.error;
    return `exit ${r.exitCode ?? '?'} ${r.status || ''}`.trim();
  }
  if (ev.error) return ev.error;
  if (ev.file) return ev.file;
  if (ev.filePath) return ev.filePath;
  if (ev.message) return ev.message;
  return null;
}

/** Extract bash/sh/shell fenced blocks for optional Terminal send. */
function extractShellBlocks(text) {
  const blocks = [];
  const re = /```(?:bash|sh|shell|zsh)\s*\n([\s\S]*?)```/gi;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const cmd = m[1].trim();
    if (cmd) blocks.push(cmd);
  }
  return blocks;
}

function sendShellToTerminal(cmd) {
  const text = cmd.endsWith('\n') ? cmd : `${cmd}\n`;
  window.dispatchEvent(new CustomEvent('orion-term-input', { detail: { text } }));
}

export default function AgentPanel({ projectId, projectName }) {
  const models = useModelSettings();
  const tree = useFileTreeContext();
  const { openFile, openFiles, getLiveContent } = useEditor();
  const toast = useToast();
  const [mode, setMode] = useState('chat'); // chat | pipeline
  const [goal, setGoal] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [waitingStep, setWaitingStep] = useState(null);
  const [fileProgress, setFileProgress] = useState(null);
  const [lastRunResult, setLastRunResult] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const stopStream = useRef(null);
  const refreshTimer = useRef(null);
  const sessionIdRef = useRef(null);
  const chatHistoryRef = useRef([]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => () => {
    stopStream.current?.();
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const scheduleTreeRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      tree.refreshFolder(projectId);
    }, 350);
  }, [tree, projectId]);

  const refreshSession = useCallback(async (id) => {
    if (!id) return;
    try {
      const next = await agentService.getPipeline(id);
      setSession(next);
      if (next?.status === 'waiting_approval' || next?.status === 'awaiting_approval') {
        setWaitingStep(next.currentStep);
      }
      if (next?.runAgent?.result) {
        setLastRunResult(next.runAgent.result);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const pushEvent = useCallback((ev) => {
    setEvents((prev) => [...prev.slice(-80), { ...ev, at: Date.now() }]);
    const sid = sessionIdRef.current;

    if (ev.type === 'FILE_PROGRESS') {
      setFileProgress({
        current: ev.currentFile,
        total: ev.totalFiles,
        path: ev.filePath || ev.file || '',
      });
    }
    if (ev.type === 'ALL_FILES_COMPLETE') {
      setFileProgress((fp) => (fp ? { ...fp, current: fp.total, path: 'All files done' } : {
        current: ev.filesCompleted,
        total: ev.filesCompleted,
        path: 'All files done',
      }));
    }
    if (ev.type === 'WAITING_APPROVAL') {
      setWaitingStep(ev.step);
      refreshSession(sid);
    }
    if (ev.type === 'AGENT_COMPLETE' && ev.output) {
      refreshSession(sid);
    }
    if (ev.type === 'STEP_APPROVED') setWaitingStep(null);
    if (ev.type === 'PIPELINE_COMPLETE') {
      setWaitingStep(null);
      if (ev.executionResult) setLastRunResult(ev.executionResult);
      refreshSession(sid);
      toast.success(ev.error ? 'Pipeline finished with errors' : 'Pipeline complete');
    }
    if (ev.type === 'PIPELINE_FAILED') {
      setWaitingStep(null);
      if (ev.error) setLastRunResult({ error: ev.error });
      refreshSession(sid);
    }
    if (ev.type === 'PIPELINE_CANCELLED') {
      setWaitingStep(null);
      toast.info('Pipeline cancelled');
      refreshSession(sid);
    }
    if (ev.type === 'AGENT_ERROR') toast.error(ev.error || 'Agent error');
    if (ev.session) setSession(ev.session);
    if (
      ev.type === 'FILE_WRITTEN'
      || ev.type === 'ALL_FILES_COMPLETE'
      || ev.type === 'PROJECT_FOLDER_READY'
      || ev.type === 'PIPELINE_COMPLETE'
    ) {
      scheduleTreeRefresh();
    }
  }, [toast, scheduleTreeRefresh, refreshSession]);

  const connectStream = useCallback((id) => {
    stopStream.current?.();
    stopStream.current = agentService.streamPipeline(id, {
      onEvent: pushEvent,
      onError: () => {
        toast.error('Agent stream disconnected');
      },
    });
  }, [pushEvent, toast]);

  const llmConfig = useCallback(() => (
    models.configured
      ? {
        provider: models.provider,
        model: models.model,
        apiKey: models.apiKey,
        baseUrl: models.baseUrl,
      }
      : null
  ), [models]);

  const sendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setChatInput('');
    const userMsg = { role: 'user', content: trimmed };
    setChatMessages((prev) => [...prev, userMsg]);
    chatHistoryRef.current = [...chatHistoryRef.current, userMsg].slice(-12);

    try {
      const llm = llmConfig();
      if (!llm) {
        toast.info('Using server LLM keys — set BYOK in Settings for your own model');
      }
      const index = buildProjectIndex(collectIndexFiles(openFiles || [], getLiveContent));
      const codeContext = indexToAgentContext(index) || undefined;
      const data = await agentService.startChat(trimmed, llm, {
        projectFolderId: projectId || undefined,
        projectName: projectName || undefined,
        history: chatHistoryRef.current.slice(0, -1),
        applyFiles: true,
        codeContext,
      });
      stopStream.current?.();
      stopStream.current = agentService.streamChat(data.sessionId, {
        onEvent: (ev) => {
          if (ev.type === 'CHAT_THINKING') {
            setChatMessages((prev) => {
              if (prev.some((m) => m.role === 'assistant' && m.pending)) return prev;
              return [...prev, { role: 'assistant', content: 'Thinking…', pending: true }];
            });
          }
          if (ev.type === 'CHAT_COMPLETE') {
            const content = ev.content || '';
            setChatMessages((prev) => {
              const next = prev.filter((m) => !m.pending);
              return [...next, { role: 'assistant', content, files: ev.files || [] }];
            });
            chatHistoryRef.current = [
              ...chatHistoryRef.current,
              { role: 'assistant', content },
            ].slice(-12);
          }
          if (ev.type === 'FILE_WRITTEN' && ev.success) {
            scheduleTreeRefresh();
            toast.success(`Wrote ${ev.filePath}`);
          }
          if (ev.type === 'CHAT_ERROR') {
            setChatMessages((prev) => prev.filter((m) => !m.pending).concat({
              role: 'assistant',
              content: `Error: ${ev.error || 'chat failed'}`,
            }));
            toast.error(ev.error || 'Chat failed');
          }
          if (ev.type === 'CHAT_DONE') setBusy(false);
          if (ev.type === 'CHAT_INFO') toast.info(ev.message || 'Info');
        },
        onError: () => {
          setBusy(false);
        },
      });
    } catch (err) {
      toast.error(formatApiError(err));
      setBusy(false);
    }
  };

  const start = async () => {
    const trimmed = goal.trim();
    if (!trimmed) return;
    setBusy(true);
    setEvents([]);
    setWaitingStep(null);
    setFileProgress(null);
    setLastRunResult(null);
    try {
      const llm = llmConfig();
      if (!llm) {
        toast.info('Using server LLM keys - set BYOK in Settings for your own model');
      }
      const data = await agentService.startPipeline(trimmed, llm, {
        projectFolderId: projectId || undefined,
        projectName: projectName || undefined,
      });
      setSessionId(data.sessionId);
      setSession(data.session);
      connectStream(data.sessionId);
      toast.success('Pipeline started');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!sessionId || !waitingStep) return;
    setBusy(true);
    try {
      const next = await agentService.approveStep(sessionId, waitingStep);
      setSession(next);
      setWaitingStep(null);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!sessionId || !waitingStep) return;
    setRejectOpen(true);
  };

  const submitReject = async (reason) => {
    setRejectOpen(false);
    const trimmed = String(reason || '').trim() || 'Please revise';
    if (!sessionId || !waitingStep) return;
    setBusy(true);
    try {
      const next = await agentService.rejectStep(sessionId, waitingStep, trimmed);
      setSession(next);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    stopStream.current?.();
    stopStream.current = null;
    if (!sessionId) {
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const next = await agentService.cancelPipeline(sessionId);
      setSession(next);
      setWaitingStep(null);
      toast.info('Pipeline cancelled');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const preview = approvalPreview(session, waitingStep);
  const written = session?.fileAgent?.written || [];
  const runResultText = formatRunResult(lastRunResult || session?.runAgent?.result);

  const openWrittenPath = useCallback(async (filePath) => {
    const norm = String(filePath || '').replace(/\\/g, '/');
    const base = norm.split('/').pop();
    const files = tree.listFilesFlat();
    const match = files.find((f) => {
      const parts = (tree.getPath(f.id) || []).map((n) => n.name);
      const rel = parts.slice(1).join('/');
      return rel === norm || parts.join('/') === norm || f.name === norm || f.name === base;
    });
    if (!match) {
      toast.info('File not in Explorer yet — refresh the tree after write completes');
      tree.refreshFolder(projectId);
      return;
    }
    try {
      await openFile(match);
    } catch (err) {
      toast.error(formatApiError(err, 'Could not open file'));
    }
  }, [tree, openFile, toast, projectId]);

  return (
    <div className="side-panel">
      <div className="ide-sidebar-title">
        <span>Agents</span>
        <span className="title-actions">
          {sessionId && !['completed', 'complete', 'cancelled', 'failed'].includes(session?.status) && (
            <IconButton title="Cancel pipeline" onClick={stop}><Square size={13} /></IconButton>
          )}
        </span>
      </div>
      <div className="side-panel-body">
        <p className="side-empty" style={{ paddingTop: 0 }}>
          Uses your Settings API key
          {models.configured ? (
            <>
              {' '}
              (
              <strong className="accent-text">{models.label}</strong>
              )
            </>
          ) : ' - configure BYOK first'}
          .
          {' '}
          Put
          {' '}
          <code className="term-inline-code">AGENTS.md</code>
          {' '}
          in the project root for custom rules.
        </p>

        <div className="agent-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`agent-mode-tab ${mode === 'chat' ? 'active' : ''}`}
            aria-selected={mode === 'chat'}
            onClick={() => setMode('chat')}
          >
            Chat
          </button>
          <button
            type="button"
            role="tab"
            className={`agent-mode-tab ${mode === 'pipeline' ? 'active' : ''}`}
            aria-selected={mode === 'pipeline'}
            onClick={() => setMode('pipeline')}
          >
            Pipeline
          </button>
        </div>

        {mode === 'chat' ? (
          <>
            <div className="agent-chat-log" aria-live="polite">
              {chatMessages.length === 0 && (
                <p className="muted" style={{ margin: 0 }}>
                  Ask to explain code, fix bugs, or create files. File writes apply to this Drive project.
                </p>
              )}
              {chatMessages.map((m, i) => {
                const shells = m.role === 'assistant' && !m.pending ? extractShellBlocks(m.content) : [];
                return (
                <div key={`${m.role}-${i}`} className={`agent-chat-bubble ${m.role}`}>
                  <div className="agent-chat-role">{m.role === 'user' ? 'You' : 'Orion'}</div>
                  <pre className="agent-chat-text">{m.content}</pre>
                  {!!m.files?.length && (
                    <ul className="agent-written-list">
                      {m.files.map((f) => (
                        <li key={f.path}>
                          <button type="button" className="agent-written-link" onClick={() => openWrittenPath(f.path)}>
                            {f.path}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {shells.length > 0 && (
                    <div className="agent-shell-actions">
                      {shells.map((cmd, j) => (
                        <button
                          key={`sh-${j}`}
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title={cmd.slice(0, 200)}
                          onClick={() => {
                            sendShellToTerminal(cmd);
                            toast.info('Sent shell block to Terminal');
                          }}
                        >
                          <Play size={12} />
                          Run in Terminal
                          {shells.length > 1 ? ` (${j + 1})` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
            <label className="field">
              Message
              <textarea
                rows={3}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="e.g. Add a Flask /health route in app.py"
                maxLength={8000}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || !chatInput.trim()}
              onClick={sendChat}
            >
              {busy ? <Spinner size={12} /> : <Play size={13} />}
              Send
            </button>
          </>
        ) : (
          <>
        <label className="field">
          Goal
          <textarea
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Build a Python CLI that greets the user"
            maxLength={500}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || !goal.trim()}
          onClick={start}
        >
          {busy && !sessionId ? <Spinner size={12} /> : <Play size={13} />}
          Start pipeline
        </button>

        {session && (
          <div className="agent-meta">
            <span>
              Status:
              {' '}
              {session.status}
            </span>
            <span>
              Step:
              {' '}
              {session.currentStep}
              {' '}
              (
              {STEP_LABELS[session.currentStep] || '-'}
              )
            </span>
            {session.projectName && (
              <span>
                Project:
                {' '}
                {session.projectName}
              </span>
            )}
          </div>
        )}

        {fileProgress && (
          <div className="agent-progress" role="status">
            <div className="agent-progress-label">
              File
              {' '}
              {fileProgress.current}
              /
              {fileProgress.total}
              {fileProgress.path ? ` — ${fileProgress.path}` : ''}
            </div>
            <div className="agent-progress-bar">
              <div
                className="agent-progress-fill"
                style={{
                  width: `${fileProgress.total
                    ? Math.min(100, Math.round((100 * (fileProgress.current || 0)) / fileProgress.total))
                    : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {waitingStep != null && (
          <div className="agent-approve">
            <span>
              Approve
              {' '}
              {STEP_LABELS[waitingStep] || `step ${waitingStep}`}
              ?
            </span>
            <PreviewBlock title="Review before approving">
              {preview || 'Loading output…'}
            </PreviewBlock>
            <div className="agent-approve-actions">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={approve}>
                <Check size={12} />
                Approve
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={reject}>
                <X size={12} />
                Reject
              </button>
            </div>
          </div>
        )}

        {!waitingStep && session?.planner?.output && (
          <PreviewBlock title="Plan">
            {approvalPreview(session, 1)}
          </PreviewBlock>
        )}
        {!waitingStep && session?.designer?.output && (
          <PreviewBlock title="Design">
            {approvalPreview(session, 2)}
          </PreviewBlock>
        )}
        {!waitingStep && session?.runAgent?.command && (
          <PreviewBlock title="Run config">
            {approvalPreview(session, 4)}
          </PreviewBlock>
        )}
        {written.length > 0 && (
          <div className="agent-preview">
            <div className="search-section-label">Written files</div>
            <ul className="agent-written-list">
              {written.map((f) => (
                <li key={f.filePath || f.path}>
                  <button
                    type="button"
                    className="agent-written-link"
                    title={`Open ${f.filePath || f.path}`}
                    onClick={() => openWrittenPath(f.filePath || f.path)}
                  >
                    {f.filePath || f.path}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {runResultText && (
          <PreviewBlock title="Run result">
            {runResultText}
          </PreviewBlock>
        )}

        <div className="search-section-label">Events</div>
        <ul className="agent-events">
          {events.length === 0 && <li className="muted">No events yet</li>}
          {events.map((ev, i) => {
            const detail = eventDetail(ev);
            return (
              <li key={`${ev.at}-${i}`} className={`agent-ev ${ev.type}`}>
                <span className="ev-type">{eventLabel(ev.type)}</span>
                {ev.agent && <span className="muted">{ev.agent}</span>}
                {detail && (
                  <span className={ev.type === 'AGENT_ERROR' || ev.type === 'PIPELINE_FAILED' ? 'stderr' : 'muted'}>
                    {detail}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
          </>
        )}
      </div>

      <PromptModal
        open={rejectOpen}
        title="Reject step"
        label="Reason"
        initialValue="Please revise"
        confirmLabel="Reject"
        onCancel={() => setRejectOpen(false)}
        onSubmit={submitReject}
      />
    </div>
  );
}
