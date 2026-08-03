/**
 * Orion IDE — Run panel (sidebar)
 */

import { Play, Square, FileCode2 } from 'lucide-react';
import { getLanguageByFileName } from '../../utils/languageMap';
import { PanelHeader, Button, EmptyState } from '../ui/primitives';

export default function RunPanel({ activeFile, running, onRun, onStop }) {
  const lang = activeFile ? getLanguageByFileName(activeFile.name) : null;
  const executable = Boolean(lang?.pistonLanguage);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelHeader title="Run" />
      <div className="run-panel-body">
        {!activeFile ? (
          <EmptyState
            icon={<FileCode2 size={28} color="var(--text-muted)" />}
            title="No file open"
            hint="Open a file to run it."
          />
        ) : (
          <>
            <div className="run-file-chip">
              <FileCode2 size={16} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeFile.name}</span>
              <span className="lang">{lang?.abbr}</span>
            </div>
            {!executable ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {lang?.displayName || 'This file type'} can’t be executed directly.
              </span>
            ) : running ? (
              <Button variant="danger" onClick={onStop}><Square size={14} /> Stop</Button>
            ) : (
              <Button variant="primary" onClick={() => onRun(activeFile)}><Play size={14} /> Run file</Button>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Output streams to the Output tab in the bottom dock.</span>
          </>
        )}
      </div>
    </div>
  );
}
