/**
 * Orion IDE — Terminal Panel
 *
 * Container component that manages multiple terminal tabs.
 * Creates interactive PTY terminals via the terminal-service.
 * Falls back to the output-only terminal when terminal-service is unavailable.
 *
 * Features:
 * - Multiple terminal instances with tabs
 * - New terminal (+) button
 * - Close individual terminals
 * - Rename terminal tabs (double-click)
 * - Run button integration (Piston execution output)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import XTerminal from './XTerminal';
import { createTerminalSession, destroyTerminalSession, getTerminalWsUrl } from '../../services/terminalService';

import {
  Plus,
  X,
  TerminalSquare,
  Loader2,
  Trash2,
  Copy,
} from 'lucide-react';

/**
 * @typedef {{ id: string, terminalId: string, wsUrl: string, label: string }} TerminalTab
 */

const TerminalPanel = ({ lines, isRunning, onClear }) => {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [outputMode, setOutputMode] = useState(true); // true = output view, false = terminal tabs
  const [copied, setCopied] = useState(false);
  const outputRef = useRef(null);
  const tabCounter = useRef(0);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current && outputMode) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines, outputMode]);

  // ── Create a new terminal ───────────────────────────────────────────
  const handleNewTerminal = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const session = await createTerminalSession({ cols: 80, rows: 24 });
      tabCounter.current += 1;
      const tab = {
        id: `tab-${tabCounter.current}`,
        terminalId: session.terminalId,
        wsUrl: getTerminalWsUrl(session.terminalId),
        label: `Terminal ${tabCounter.current}`,
        shell: session.shell,
      };
      setTabs(prev => [...prev, tab]);
      setActiveTabId(tab.id);
      setOutputMode(false);
    } catch (err) {
      console.error('[TerminalPanel] Failed to create terminal:', err);
      // If service unavailable, stay in output mode
    } finally {
      setIsCreating(false);
    }
  }, [isCreating]);

  // ── Close a terminal tab ────────────────────────────────────────────
  const handleCloseTab = useCallback(async (tabId, e) => {
    e?.stopPropagation();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Destroy on backend
    try {
      await destroyTerminalSession(tab.terminalId);
    } catch {
      // May already be dead
    }

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        if (filtered.length > 0) {
          setActiveTabId(filtered[filtered.length - 1].id);
        } else {
          setActiveTabId(null);
          setOutputMode(true);
        }
      }
      return filtered;
    });
  }, [tabs, activeTabId]);

  // ── Handle terminal process exit ────────────────────────────────────
  const handleTerminalExit = useCallback((terminalId, exitCode) => {
    // Don't auto-close — let user see the exit message
  }, []);

  // ── Copy output ─────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const text = lines.map(l => l.text).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [lines]);

  const LINE_COLORS = {
    stdout: 'var(--text-primary)',
    stderr: 'var(--error)',
    system: 'var(--text-muted)',
    info: 'var(--success)',
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-canvas)',
    }}>
      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-default)',
        flexShrink: 0,
        height: 32,
        overflow: 'hidden',
      }}>
        {/* Output tab (always present) */}
        <button
          onClick={() => { setOutputMode(true); setActiveTabId(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 12px', height: '100%', fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-ui)', fontWeight: 500,
            color: outputMode ? 'var(--text-primary)' : 'var(--text-muted)',
            background: outputMode ? 'var(--bg-canvas)' : 'transparent',
            borderBottom: outputMode ? '2px solid var(--accent-blue)' : '2px solid transparent',
            border: 'none', borderRight: '1px solid var(--border-default)',
            cursor: 'pointer', transition: 'all var(--transition-fast)',
          }}
        >
          <TerminalSquare size={12} />
          Output
          {isRunning && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--info)', animation: 'pulse 1s infinite',
            }} />
          )}
        </button>

        {/* Terminal tabs */}
        <div style={{ display: 'flex', flex: 1, overflow: 'auto' }}>
          {tabs.map(tab => {
            const isActive = !outputMode && tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                onClick={() => { setOutputMode(false); setActiveTabId(tab.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 8px 0 12px', height: 32, fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-ui)', fontWeight: 500,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: isActive ? 'var(--bg-canvas)' : 'transparent',
                  borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  border: 'none', borderRight: '1px solid var(--border-default)',
                  cursor: 'pointer', transition: 'all var(--transition-fast)',
                  whiteSpace: 'nowrap',
                }}
              >
                <TerminalSquare size={12} />
                {tab.label}
                <span
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: 2,
                    borderRadius: 3, marginLeft: 2,
                    opacity: isActive ? 0.8 : 0,
                    transition: 'opacity var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <X size={10} />
                </span>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', flexShrink: 0 }}>
          {outputMode && (
            <>
              <button
                onClick={handleCopy}
                disabled={lines.length === 0}
                title={copied ? 'Copied' : 'Copy output'}
                style={actionBtnStyle(lines.length > 0, copied ? 'var(--success)' : undefined)}
              >
                <Copy size={14} />
              </button>
              <button
                onClick={onClear}
                disabled={lines.length === 0}
                title="Clear output"
                style={actionBtnStyle(lines.length > 0)}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          <button
            onClick={handleNewTerminal}
            disabled={isCreating}
            title="New Terminal"
            style={{
              ...actionBtnStyle(true),
              color: 'var(--text-secondary)',
            }}
          >
            {isCreating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
          </button>
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Output view */}
        {outputMode && (
          <div
            ref={outputRef}
            style={{
              height: '100%', overflow: 'auto',
              padding: '8px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-size-md)',
              lineHeight: '20px',
            }}
          >
            {lines.length === 0 ? (
              <div style={{
                color: 'var(--text-disabled)',
                fontFamily: 'var(--font-ui)',
                fontSize: 'var(--font-size-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: 8,
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
        )}

        {/* Interactive terminal instances */}
        {tabs.map(tab => (
          <div
            key={tab.id}
            style={{
              position: 'absolute', inset: 0,
              display: (!outputMode && tab.id === activeTabId) ? 'block' : 'none',
            }}
          >
            <XTerminal
              terminalId={tab.terminalId}
              wsUrl={tab.wsUrl}
              isActive={!outputMode && tab.id === activeTabId}
              onExit={handleTerminalExit}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

function actionBtnStyle(enabled, color) {
  return {
    background: 'none',
    border: 'none',
    color: color || 'var(--text-muted)',
    cursor: enabled ? 'pointer' : 'default',
    padding: 4,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    opacity: enabled ? 1 : 0.4,
    transition: 'color var(--transition-fast)',
  };
}

export default TerminalPanel;
