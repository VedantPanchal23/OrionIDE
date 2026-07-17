/**
 * Orion IDE — Run & Debug Panel
 *
 * Shows the active file's run configuration, execution history,
 * and quick-launch buttons for supported languages.
 */

import React, { useCallback } from 'react';
import {
  Play, Square, Zap, Terminal, FileCode2, Clock,
  CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { getLanguageFromFileName } from '../../utils/languageMap';

const RunDebugPanel = ({ isRunning, onRun, onStop, lines }) => {
  const { activeFile } = useEditor();
  const langInfo = activeFile ? getLanguageFromFileName(activeFile.fileName) : null;
  const canRun = !!activeFile && !!langInfo?.pistonLanguage;

  /* Execution history from terminal lines */
  const history = (lines || [])
    .filter(l => l.type === 'system' || l.type === 'info')
    .slice(-5)
    .reverse();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'var(--font-ui)', overflow: 'hidden',
    }}>

      {/* Active file card */}
      <div style={{ padding: 12, borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
        <div style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8,
        }}>
          Active Configuration
        </div>

        {activeFile ? (
          <div style={{
            background: 'var(--bg-emphasis)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)', padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <FileCode2 size={14} color={langInfo?.color || 'var(--text-muted)'} />
              <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                {activeFile.fileName}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px',
                background: langInfo?.color ? `${langInfo.color}18` : 'var(--bg-subtle)',
                color: langInfo?.color || 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)', border: `1px solid ${langInfo?.color || 'var(--border-default)'}30`,
                fontFamily: 'var(--font-mono)',
              }}>
                {langInfo?.displayName || 'Unknown'}
              </span>
              {!canRun && (
                <span style={{ fontSize: 10, color: 'var(--warning)' }}>
                  (not executable)
                </span>
              )}
            </div>

            <button
              onClick={isRunning ? onStop : onRun}
              disabled={!canRun && !isRunning}
              style={{
                width: '100%', padding: '8px 0', border: 'none',
                borderRadius: 'var(--radius-sm)', cursor: canRun || isRunning ? 'pointer' : 'not-allowed',
                background: isRunning ? 'var(--accent-red)' : canRun ? 'var(--accent-green)' : 'var(--bg-subtle)',
                color: canRun || isRunning ? '#fff' : 'var(--text-disabled)',
                fontSize: 'var(--font-size-sm)', fontWeight: 600, fontFamily: 'var(--font-ui)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'background var(--transition-fast)',
                opacity: !canRun && !isRunning ? 0.5 : 1,
              }}
              onMouseEnter={e => {
                if (canRun || isRunning)
                  e.currentTarget.style.background = isRunning ? 'var(--accent-red-emphasis)' : 'var(--accent-green-emphasis)';
              }}
              onMouseLeave={e => {
                if (canRun || isRunning)
                  e.currentTarget.style.background = isRunning ? 'var(--accent-red)' : 'var(--accent-green)';
              }}
            >
              {isRunning
                ? <><Square size={12} fill="currentColor" /> Stop Execution</>
                : <><Play size={12} fill="currentColor" /> Run {activeFile.fileName}</>
              }
            </button>
          </div>
        ) : (
          <div style={{
            padding: '16px 12px', textAlign: 'center',
            border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-disabled)', fontSize: 'var(--font-size-sm)',
          }}>
            Open a file to run it
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
        <div style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8,
        }}>
          Quick Actions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: 'Run Active File', icon: Play, kbd: 'F5', color: 'var(--success)', action: onRun, disabled: !canRun },
            { label: 'Stop Execution',  icon: Square, kbd: 'Shift+F5', color: 'var(--error)', action: onStop, disabled: !isRunning },
            { label: 'Open Terminal',   icon: Terminal, kbd: 'Ctrl+`', color: 'var(--info)', action: () => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: '`', ctrlKey: true, bubbles: true }));
            }, disabled: false },
          ].map(({ label, icon: Icon, kbd, color, action, disabled }) => (
            <button
              key={label}
              onClick={action}
              disabled={disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                background: 'var(--bg-emphasis)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)', cursor: disabled ? 'not-allowed' : 'pointer',
                color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-ui)',
                opacity: disabled ? 0.5 : 1,
                transition: 'background var(--transition-fast), border-color var(--transition-fast)',
                width: '100%', textAlign: 'left',
              }}
              onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.borderColor = color; } }}
              onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = 'var(--bg-emphasis)'; e.currentTarget.style.borderColor = 'var(--border-default)'; } }}
            >
              <Icon size={13} color={disabled ? 'var(--text-disabled)' : color} />
              <span style={{ flex: 1 }}>{label}</span>
              <kbd style={{
                fontSize: 9, padding: '1px 4px', background: 'var(--bg-canvas)',
                border: '1px solid var(--border-emphasis)', borderRadius: 3,
                color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
              }}>
                {kbd}
              </kbd>
            </button>
          ))}
        </div>
      </div>

      {/* Recent execution log */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>
        <div style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Clock size={11} /> Recent Executions
        </div>
        {history.length === 0 ? (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-disabled)', textAlign: 'center', paddingTop: 16 }}>
            No executions yet
          </div>
        ) : history.map((line, i) => {
          const isSuccess = line.type === 'info';
          const Icon = isSuccess ? CheckCircle2 : AlertCircle;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6,
              padding: '6px 8px', background: 'var(--bg-emphasis)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <Icon size={12} color={isSuccess ? 'var(--success)' : 'var(--warning)'} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{
                fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)', lineHeight: 1.4,
              }}>
                {line.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RunDebugPanel;
