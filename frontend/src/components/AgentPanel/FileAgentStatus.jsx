/**
 * Orion IDE — FileAgentStatus Component
 *
 * Shows file writing progress to Google Drive.
 */

import React from 'react';

const DriveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="#7d8590">
    <path fillRule="evenodd" d="M3.75 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v8.086A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25V1.75z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="#3fb950">
    <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="#58a6ff" style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.001 7.001 0 0115 8a.75.75 0 01-1.5 0A5.5 5.5 0 008 2.5z" />
  </svg>
);

const FileAgentStatus = ({ written, pending, currentFile, totalFiles }) => {
  const completedCount = written?.length || 0;

  return (
    <div style={{
      background: '#0d1117', border: '1px solid #21262d', borderRadius: 8,
      overflow: 'hidden', marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', background: '#161b22', borderBottom: '1px solid #21262d',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DriveIcon />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#c9d1d9' }}>
            Writing to Google Drive
          </span>
        </div>
        <span style={{
          fontSize: 11, color: '#7d8590',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {completedCount} / {totalFiles || '?'} files
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '8px 14px' }}>
        <div style={{
          height: 4, background: '#21262d', borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, #238636, #3fb950)',
            width: totalFiles ? `${(completedCount / totalFiles) * 100}%` : '0%',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Current file being written */}
      {currentFile && (
        <div style={{
          padding: '4px 14px 8px', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: '#58a6ff',
        }}>
          <SpinnerIcon />
          <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
            {currentFile}
          </code>
        </div>
      )}

      {/* Written files list */}
      {written?.length > 0 && (
        <div style={{ padding: '4px 14px 10px' }}>
          {written.map((file, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '2px 0', fontSize: 11, color: '#8b949e',
            }}>
              <CheckIcon />
              <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>{file.filePath}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileAgentStatus;
