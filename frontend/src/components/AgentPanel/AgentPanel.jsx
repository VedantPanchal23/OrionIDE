/**
 * Orion IDE — AgentPanel Component (Complete)
 *
 * Full pipeline UI: 6-step progress bar, agent output cards,
 * code preview, review reports, file status, execution results.
 */

import React, { useState, useCallback } from 'react';
import GoalInput from './GoalInput';
import CodePreview from './CodePreview';
import ReviewReport from './ReviewReport';
import FileAgentStatus from './FileAgentStatus';
import PipelineComplete from './PipelineComplete';
import useAgentPipeline from '../../hooks/useAgentPipeline';

import { Check, Loader2 } from 'lucide-react';

/* ── Steps ─────────────────────────────────────────────────────────────── */

const STEPS = [
  { num: 1, label: 'Planner', key: 'planner' },
  { num: 2, label: 'Designer', key: 'designer' },
  { num: 3, label: 'Build', key: 'implementer' },
  { num: 4, label: 'Run Config', key: 'runAgent' },
  { num: 5, label: 'Execute', key: 'execute' },
  { num: 6, label: 'Done', key: 'complete' },
];

/* ── Planner Output Card ──────────────────────────────────────────────── */

const PlannerCard = ({ output }) => (
  <div style={{ fontSize: 13 }}>
    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{output.projectName}</div>
    <p style={{ color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: '1.5' }}>{output.description}</p>

    <div style={{ marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tech Stack</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        {output.techStack?.map((tech) => (
          <span key={tech} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: 'var(--text-primary)' }}>{tech}</span>
        ))}
      </div>
    </div>

    <div style={{ marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Files ({output.estimatedFiles})</span>
      <div style={{ marginTop: 4 }}>
        {output.fileStructure?.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '3px 0', fontSize: 12 }}>
            <code style={{ color: 'var(--accent-blue-subtle)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, flexShrink: 0 }}>{f.path}</code>
            <span style={{ color: 'var(--text-muted)' }}>{f.purpose}</span>
          </div>
        ))}
      </div>
    </div>

    <div>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Build Order</span>
      <div style={{ marginTop: 4 }}>
        {output.buildOrder?.map((step, i) => (
          <div key={i} style={{ padding: '2px 0', fontSize: 12, color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--border-emphasis)', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{i + 1}.</span> {step}
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Designer Output Card ─────────────────────────────────────────────── */

const DesignerCard = ({ output }) => (
  <div style={{ fontSize: 13 }}>
    <div style={{ marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Files ({output.files?.length})</span>
      {output.files?.map((f, i) => (
        <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--bg-subtle)', fontSize: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ color: 'var(--accent-blue-subtle)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{f.path}</code>
            <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--bg-emphasis)', borderRadius: 3, color: 'var(--text-muted)' }}>{f.language}</span>
          </div>
          <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{f.purpose}</div>
        </div>
      ))}
    </div>
    <div>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Implementation Order</span>
      {output.implementationOrder?.map((path, i) => (
        <div key={i} style={{ padding: '2px 0', fontSize: 12, color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--border-emphasis)', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, minWidth: 16 }}>{i + 1}.</span>
          <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginLeft: 4 }}>{path}</code>
        </div>
      ))}
    </div>
  </div>
);

/* ── RunAgent Output Card ─────────────────────────────────────────────── */

const RunConfigCard = ({ output }) => (
  <div style={{ fontSize: 13 }}>
    <div style={{ display: 'grid', gap: 8 }}>
      {[
        ['Main File', output.mainFile],
        ['Language', output.pistonLanguage],
        ['Version', output.pistonVersion],
        ['Command', output.runCommand],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--bg-subtle)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</span>
          <code style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{value}</code>
        </div>
      ))}
    </div>
    <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
      {output.explanation}
    </p>
  </div>
);

/* ── Main AgentPanel ──────────────────────────────────────────────────── */

const AgentPanel = () => {
  const { session, isRunning, error, start, approve, reject, refresh } = useAgentPipeline();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleApprove = useCallback(() => {
    if (!session) return;
    const step = session.currentStep <= 2 ? session.currentStep : session.currentStep;
    approve(step);
    setShowRejectInput(false);
    setRejectReason('');
  }, [session, approve]);

  const handleReject = useCallback(() => {
    if (!session || !rejectReason.trim()) return;
    reject(session.currentStep, rejectReason.trim());
    setShowRejectInput(false);
    setRejectReason('');
  }, [session, reject, rejectReason]);

  const handleReset = useCallback(() => {
    window.location.reload();
  }, []);

  const getStepStatus = (stepNum) => {
    if (!session) return 'pending';
    if (session.status === 'complete' && stepNum <= 6) return 'approved';
    if (stepNum < session.currentStep) return 'approved';
    if (stepNum === session.currentStep && session.status === 'running') return 'running';
    if (stepNum === session.currentStep && session.status === 'waiting_approval') return 'waiting';
    if (stepNum === session.currentStep && session.status === 'failed') return 'failed';
    if (stepNum === session.currentStep && session.status === 'manual_override') return 'override';
    return 'pending';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'var(--accent-blue-subtle)';
      case 'waiting': return 'var(--accent-yellow)';
      case 'approved': return 'var(--success)';
      case 'failed': return 'var(--accent-red-emphasis)';
      case 'override': return 'var(--warning)';
      default: return 'var(--border-emphasis)';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'running': return 'Thinking...';
      case 'waiting': return 'Waiting for your approval';
      case 'approved': return 'Approved';
      case 'failed': return 'Failed';
      case 'override': return 'Manual override available';
      default: return 'Pending';
    }
  };

  const currentStep = session ? STEPS.find((s) => s.num === session.currentStep) : null;
  const isWaiting = session?.status === 'waiting_approval' || session?.status === 'manual_override';
  const currentRejections = currentStep && session[currentStep.key]?.rejections?.length || 0;

  // Pipeline complete
  if (session?.status === 'complete') {
    return (
      <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg-canvas)' }}>
        <PipelineComplete session={session} onReset={handleReset} />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-canvas)' }}>
      {/* Goal input */}
      {!session && <GoalInput onStart={start} isRunning={isRunning} />}

      {/* Error */}
      {error && (
        <div style={{ margin: '0 16px 8px', padding: '8px 12px', background: 'rgba(218, 54, 51, 0.1)', border: '1px solid var(--accent-red-emphasis)33', borderRadius: 6, color: 'var(--accent-red-emphasis)', fontSize: 12 }}>
          {error}
        </div>
      )}

      {session && (
        <>
          {/* Step progress bar */}
          <div style={{ padding: '12px 12px', borderBottom: '1px solid var(--bg-emphasis)', display: 'flex', gap: 2, alignItems: 'center' }}>
            {STEPS.map((step, i) => {
              const status = getStepStatus(step.num);
              const bgColor = status === 'approved' ? 'var(--accent-green)' : status === 'running' ? 'var(--accent-blue)' : status === 'waiting' || status === 'override' ? '#9e6a03' : status === 'failed' ? 'var(--accent-red)' : 'var(--bg-emphasis)';
              return (
                <React.Fragment key={step.num}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, opacity: status === 'pending' ? 0.4 : 1 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bgColor, fontSize: 9, fontWeight: 700, color: '#fff' }}>
                      {status === 'approved' ? <Check size={12} /> : status === 'running' ? <Loader2 size={12} className="spin" /> : step.num}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 500, color: getStatusColor(status), whiteSpace: 'nowrap' }}>{step.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, minWidth: 4, background: status === 'approved' ? 'var(--accent-green)' : 'var(--bg-emphasis)' }} />}
                </React.Fragment>
              );
            })}
          </div>

          {/* Step header + file progress */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--bg-emphasis)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Step {session.currentStep}: {currentStep?.label || 'Complete'}
              </span>
              <div style={{ fontSize: 11, color: getStatusColor(getStepStatus(session.currentStep)), display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                {getStepStatus(session.currentStep) === 'running' && <Loader2 size={12} className="spin" />}
                {getStatusLabel(getStepStatus(session.currentStep))}
              </div>
              {session.currentStep === 3 && session.implementer?.totalFiles > 0 && (
                <div style={{ fontSize: 10, color: 'var(--accent-blue-subtle)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                  File {Math.min((session.implementer.currentIndex || 0) + 1, session.implementer.totalFiles)} of {session.implementer.totalFiles}
                </div>
              )}
            </div>
            {currentRejections > 0 && (
              <span style={{ fontSize: 11, color: '#d29922', fontFamily: "'JetBrains Mono', monospace" }}>
                Attempt {currentRejections + 1} of {3}
              </span>
            )}
          </div>

          {/* Output area */}
          <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
            {/* Planner output */}
            {session.currentStep >= 1 && session.planner?.output && session.currentStep <= 1 && (
              <PlannerCard output={session.planner.output} />
            )}

            {/* Designer output */}
            {session.currentStep >= 2 && session.designer?.output && session.currentStep <= 2 && (
              <DesignerCard output={session.designer.output} />
            )}

            {/* Implementer: show code + review + file status */}
            {session.currentStep === 3 && (
              <>
                {/* Current file code */}
                {session.implementer?.files?.map((file, i) => (
                  <React.Fragment key={i}>
                    <CodePreview filePath={file.path} code={file.code} language={file.language} />
                    {session.reviewer?.reviews?.[i] && (
                      <ReviewReport review={session.reviewer.reviews[i]} filePath={file.path} />
                    )}
                  </React.Fragment>
                ))}

                {/* File write progress */}
                {session.fileAgent?.written?.length > 0 && (
                  <FileAgentStatus
                    written={session.fileAgent.written}
                    totalFiles={session.implementer.totalFiles}
                    currentFile={session.implementer.files?.[session.implementer.currentIndex]?.path}
                  />
                )}
              </>
            )}

            {/* RunAgent config */}
            {session.currentStep === 4 && session.runAgent?.command && (
              <RunConfigCard output={session.runAgent.command} />
            )}

            {/* Thinking / Empty state */}
            {getStepStatus(session.currentStep) === 'running' && !session[currentStep?.key]?.output && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                <Loader2 size={24} color="var(--accent-blue-subtle)" className="spin" />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{currentStep?.label} is thinking...</span>
              </div>
            )}
          </div>

          {/* Approve/Reject controls */}
          {isWaiting && (
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--bg-emphasis)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {showRejectInput && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (required)"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleReject(); }}
                    style={{ flex: 1, background: 'var(--bg-default)', border: '1px solid var(--border-default)', borderRadius: 6, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 12, fontFamily: "'Inter', sans-serif", outline: 'none' }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent-red-emphasis)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
                  />
                  <button onClick={handleReject} disabled={!rejectReason.trim()} style={{
                    background: rejectReason.trim() ? 'var(--accent-red)' : 'var(--bg-emphasis)', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '8px 16px', cursor: !rejectReason.trim() ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                  }}>Send</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleApprove} style={{
                  flex: 1, padding: '10px 16px', background: 'var(--accent-green)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-green-emphasis)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-green)'; }}
                ><Check size={16} /> Approve</button>
                <button onClick={() => setShowRejectInput(!showRejectInput)} style={{
                  flex: 1, padding: '10px 16px', background: showRejectInput ? 'var(--bg-emphasis)' : 'var(--accent-red)', color: '#fff', border: 'none', borderRadius: 6,
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif", transition: 'background 0.15s',
                }}>{showRejectInput ? 'Cancel' : 'Reject'}</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AgentPanel;
