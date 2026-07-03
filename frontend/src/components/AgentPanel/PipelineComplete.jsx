/**
 * Orion IDE — PipelineComplete Component
 *
 * Summary view shown when the full pipeline finishes.
 */

import React from 'react';

import { CheckCircle2, FileCode2, TerminalSquare, RefreshCw } from 'lucide-react';

const PipelineComplete = ({ session, onReset }) => {
  if (!session) return null;

  const files = session.implementer?.files || [];
  const written = session.fileAgent?.written || [];
  const execResult = session.runAgent?.result;
  const hasError = execResult?.error;

  return (
    <div style={{ padding: 16 }}>
      {/* Success header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        padding: '16px 20px', background: '#0d2117', border: '1px solid var(--accent-green)44',
        borderRadius: 10,
      }}>
        <CheckCircle2 size={24} color="#3fb950" />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#3fb950' }}>
            Build Complete
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {session.projectName || 'Project'} — {files.length} files created
          </div>
        </div>
      </div>

      {/* Files list */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Generated Files
        </div>
        <div style={{
          background: 'var(--bg-default)', border: '1px solid var(--bg-emphasis)', borderRadius: 6,
          overflow: 'hidden',
        }}>
          {files.map((file, i) => {
            const driveEntry = written.find((w) => w.filePath === file.path);
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 12px', borderBottom: i < files.length - 1 ? '1px solid var(--bg-subtle)' : 'none',
                fontSize: 12, color: 'var(--text-primary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileCode2 size={12} color="var(--accent-blue-subtle)" />
                  <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{file.path}</code>
                </div>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 3,
                  background: driveEntry ? '#0d2117' : 'var(--bg-emphasis)',
                  color: driveEntry ? '#3fb950' : 'var(--text-muted)',
                }}>
                  {driveEntry ? 'Saved' : 'Local'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Execution result */}
      {execResult && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Execution Result
          </div>
          <div style={{
            background: 'var(--bg-default)', border: '1px solid var(--bg-emphasis)', borderRadius: 6,
            padding: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <TerminalSquare size={14} color={hasError || execResult.exitCode !== 0 ? 'var(--accent-red-emphasis)' : '#3fb950'} />
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: hasError || execResult.exitCode !== 0 ? 'var(--accent-red-emphasis)' : '#3fb950',
              }}>
                {hasError ? 'Error' : execResult.exitCode === 0 ? 'Success' : `Exit code: ${execResult.exitCode}`}
              </span>
            </div>
            {execResult.stdout && (
              <pre style={{
                margin: 0, fontSize: 11, color: 'var(--text-primary)', lineHeight: '1.5',
                fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap',
              }}>
                {execResult.stdout}
              </pre>
            )}
            {execResult.stderr && (
              <pre style={{
                margin: '4px 0 0', fontSize: 11, color: 'var(--accent-red-emphasis)', lineHeight: '1.5',
                fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap',
              }}>
                {execResult.stderr}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onReset}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 16px', background: 'linear-gradient(135deg, var(--accent-green), var(--accent-green-emphasis))',
            color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: "'Inter', sans-serif",
          }}
        >
          <RefreshCw size={14} />
          New Project
        </button>
      </div>
    </div>
  );
};

export default PipelineComplete;
