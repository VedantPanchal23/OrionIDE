import React, { useState, useCallback, useRef, useEffect } from 'react';
import XTerminal from './XTerminal';
import { createTerminalSession, destroyTerminalSession, getTerminalWsUrl } from '../../services/terminalService';

import {
  Plus,
  X,
  Trash2,
  Terminal as TerminalIcon,
  ChevronDown,
  SplitSquareHorizontal,
  ChevronUp,
  MoreHorizontal
} from 'lucide-react';

const TerminalPanel = ({ lines, isRunning, onClear, projectId }) => {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [outputMode, setOutputMode] = useState(false);
  const [activeView, setActiveView] = useState('TERMINAL'); // PROBLEMS, OUTPUT, DEBUG CONSOLE, TERMINAL, PORTS
  const outputRef = useRef(null);
  const tabCounter = useRef(0);

  useEffect(() => {
    if (outputRef.current && activeView === 'OUTPUT') {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines, activeView]);

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
        label: `node`,
        shell: session.shell,
      };
      setTabs(prev => [...prev, tab]);
      setActiveTabId(tab.id);
    } catch (err) {
      console.error('[TerminalPanel] Failed to create terminal:', err);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, projectId]);

  const handleCloseTab = useCallback(async (tabId, e) => {
    e?.stopPropagation();
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    try {
      await destroyTerminalSession(tab.terminalId);
    } catch {}

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        if (filtered.length > 0) {
          setActiveTabId(filtered[filtered.length - 1].id);
        } else {
          setActiveTabId(null);
        }
      }
      return filtered;
    });
  }, [tabs, activeTabId]);

  const handleTerminalExit = useCallback((terminalId, exitCode) => {}, []);

  const LINE_COLORS = {
    stdout: '#cccccc',
    stderr: '#f48771',
    system: '#858585',
    info: '#89d185',
  };

  const views = ['PROBLEMS', 'OUTPUT', 'DEBUG CONSOLE', 'TERMINAL', 'PORTS'];

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#1e1e1e',
      borderTop: '1px solid #454545'
    }}>
      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        height: 35,
        overflow: 'hidden',
        padding: '0 8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {views.map(v => (
            <div
              key={v}
              onClick={() => setActiveView(v)}
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                fontWeight: activeView === v ? 400 : 400,
                color: activeView === v ? '#ffffff' : '#cccccc',
                borderBottom: activeView === v ? '1px solid #007acc' : '1px solid transparent',
                cursor: 'pointer',
                paddingBottom: 2,
                marginTop: 2,
                textTransform: 'uppercase'
              }}
            >
              {v}
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cccccc' }}>
          {activeView === 'TERMINAL' && tabs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '2px 4px', background: '#333333', borderRadius: 4, fontSize: 12 }}>
              <span>node</span>
              <ChevronDown size={14} />
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
            <span style={{ cursor: 'pointer', padding: 4, borderRadius: 4 }} title="New Terminal" onClick={handleNewTerminal}><Plus size={14} /></span>
            <span style={{ cursor: 'pointer', padding: 4, borderRadius: 4 }} title="Split Terminal"><SplitSquareHorizontal size={14} /></span>
            <span style={{ cursor: 'pointer', padding: 4, borderRadius: 4 }} title="Kill Terminal" onClick={() => activeTabId && handleCloseTab(activeTabId)}><Trash2 size={14} /></span>
            <span style={{ cursor: 'pointer', padding: 4, borderRadius: 4 }} title="More Actions..."><MoreHorizontal size={14} /></span>
            <span style={{ cursor: 'pointer', padding: 4, borderRadius: 4 }} title="Maximize Panel Size"><ChevronUp size={14} /></span>
            <span style={{ cursor: 'pointer', padding: 4, borderRadius: 4 }} title="Close Panel"><X size={14} /></span>
          </div>
        </div>
      </div>

      {/* ── Content area ────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeView === 'OUTPUT' && (
          <div
            ref={outputRef}
            style={{
              height: '100%', overflow: 'auto',
              padding: '8px 16px',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: 13,
              lineHeight: '20px',
            }}
          >
            {lines.length === 0 ? (
              <div style={{ color: '#858585' }}>No output. Run your code to see results.</div>
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

        {activeView === 'TERMINAL' && (
          <>
            {tabs.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#858585', fontSize: 13 }}>
                No active terminals. Click the + icon to open a new terminal.
              </div>
            ) : (
              tabs.map(tab => (
                <div
                  key={tab.id}
                  style={{
                    position: 'absolute', inset: 0,
                    display: tab.id === activeTabId ? 'block' : 'none',
                    padding: '0 8px',
                  }}
                >
                  <XTerminal
                    terminalId={tab.terminalId}
                    wsUrl={tab.wsUrl}
                    isActive={tab.id === activeTabId && activeView === 'TERMINAL'}
                    onExit={handleTerminalExit}
                  />
                </div>
              ))
            )}
          </>
        )}

        {['PROBLEMS', 'DEBUG CONSOLE', 'PORTS'].includes(activeView) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#858585', fontSize: 13 }}>
            No {activeView.toLowerCase()} available.
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalPanel;
