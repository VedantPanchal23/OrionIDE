/**
 * Orion IDE — FileAgentStatus Component
 *
 * Shows file writing progress to Google Drive.
 */

import React from 'react';

import { HardDrive, Check, Loader2 } from 'lucide-react';

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
          <HardDrive size={14} color="#7d8590" />
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
          <Loader2 size={12} color="#58a6ff" className="spin" />
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
              <Check size={12} color="#3fb950" />
              <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>{file.filePath}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileAgentStatus;
