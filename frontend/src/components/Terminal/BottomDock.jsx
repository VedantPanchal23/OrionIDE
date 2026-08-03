/**
 * Orion IDE — bottom dock: Terminal / Output / Problems
 *
 * The terminal is mounted once, as soon as the dock opens, and stays
 * mounted (just hidden) while the user switches between sub-tabs so the
 * PTY session and xterm scrollback are never disturbed.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  X, TerminalSquare, ListTree, AlertCircle, RefreshCw, Trash2, CircleAlert, TriangleAlert,
} from 'lucide-react';
import XTerminal from './XTerminal';
import { getProblems } from '../../services/debugService';
import { IconButton, Spinner, EmptyState, Badge } from '../ui/primitives';

function flattenProblems(payload) {
  const out = [];
  for (const f of payload?.files || []) {
    for (const d of f.diagnostics || []) {
      const sevRaw = d.severity ?? d.sev ?? 4;
      const severity = sevRaw === 8 || sevRaw === 'error' ? 'error' : 'warning';
      out.push({
        filePath: f.filePath || f.fileId,
        fileId: f.fileId,
        line: d.startLineNumber ?? d.line ?? 1,
        message: d.message || 'Diagnostic',
        severity,
      });
    }
  }
  return out;
}

export default function BottomDock({
  projectId, open, onClose, activeTab, onTabChange, outputLines, onClearOutput, running, onOpenProblem,
}) {
  const [problems, setProblems] = useState([]);
  const [loadingProblems, setLoadingProblems] = useState(false);

  const loadProblems = useCallback(async () => {
    setLoadingProblems(true);
    try {
      const data = await getProblems(projectId);
      setProblems(flattenProblems(data));
    } catch {
      setProblems([]);
    } finally {
      setLoadingProblems(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch diagnostics when the Problems tab is shown
    if (open && activeTab === 'problems') loadProblems();
  }, [open, activeTab, loadProblems]);

  if (!open) return null;

  return (
    <div className="dock">
      <div className="dock-tabs">
        <button
          type="button"
          className={`dock-tab ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => onTabChange('terminal')}
        >
          <TerminalSquare size={12} style={{ marginRight: 5, verticalAlign: -2 }} />
          Terminal
        </button>
        <button
          type="button"
          className={`dock-tab ${activeTab === 'output' ? 'active' : ''}`}
          onClick={() => onTabChange('output')}
        >
          <ListTree size={12} style={{ marginRight: 5, verticalAlign: -2 }} />
          Output
          {running && <Spinner size={10} />}
        </button>
        <button
          type="button"
          className={`dock-tab ${activeTab === 'problems' ? 'active' : ''}`}
          onClick={() => onTabChange('problems')}
        >
          <AlertCircle size={12} style={{ marginRight: 5, verticalAlign: -2 }} />
          Problems
          {problems.length > 0 && <Badge accent>{problems.length}</Badge>}
        </button>
        <div className="ide-activity-spacer" />
        {activeTab === 'output' && (
          <IconButton title="Clear output" onClick={onClearOutput}><Trash2 size={13} /></IconButton>
        )}
        {activeTab === 'problems' && (
          <IconButton title="Refresh problems" onClick={loadProblems}><RefreshCw size={13} /></IconButton>
        )}
        <IconButton title="Close panel" onClick={onClose}><X size={14} /></IconButton>
      </div>

      <div className="dock-body">
        <div className="dock-terminal-host" style={{ display: activeTab === 'terminal' ? 'flex' : 'none' }}>
          <XTerminal projectId={projectId} visible={activeTab === 'terminal'} />
        </div>

        {activeTab === 'output' && (
          <div className="dock-output">
            {(!outputLines || outputLines.length === 0) ? (
              <span style={{ color: 'var(--text-muted)' }}>No output yet — run a file to see results here.</span>
            ) : (
              outputLines.map((l, i) => (
                <div key={i} className={l.stream === 'stderr' ? 'line-stderr' : l.stream === 'exit' ? 'line-exit' : ''}>
                  {l.text}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="dock-problems">
            {loadingProblems ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
            ) : problems.length === 0 ? (
              <EmptyState title="No problems detected" hint="Diagnostics reported by the editor will show up here." />
            ) : (
              problems.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className="problem-row"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => onOpenProblem?.(p)}
                >
                  {p.severity === 'error'
                    ? <CircleAlert size={13} className="sev-error" />
                    : <TriangleAlert size={13} className="sev-warning" />}
                  <span>
                    {p.message}
                    {' '}
                    <span style={{ color: 'var(--text-muted)' }}>{p.filePath}:{p.line}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
