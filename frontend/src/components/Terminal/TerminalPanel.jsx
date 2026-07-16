import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import XTerminal from './XTerminal';
import { createTerminalSession, destroyTerminalSession, getTerminalWsUrl } from '../../services/terminalService';

import {
  Plus, X, Trash2, Terminal as TerminalIcon,
  ChevronDown, SplitSquareHorizontal, ChevronUp, MoreHorizontal,
} from 'lucide-react';

/**
 * TerminalPanel — VS Code-style bottom panel.
 *
 * Exposes imperative methods via forwardRef:
 *   - createNewTerminal()  — create and activate a new PTY session
 *   - showOutput()         — switch to the OUTPUT tab
 */
const TerminalPanel = forwardRef(({ lines, isRunning, onClear, projectId, onClose }, ref) => {
  const [tabs, setTabs]           = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [isCreating, setIsCreating]   = useState(false);
  const [activeView, setActiveView]   = useState('TERMINAL');
  const outputRef   = useRef(null);
  const tabCounter  = useRef(0);

  /* ── Scroll output to bottom whenever lines update ─────────────────── */
  useEffect(() => {
    if (outputRef.current && activeView === 'OUTPUT') {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines, activeView]);

  /* ── Create a new PTY terminal session ─────────────────────────────── */
  const handleNewTerminal = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    setActiveView('TERMINAL');

    try {
      const session = await createTerminalSession({
        cols: 80,
        rows: 24,
        cwd: projectId ? `/workspace/${projectId}` : '/workspace',
      });
      tabCounter.current += 1;
      const tab = {
        id: `tab-${tabCounter.current}`,
        terminalId: session.terminalId,
        wsUrl: getTerminalWsUrl(session.terminalId),
        label: session.shell ? session.shell.split('/').pop() : `bash ${tabCounter.current}`,
        shell: session.shell || 'bash',
      };
      setTabs(prev => [...prev, tab]);
      setActiveTabId(tab.id);
    } catch (err) {
      console.error('[TerminalPanel] Failed to create terminal:', err);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, projectId]);

  /* ── Close a terminal tab ───────────────────────────────────────────── */
  const handleCloseTab = useCallback(async (tabId, e) => {
    e?.stopPropagation();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    try { await destroyTerminalSession(tab.terminalId); } catch {}

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(filtered.length > 0 ? filtered[filtered.length - 1].id : null);
      }
      return filtered;
    });
  }, [tabs, activeTabId]);

  /* ── Expose imperative API via ref ─────────────────────────────────── */
  useImperativeHandle(ref, () => ({
    createNewTerminal: handleNewTerminal,
    showOutput: () => {
      setActiveView('OUTPUT');
    },
  }));

  /* ── Line color mapping ─────────────────────────────────────────────── */
  const LINE_COLORS = {
    stdout: 'var(--text-primary)',
    stderr: 'var(--accent-red-emphasis)',
    system: 'var(--text-muted)',
    info:   'var(--success)',
  };

  const VIEWS = ['PROBLEMS', 'OUTPUT', 'DEBUG CONSOLE', 'TERMINAL', 'PORTS'];

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-default)',
      borderTop: '1px solid var(--border-default)',
    }}>
      {/* ── Top bar: view switcher + toolbar ──────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, height: 35, overflow: 'hidden',
        background: 'var(--bg-subtle)',
        borderBottom: '1px solid var(--border-default)',
        padding: '0 4px',
      }}>
        {/* View tabs */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 0 }}>
          {VIEWS.map(v => (
            <div
              key={v}
              onClick={() => setActiveView(v)}
              style={{
                padding: '0 12px', height: '100%',
                display: 'flex', alignItems: 'center',
                fontSize: 11, fontFamily: 'var(--font-ui)', fontWeight: 400,
                color: activeView === v ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeView === v ? '2px solid var(--accent-blue)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color var(--transition-fast), border-color var(--transition-fast)',
                textTransform: 'uppercase', letterSpacing: '0.3px',
                userSelect: 'none',
              }}
              onMouseEnter={e => { if (activeView !== v) e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { if (activeView !== v) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              {v}
            </div>
          ))}
        </div>

        {/* Toolbar actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--text-muted)' }}>
          {activeView === 'OUTPUT' && (
            <button
              onClick={onClear}
              title="Clear Output"
              style={toolBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <Trash2 size={14} />
            </button>
          )}
          {activeView === 'TERMINAL' && (
            <>
              <button onClick={handleNewTerminal} title="New Terminal" style={toolBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
              >
                {isCreating ? <span style={{ fontSize: 12 }}>…</span> : <Plus size={14} />}
              </button>
              <button title="Split Terminal" style={toolBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <SplitSquareHorizontal size={14} />
              </button>
              {activeTabId && (
                <button onClick={() => handleCloseTab(activeTabId)} title="Kill Terminal" style={toolBtnStyle}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red-emphasis)'; e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
          <button onClick={onClose} title="Close Panel" style={toolBtnStyle}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red-emphasis)'; e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Terminal instance tab strip (only in TERMINAL view) ─────────── */}
      {activeView === 'TERMINAL' && tabs.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center',
          height: 28, background: 'var(--bg-default)',
          borderBottom: '1px solid var(--border-default)',
          overflowX: 'auto', overflowY: 'hidden',
          flexShrink: 0,
          scrollbarWidth: 'none',
        }}>
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 10px', height: '100%', cursor: 'pointer',
                  background: isActive ? 'var(--bg-subtle)' : 'transparent',
                  borderRight: '1px solid var(--border-default)',
                  borderTop: isActive ? '1px solid var(--accent-blue)' : '1px solid transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 12, fontFamily: 'var(--font-ui)', userSelect: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'background var(--transition-fast), color var(--transition-fast)',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-emphasis)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
              >
                <TerminalIcon size={12} style={{ opacity: 0.7 }} />
                <span>{tab.label}</span>
                <button
                  onClick={e => handleCloseTab(tab.id, e)}
                  style={{
                    background: 'none', border: 'none', padding: 2,
                    cursor: 'pointer', color: 'inherit', opacity: 0.6,
                    display: 'flex', alignItems: 'center', borderRadius: 3,
                    marginLeft: 2,
                  }}
                  onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--accent-red-emphasis)'; }}
                  onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = 'inherit'; }}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* OUTPUT tab content */}
        {activeView === 'OUTPUT' && (
          <div
            ref={outputRef}
            style={{
              height: '100%', overflow: 'auto',
              padding: '8px 12px',
              fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: '20px',
              background: 'var(--bg-canvas)',
            }}
          >
            {lines.length === 0 ? (
              <div style={{ color: 'var(--text-disabled)', paddingTop: 4 }}>
                No output. Run your code to see results.
              </div>
            ) : (
              lines.map((line, i) => (
                <div key={i} style={{
                  color: LINE_COLORS[line.type] || LINE_COLORS.stdout,
                  fontStyle: line.type === 'system' ? 'italic' : 'normal',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {line.text}
                </div>
              ))
            )}
            {isRunning && (
              <div style={{ color: 'var(--info)', opacity: 0.7, marginTop: 4 }}>
                Running...
              </div>
            )}
          </div>
        )}

        {/* TERMINAL tab content */}
        {activeView === 'TERMINAL' && (
          <>
            {tabs.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: 12,
                color: 'var(--text-disabled)',
              }}>
                <TerminalIcon size={28} style={{ opacity: 0.3 }} />
                <div style={{ fontSize: 13 }}>No active terminals</div>
                <button
                  onClick={handleNewTerminal}
                  style={{
                    padding: '6px 16px', background: 'var(--bg-emphasis)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)', cursor: 'pointer',
                    fontSize: 12, fontFamily: 'var(--font-ui)',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
                >
                  <Plus size={14} /> New Terminal
                </button>
              </div>
            ) : (
              tabs.map(tab => (
                <div
                  key={tab.id}
                  style={{
                    position: 'absolute', inset: 0,
                    display: tab.id === activeTabId ? 'block' : 'none',
                    padding: '2px 4px 0',
                  }}
                >
                  <XTerminal
                    terminalId={tab.terminalId}
                    wsUrl={tab.wsUrl}
                    isActive={tab.id === activeTabId && activeView === 'TERMINAL'}
                    onExit={(terminalId, exitCode) => {
                      // On exit, update label to show exit code
                      setTabs(prev => prev.map(t =>
                        t.terminalId === terminalId
                          ? { ...t, label: `${t.label} [exited: ${exitCode}]` }
                          : t
                      ));
                    }}
                  />
                </div>
              ))
            )}
          </>
        )}

        {/* Stub panels */}
        {['PROBLEMS', 'DEBUG CONSOLE', 'PORTS'].includes(activeView) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--text-disabled)', fontSize: 13,
          }}>
            No {activeView.toLowerCase()} available.
          </div>
        )}
      </div>
    </div>
  );
});

TerminalPanel.displayName = 'TerminalPanel';

export default TerminalPanel;

/* ── Styles ─────────────────────────────────────────────────────────────── */
const toolBtnStyle = {
  background: 'transparent', border: 'none',
  color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 6px',
  display: 'flex', alignItems: 'center', borderRadius: 4,
  transition: 'color var(--transition-fast), background var(--transition-fast)',
};
