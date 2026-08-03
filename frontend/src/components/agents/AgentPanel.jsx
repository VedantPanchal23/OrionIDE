/**
 * Orion IDE — Agent pipeline panel
 *
 * Drives the planner → designer → implementer → run-agent → execute
 * pipeline over SSE, surfacing each step as a timeline and pausing for
 * human approval where the backend requests it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot, Check, X, Loader2, AlertTriangle, Sparkles,
} from 'lucide-react';
import * as agentService from '../../services/agentService';
import { useToast } from '../../context/ToastContext';
import {
  PanelHeader, Button, Textarea, EmptyState,
} from '../ui/primitives';

const STEP_NAMES = {
  1: 'Planner', 2: 'Designer', 3: 'Implementer', 4: 'Run agent', 5: 'Execute',
};

function summarize(evt) {
  switch (evt.type) {
    case 'PIPELINE_STARTED': return 'Pipeline kicked off';
    case 'AGENT_THINKING': return evt.file ? `Working on ${evt.file}…` : 'Thinking…';
    case 'AGENT_COMPLETE':
      if (evt.output?.projectName) return `Project: ${evt.output.projectName}`;
      if (evt.output?.filePath) return evt.output.filePath;
      if (evt.output?.files) return `${evt.output.files.length} files planned`;
      return 'Step complete';
    case 'WAITING_APPROVAL': return 'Waiting for your approval to continue';
    case 'STEP_APPROVED': return 'Approved — continuing';
    case 'STEP_REJECTED': return `Sent back for revision (attempt ${evt.attempt})`;
    case 'MAX_REJECTIONS': return evt.message;
    case 'IMPLEMENTATION_STARTED': return `Implementing ${evt.totalFiles} file(s)`;
    case 'FILE_PROGRESS': return `File ${evt.currentFile}/${evt.totalFiles}: ${evt.filePath}`;
    case 'REVIEW_COMPLETE': return `Review ${evt.approved ? 'passed' : 'flagged'} (score ${evt.score ?? '—'})`;
    case 'REVIEW_RETRY': return `Revising ${evt.file} (attempt ${evt.attempt})`;
    case 'FILE_WRITTEN': return `Wrote ${evt.file} to Drive`;
    case 'ALL_FILES_COMPLETE': return `All ${evt.filesCompleted} files written`;
    case 'PIPELINE_COMPLETE': return evt.error ? `Finished with issues: ${evt.error}` : `Done — ${evt.projectName || 'project'} is ready`;
    case 'PIPELINE_FAILED': return `Pipeline failed: ${evt.error}`;
    case 'AGENT_ERROR': return evt.error;
    case 'PROJECT_FOLDER_READY': return 'Project folder ready in Drive';
    default: return evt.type;
  }
}

function stepIcon(evt) {
  if (evt.type === 'AGENT_ERROR' || evt.type === 'PIPELINE_FAILED') return <AlertTriangle size={12} />;
  if (evt.type === 'AGENT_THINKING') return <Loader2 size={12} className="spin" />;
  if (evt.type === 'PIPELINE_COMPLETE') return <Sparkles size={12} />;
  return <Check size={12} />;
}

export default function AgentPanel({ onFilesWritten }) {
  const toast = useToast();
  const [goal, setGoal] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [events, setEvents] = useState([]);
  const [waitingStep, setWaitingStep] = useState(null);
  const [running, setRunning] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const streamRef = useRef(null);

  useEffect(() => () => streamRef.current?.close(), []);

  const handleEvent = useCallback((type, data) => {
    setEvents((prev) => [...prev, { ...data, type }]);
    if (type === 'WAITING_APPROVAL') setWaitingStep(data.step);
    if (type === 'STEP_APPROVED' || type === 'STEP_REJECTED') setWaitingStep(null);
    if (type === 'FILE_WRITTEN') onFilesWritten?.();
    if (type === 'PIPELINE_COMPLETE' || type === 'PIPELINE_FAILED' || type === 'MAX_REJECTIONS') {
      setRunning(false);
      setWaitingStep(null);
    }
  }, [onFilesWritten]);

  const start = async () => {
    if (!goal.trim() || running) return;
    setEvents([]);
    setWaitingStep(null);
    setRunning(true);
    try {
      const { sessionId: id } = await agentService.startPipeline(goal.trim());
      setSessionId(id);
      streamRef.current?.close();
      streamRef.current = agentService.streamPipeline(id, {
        onEvent: handleEvent,
        onError: () => toast.error('Lost connection to the pipeline stream'),
      });
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to start pipeline');
      setRunning(false);
    }
  };

  const approve = async () => {
    if (!sessionId || waitingStep == null) return;
    try {
      await agentService.approveStep(sessionId, waitingStep);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Approve failed');
    }
  };

  const reject = async () => {
    if (!sessionId || waitingStep == null) return;
    try {
      await agentService.rejectStep(sessionId, waitingStep, reason.trim() || 'Please revise');
      setReason('');
      setRejecting(false);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Reject failed');
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelHeader title="Agent Pipeline" />
      <div className="agent-goal-box">
        <Textarea
          placeholder="Describe what to build — e.g. “A CLI todo app in Python with JSON persistence”"
          rows={3}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          disabled={running}
        />
        <Button variant="primary" block onClick={start} disabled={running || !goal.trim()}>
          <Bot size={14} /> {running ? 'Pipeline running…' : 'Start pipeline'}
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {events.length === 0 ? (
          <EmptyState
            icon={<Bot size={28} color="var(--text-muted)" />}
            title="No pipeline yet"
            hint="Describe a goal above — Orion will plan, design, implement, review and run it."
          />
        ) : (
          <div className="agent-step-list">
            {events.map((evt, i) => (
              <div
                key={i}
                className={`agent-step ${evt.type === 'AGENT_THINKING' ? 'active' : ''} ${evt.type === 'AGENT_COMPLETE' || evt.type === 'FILE_WRITTEN' ? 'done' : ''}`}
              >
                <span className="agent-step-icon">{stepIcon(evt)}</span>
                <div className="agent-step-body">
                  <div className="agent-step-title">
                    {evt.step ? `${STEP_NAMES[evt.step] || `Step ${evt.step}`} · ` : ''}{evt.agent || evt.type}
                  </div>
                  <div className="agent-step-detail">{summarize(evt)}</div>
                </div>
              </div>
            ))}

            {waitingStep != null && (
              <div className="agent-step active">
                <span className="agent-step-icon"><Check size={12} /></span>
                <div className="agent-step-body">
                  <div className="agent-step-title">Approval needed — {STEP_NAMES[waitingStep] || `step ${waitingStep}`}</div>
                  {rejecting ? (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <Textarea
                        rows={2}
                        placeholder="What should change?"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <div className="agent-approve-row">
                        <Button variant="danger" size="sm" onClick={reject}>Send feedback</Button>
                        <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="agent-approve-row">
                      <Button variant="primary" size="sm" onClick={approve}><Check size={12} /> Approve</Button>
                      <Button variant="ghost" size="sm" onClick={() => setRejecting(true)}><X size={12} /> Reject</Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
