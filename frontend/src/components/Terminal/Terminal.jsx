/**
 * Orion IDE — Terminal Panel
 *
 * Scrollable output area with colored output types,
 * resizable height, clear/copy buttons.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

/* ── SVG Icons ────────────────────────────────────────────────────────── */

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19a1.75 1.75 0 001.741-1.575l.66-6.6a.75.75 0 00-1.492-.15l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
    <path fillRule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
  </svg>
);

const TerminalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM7.25 8a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 11-1.06-1.06L5.44 8 3.72 6.28a.75.75 0 011.06-1.06l2.25 2.25A.75.75 0 017.25 8zm1.5 1.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" />
  </svg>
);

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
  const [height, setHeight] = useState(220);
  const [copied, setCopied] = useState(false);
  const isDraggingRef = useRef(false);

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

  // Resize drag handler
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startY = e.clientY;
    const startHeight = height;

    const onMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startY - moveEvent.clientY;
      setHeight(Math.max(100, Math.min(600, startHeight + delta)));
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [height]);

  return (
    <div
      ref={containerRef}
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        background: '#010409',
        borderTop: '1px solid #21262d',
        flexShrink: 0,
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: 4,
          cursor: 'ns-resize',
          background: 'transparent',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#58a6ff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      />

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
          <TerminalIcon />
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
            <CopyIcon />
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
            <TrashIcon />
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
            <TerminalIcon />
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
