import { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw, Trash2 } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useToast } from '../../context/ToastContext';
import { IconButton, Spinner } from '../ui/primitives';
import DiffModal from '../git/DiffModal';
import * as localHistory from '../../lib/localHistory';
import { formatApiError } from '../../utils/apiError';

function formatWhen(at) {
  if (!at) return '';
  try {
    return new Date(at).toLocaleString();
  } catch {
    return String(at);
  }
}

export default function HistoryPanel() {
  const {
    focusedFile, getLiveContent, updateContent, saveFile,
  } = useEditor();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState(null);

  const fileId = focusedFile?.id;

  const refresh = useCallback(async () => {
    if (!fileId) {
      setRows([]);
      return;
    }
    setBusy(true);
    try {
      setRows(await localHistory.listSnapshots(fileId));
    } catch (err) {
      toast.error(formatApiError(err, 'Could not load history'));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [fileId, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const restore = async (snap) => {
    if (!fileId || !snap) return;
    if (!window.confirm('Restore this snapshot into the editor? Current buffer will be overwritten (a new history entry is kept on next save).')) {
      return;
    }
    try {
      updateContent(fileId, snap.content);
      await saveFile(fileId);
      toast.success('Snapshot restored');
      refresh();
    } catch (err) {
      toast.error(formatApiError(err, 'Restore failed'));
    }
  };

  const clearAll = async () => {
    if (!fileId) return;
    if (!window.confirm('Clear local history for this file?')) return;
    await localHistory.clearFileHistory(fileId);
    setRows([]);
    toast.info('History cleared');
  };

  return (
    <div className="side-panel">
      <div className="ide-sidebar-title">
        <span>Local History</span>
        <span className="title-actions">
          <IconButton title="Refresh" onClick={refresh} disabled={busy || !fileId}>
            {busy ? <Spinner size={12} /> : <History size={13} />}
          </IconButton>
          <IconButton title="Clear history" onClick={clearAll} disabled={!fileId || rows.length === 0}>
            <Trash2 size={13} />
          </IconButton>
        </span>
      </div>
      <div className="side-panel-body">
        {!fileId ? (
          <div className="side-empty polished">
            <p className="side-empty-title">No file open</p>
            <p>Open a file to see local save snapshots (browser only).</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="side-empty polished">
            <p className="side-empty-title">No snapshots yet</p>
            <p>
              History is recorded when
              {' '}
              <strong>{focusedFile?.name || 'this file'}</strong>
              {' '}
              is saved.
            </p>
          </div>
        ) : (
          <ul className="history-list">
            {rows.map((snap) => (
              <li key={snap.id} className="history-row">
                <button
                  type="button"
                  className="history-when"
                  title="Compare to current buffer"
                  onClick={() => setDiff({
                    path: focusedFile?.name,
                    original: snap.content,
                    modified: getLiveContent?.(fileId) ?? focusedFile?.content ?? '',
                    title: formatWhen(snap.at),
                  })}
                >
                  {formatWhen(snap.at)}
                </button>
                <span className="muted history-size">
                  {snap.content?.length ?? 0}
                  {' '}
                  chars
                </span>
                <button
                  type="button"
                  className="git-action"
                  title="Restore"
                  onClick={() => restore(snap)}
                >
                  <RotateCcw size={12} />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DiffModal
        open={Boolean(diff)}
        path={diff?.path}
        title={diff?.title}
        original={diff?.original}
        modified={diff?.modified}
        onClose={() => setDiff(null)}
      />
    </div>
  );
}
