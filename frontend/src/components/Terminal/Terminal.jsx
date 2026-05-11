/**
 * Orion IDE — Terminal Panel
 *
 * Scrollable output area with colored output types,
 * resizable height, clear/copy buttons.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

import { Trash2, Copy, TerminalSquare } from 'lucide-react';

/* ── Line color map ───────────────────────────────────────────────────── */

const LINE_COLORS = {
  stdout: '#c9d1d9',
  stderr: '#f85149',
  system: '#7d8590',
  info: '#3fb950',
};

const Terminal = ({ lines, isRunning, onClear }) => {
  const outputRef = useRef(null);
  const containerRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  // Copy all output
  const handleCopy = useCallback(() => {
    const text = lines.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [lines]);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#010409',
        borderTop: 'none',
        flexShrink: 0,
      }}
    >


      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 12px',
        borderBottom: '1px solid #21262d',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: '#c9d1d9',
          fontFamily: "'Inter', sans-serif",
        }}>
          <TerminalSquare size={14} />
          Terminal
          {isRunning && (
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#58a6ff',
              animation: 'pulse 1s infinite',
            }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleCopy}
            disabled={lines.length === 0}
            title={copied ? 'Copied' : 'Copy output'}
            style={{
              background: 'none',
              border: 'none',
              color: copied ? '#3fb950' : '#7d8590',
              cursor: lines.length === 0 ? 'default' : 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              opacity: lines.length === 0 ? 0.4 : 1,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { if (lines.length > 0) e.currentTarget.style.color = '#c9d1d9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = copied ? '#3fb950' : '#7d8590'; }}
          >
            <Copy size={14} />
          </button>
          <button
            onClick={onClear}
            disabled={lines.length === 0}
            title="Clear terminal"
            style={{
              background: 'none',
              border: 'none',
              color: '#7d8590',
              cursor: lines.length === 0 ? 'default' : 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              opacity: lines.length === 0 ? 0.4 : 1,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { if (lines.length > 0) e.currentTarget.style.color = '#f85149'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#7d8590'; }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 16px',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          lineHeight: '20px',
        }}
      >
        {lines.length === 0 ? (
          <div style={{
            color: '#484f58',
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 8,
          }}>
            <TerminalSquare size={14} />
            Run your code to see output here
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} style={{
              color: LINE_COLORS[line.type] || LINE_COLORS.stdout,
              fontStyle: line.type === 'system' ? 'italic' : 'normal',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {line.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Terminal;
