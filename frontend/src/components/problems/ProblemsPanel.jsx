import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import * as problemsApi from '../../services/problemsService';
import { useEditor } from '../../context/EditorContext';
import { useFileTreeContext } from '../../context/FileTreeContext';
import { IconButton, Spinner } from '../ui/primitives';
import { FileIcon } from '../../utils/fileIcons';

function sevIcon(sev) {
  if (sev === 8 || sev === 'error') return <AlertCircle size={12} className="sev-error" />;
  if (sev === 4 || sev === 'warning') return <AlertTriangle size={12} className="sev-warn" />;
  return <Info size={12} className="sev-info" />;
}

export default function ProblemsPanel({ projectId, active }) {
  const { openFile, openFiles, switchTab } = useEditor();
  const tree = useFileTreeContext();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await problemsApi.getProblems(projectId);
      setPayload(res.data?.data || null);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  const [, setTick] = useState(0);
  useEffect(() => {
    const onMarkers = () => setTick((n) => n + 1);
    window.addEventListener('orion-markers-changed', onMarkers);
    return () => window.removeEventListener('orion-markers-changed', onMarkers);
  }, []);

  // Also derive from open Monaco markers stored on window by MonacoEditor / LSP
  const localProblems = [];
  openFiles.forEach((f) => {
    const markers = window.__orionMarkers?.[f.id];
    if (!markers?.length) return;
    markers.forEach((m) => {
      localProblems.push({
        fileId: f.id,
        filePath: f.name,
        message: m.message,
        severity: m.severity,
        startLineNumber: m.startLineNumber,
        startColumn: m.startColumn,
      });
    });
  });

  const remote = [];
  (payload?.files || []).forEach((f) => {
    (f.diagnostics || []).forEach((d) => {
      remote.push({
        fileId: f.fileId,
        filePath: f.filePath || f.fileId,
        ...d,
      });
    });
  });

  const rows = localProblems.length ? localProblems : remote;
  const summary = payload?.summary || {
    errors: rows.filter((r) => r.severity === 8 || r.severity === 'error').length,
    warnings: rows.filter((r) => r.severity === 4 || r.severity === 'warning').length,
    infos: 0,
  };

  const openHit = async (row) => {
    const node = tree.nodesById[row.fileId] || openFiles.find((f) => f.id === row.fileId);
    if (node) {
      await openFile(node, {
        line: row.startLineNumber || undefined,
        column: row.startColumn || 1,
      });
      switchTab(row.fileId);
    }
  };

  return (
    <div className="problems-panel">
      <div className="problems-toolbar">
        <span>
          {summary.errors || 0}
          {' '}
          errors ·
          {' '}
          {summary.warnings || 0}
          {' '}
          warnings
        </span>
        <IconButton title="Refresh" onClick={refresh}>
          {loading ? <Spinner size={11} /> : <RefreshCw size={12} />}
        </IconButton>
      </div>
      <ul className="problems-list">
        {rows.length === 0 && (
          <li className="muted" style={{ padding: 12 }}>No problems detected</li>
        )}
        {rows.map((row, i) => (
          <li key={`${row.fileId}-${i}`}>
            <button type="button" className="problems-row" onClick={() => openHit(row)}>
              {sevIcon(row.severity)}
              <FileIcon name={row.filePath || 'file'} size={12} />
              <span className="problems-msg">{row.message || row.description || 'Issue'}</span>
              <span className="muted">
                {row.filePath}
                {row.startLineNumber ? `:${row.startLineNumber}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
