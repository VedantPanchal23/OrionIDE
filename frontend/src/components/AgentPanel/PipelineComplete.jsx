/**
 * Orion IDE — PipelineComplete Component
 *
 * Summary view shown when the full pipeline finishes.
 */

import React from 'react';

const CheckCircle = () => (
  <svg width="24" height="24" viewBox="0 0 16 16" fill="#3fb950">
    <path fillRule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z" />
  </svg>
);

const FileIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="#58a6ff">
    <path fillRule="evenodd" d="M3.75 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75z" />
  </svg>
);

const TerminalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM7.25 8a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 11-1.06-1.06L5.44 8 3.72 6.28a.75.75 0 011.06-1.06l2.25 2.25c.141.14.22.331.22.53zm1.5 1.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.001 7.001 0 0115 8a.75.75 0 01-1.5 0A5.5 5.5 0 008 2.5zM2.5 8a.75.75 0 00-1.5 0 7.001 7.001 0 0012.193 4.693l1.38 1.38a.25.25 0 00.427-.177V10.25a.25.25 0 00-.25-.25h-3.646a.25.25 0 00-.177.427l1.204 1.204A5.501 5.501 0 012.5 8z" />
  </svg>
);

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
        <CheckCircle />
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
                  <FileIcon />
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
              <TerminalIcon />
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
          <RefreshIcon />
          New Project
        </button>
      </div>
    </div>
  );
};

export default PipelineComplete;
