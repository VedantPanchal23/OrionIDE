/**
 * Orion IDE — Editor Tabs Component
 *
 * Tab bar for open files with:
 * - Active tab highlighting with accent underline
 * - Dirty indicator (dot)
 * - Close button with unsaved confirmation
 * - Middle-click to close
 * - Horizontal scrolling for many tabs
 * - Design token styling
 */

import React, { useRef } from 'react';
import { useEditor } from '../../context/EditorContext';
import { getLanguageFromFileName } from '../../utils/languageMap';

import { X } from 'lucide-react';

const EditorTabs = () => {
  const { openFiles, activeFileId, switchTab, closeFile } = useEditor();
  const tabsRef = useRef(null);

  const handleClose = (e, fileId) => {
    e.stopPropagation();
    const file = openFiles.find((f) => f.fileId === fileId);
    if (file?.isDirty) {
      const confirmed = window.confirm(`"${file.fileName}" has unsaved changes. Close anyway?`);
      if (!confirmed) return;
    }
    closeFile(fileId);
  };

  const handleMiddleClick = (e, fileId) => {
    if (e.button === 1) {
      e.preventDefault();
      handleClose(e, fileId);
    }
  };

  const handleWheel = (e) => {
    if (tabsRef.current) {
      tabsRef.current.scrollLeft += e.deltaY;
    }
  };

  if (openFiles.length === 0) return null;

  return (
    <div
      ref={tabsRef}
      onWheel={handleWheel}
      style={{
        display: 'flex',
        background: 'var(--bg-canvas)',
        borderBottom: '1px solid var(--border-default)',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        flexShrink: 0,
      }}
    >
      {openFiles.map((file) => {
        const isActive = file.fileId === activeFileId;
        const langInfo = getLanguageFromFileName(file.fileName);

        return (
          <div
            key={file.fileId}
            onClick={() => switchTab(file.fileId)}
            onMouseDown={(e) => handleMiddleClick(e, file.fileId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              cursor: 'pointer',
              background: isActive ? 'var(--bg-default)' : 'transparent',
              borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
              borderRight: '1px solid var(--border-default)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 'var(--font-size-md)',
              fontFamily: 'var(--font-ui)',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition-normal)',
              userSelect: 'none',
              minWidth: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'var(--bg-subtle)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Language icon */}
            <span style={{
              fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              color: langInfo.color, letterSpacing: '-0.3px', lineHeight: 1, flexShrink: 0,
            }}>
              {langInfo.icon}
            </span>

            {/* File name */}
            <span style={{
              overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140,
            }}>
              {file.fileName}
            </span>

            {/* Dirty indicator */}
            {file.isDirty && (
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--accent-yellow)', flexShrink: 0,
              }} title="Unsaved changes" />
            )}

            {/* Close button */}
            <button
              onClick={(e) => handleClose(e, file.fileId)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: 0, lineHeight: 1, borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, marginLeft: 2,
                transition: 'all var(--transition-normal)',
                opacity: isActive ? 0.8 : 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-emphasis)';
                e.currentTarget.style.color = 'var(--error)';
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.opacity = isActive ? '0.8' : '0';
              }}
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default EditorTabs;
