/**
 * Orion IDE — Breadcrumb Navigation
 *
 * Shows file path segments above the editor.
 * e.g. src > components > Layout > IDELayout.jsx
 */

import React from 'react';
import { useEditor } from '../../context/EditorContext';
import { ChevronRight, FileCode } from 'lucide-react';
import { getLanguageFromFileName } from '../../utils/languageMap';

const Breadcrumbs = () => {
  const { openFiles, activeFileId } = useEditor();
  const activeFile = openFiles.find(f => f.fileId === activeFileId);

  if (!activeFile) return null;

  const fileName = activeFile.fileName || '';
  const segments = fileName.includes('/') ? fileName.split('/') : [fileName];
  const lang = getLanguageFromFileName(fileName);

  return (
    <div style={{
      height: 28, display: 'flex', alignItems: 'center', gap: 4,
      padding: '0 16px', background: 'var(--bg-default)',
      borderBottom: '1px solid var(--border-default)',
      fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)',
      color: 'var(--text-muted)', flexShrink: 0, overflow: 'hidden',
    }}>
      <FileCode size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={10} style={{ flexShrink: 0, opacity: 0.4 }} />}
            <span style={{
              color: isLast ? (lang?.color || 'var(--info)') : 'var(--text-muted)',
              fontWeight: isLast ? 600 : 400,
              whiteSpace: 'nowrap',
              cursor: 'default',
            }}>
              {segment}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Breadcrumbs;
