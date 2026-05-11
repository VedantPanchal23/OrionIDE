/**
 * Orion IDE — Editor Tabs Component
 *
 * Tab bar for open files with:
 * - Active tab highlighting
 * - Dirty indicator
 * - Close button with unsaved confirmation
 * - Middle-click to close
 * - Horizontal scrolling for many tabs
 */

import React, { useRef } from 'react';
import { useEditor } from '../../context/EditorContext';
import { getLanguageFromFileName } from '../../utils/languageMap';

import { X } from 'lucide-react';

const LanguageBadge = ({ icon, color }) => (
  <span style={{
    fontSize: 9,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    color: color,
    letterSpacing: '-0.3px',
    lineHeight: 1,
    flexShrink: 0,
  }}>
    {icon}
  </span>
);

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
        background: '#010409',
        borderBottom: '1px solid #21262d',
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
              padding: '8px 12px',
              cursor: 'pointer',
              background: isActive ? '#0d1117' : 'transparent',
              borderBottom: isActive ? '2px solid #58a6ff' : '2px solid transparent',
              borderRight: '1px solid #21262d',
              color: isActive ? '#c9d1d9' : '#7d8590',
              fontSize: 13,
              fontFamily: "'Inter', sans-serif",
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              userSelect: 'none',
              minWidth: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = '#161b22';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            <LanguageBadge icon={langInfo.icon} color={langInfo.color} />
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 140,
            }}>
              {file.fileName}
            </span>
            {file.isDirty && (
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#e3b341',
                flexShrink: 0,
                marginLeft: 2,
              }} title="Unsaved changes" />
            )}
            <button
              onClick={(e) => handleClose(e, file.fileId)}
              style={{
                background: 'none',
                border: 'none',
                color: '#7d8590',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                marginLeft: 4,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#30363d';
                e.currentTarget.style.color = '#f85149';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = '#7d8590';
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
