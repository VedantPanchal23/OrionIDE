/**
 * Orion IDE — open file tabs
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { getLanguageAbbr } from '../../utils/languageMap';
import ConfirmModal from '../ui/ConfirmModal';

export default function EditorTabs() {
  const { openFiles, activeFileId, switchTab, closeFile } = useEditor();
  const [pendingClose, setPendingClose] = useState(null);

  if (openFiles.length === 0) return null;

  const requestClose = (e, file) => {
    e.stopPropagation();
    if (file.isDirty) setPendingClose(file);
    else closeFile(file.id);
  };

  return (
    <div className="editor-tabs">
      {openFiles.map((f) => (
        <div
          key={f.id}
          className={`editor-tab ${f.id === activeFileId ? 'active' : ''}`}
          onClick={() => switchTab(f.id)}
          onMouseDown={(e) => { if (e.button === 1) requestClose(e, f); }}
          title={f.name}
        >
          <span className="editor-tab-label">{f.name}</span>
          <span className="editor-tab-ext">{getLanguageAbbr(f.name)}</span>
          {f.isDirty && <span className="editor-tab-dirty" />}
          <button
            type="button"
            className="editor-tab-close"
            onClick={(e) => requestClose(e, f)}
            aria-label={`Close ${f.name}`}
          >
            <X size={11} />
          </button>
        </div>
      ))}

      <ConfirmModal
        open={Boolean(pendingClose)}
        title={`Close "${pendingClose?.name}"?`}
        message="You have unsaved changes. Closing now will discard them (Drive's auto-saved buffer keeps the last synced version)."
        confirmLabel="Discard & close"
        danger
        onConfirm={() => { closeFile(pendingClose.id); setPendingClose(null); }}
        onCancel={() => setPendingClose(null)}
      />
    </div>
  );
}
