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
        padding: '16px 20px', background: '#0d2117', border: '1px solid #23863644',
        borderRadius: 10,
      }}>
        <CheckCircle2 size={24} color="#3fb950" />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#3fb950' }}>
            Build Complete
          </div>
          <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2 }}>
            {session.projectName || 'Project'} — {files.length} files created
          </div>
        </div>
      </div>

      {/* Files list */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#7d8590', marginBottom: 8,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          Generated Files
        </div>
        <div style={{
          background: '#0d1117', border: '1px solid #21262d', borderRadius: 6,
          overflow: 'hidden',
        }}>
          {files.map((file, i) => {
            const driveEntry = written.find((w) => w.filePath === file.path);
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 12px', borderBottom: i < files.length - 1 ? '1px solid #161b22' : 'none',
                fontSize: 12, color: '#c9d1d9',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileCode2 size={12} color="#58a6ff" />
                  <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{file.path}</code>
                </div>
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 3,
                  background: driveEntry ? '#0d2117' : '#21262d',
                  color: driveEntry ? '#3fb950' : '#7d8590',
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
            fontSize: 11, fontWeight: 600, color: '#7d8590', marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Execution Result
          </div>
          <div style={{
            background: '#0d1117', border: '1px solid #21262d', borderRadius: 6,
            padding: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <TerminalSquare size={14} color={hasError || execResult.exitCode !== 0 ? '#f85149' : '#3fb950'} />
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: hasError || execResult.exitCode !== 0 ? '#f85149' : '#3fb950',
              }}>
                {hasError ? 'Error' : execResult.exitCode === 0 ? 'Success' : `Exit code: ${execResult.exitCode}`}
              </span>
            </div>
            {execResult.stdout && (
              <pre style={{
                margin: 0, fontSize: 11, color: '#c9d1d9', lineHeight: '1.5',
                fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre-wrap',
              }}>
                {execResult.stdout}
              </pre>
            )}
            {execResult.stderr && (
              <pre style={{
                margin: '4px 0 0', fontSize: 11, color: '#f85149', lineHeight: '1.5',
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
            padding: '10px 16px', background: 'linear-gradient(135deg, #238636, #2ea043)',
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
