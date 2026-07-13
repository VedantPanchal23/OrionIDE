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
        background: 'var(--bg-inset)',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        flexShrink: 0,
        height: 35,
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
            className={`tab-container ${isActive ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 12px',
              height: '100%',
              cursor: 'pointer',
              background: isActive ? 'var(--bg-default)' : 'transparent',
              borderTop: isActive ? '1px solid var(--accent-blue)' : '1px solid transparent',
              borderBottom: 'none',
              borderRight: '1px solid var(--border-default)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 'var(--font-size-md)',
              fontFamily: 'var(--font-ui)',
              fontWeight: isActive ? 500 : 400,
              whiteSpace: 'nowrap',
              transition: 'background 50ms ease, color 50ms ease',
              userSelect: 'none',
              minWidth: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--bg-subtle)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            {/* Language icon */}
            <span style={{
              fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
              color: langInfo.color, letterSpacing: '-0.3px', lineHeight: 1, flexShrink: 0,
              padding: '2px 4px', background: 'rgba(255,255,255,0.03)', borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.05)',
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
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent-yellow)', flexShrink: 0,
                boxShadow: '0 0 6px var(--accent-yellow)',
              }} title="Unsaved changes" />
            )}

            {/* Close button */}
            <button
              onClick={(e) => handleClose(e, file.fileId)}
              className="tab-close-btn"
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: 2, borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 16, height: 16, marginLeft: 2,
                transition: 'background 50ms ease, color 50ms ease',
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                e.currentTarget.style.background = 'var(--bg-emphasis)';
                e.currentTarget.style.color = 'var(--accent-red-emphasis)';
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              title="Close"
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default EditorTabs;
