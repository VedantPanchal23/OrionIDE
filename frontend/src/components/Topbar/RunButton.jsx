/**
 * Orion IDE — Run Button
 *
 * Triggers code execution for the active file.
 * Disabled when running. Keyboard: F5 or Ctrl+Enter.
 */

import React, { useEffect, useCallback } from 'react';
import { useEditor } from '../../context/EditorContext';
import { getLanguageFromFileName } from '../../utils/languageMap';

/* ── SVG Icons ────────────────────────────────────────────────────────── */

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM6.379 5.227A.25.25 0 006 5.442v5.117a.25.25 0 00.379.214l4.264-2.559a.25.25 0 000-.428L6.379 5.227z" />
  </svg>
);

const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.5 4.5h7v7h-7z" />
    <path fillRule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm0-1.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z" />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.001 7.001 0 0115 8a.75.75 0 01-1.5 0A5.5 5.5 0 008 2.5z" />
  </svg>
);

const RunButton = ({ onRun, onStop, isRunning }) => {
  const { activeFile } = useEditor();

  const langInfo = activeFile
    ? getLanguageFromFileName(activeFile.fileName)
    : null;

  const canRun = activeFile && langInfo?.pistonLanguage && !isRunning;
  const isExecutable = activeFile && langInfo?.pistonLanguage;

  const handleClick = useCallback(() => {
    if (isRunning) {
      onStop?.();
    } else if (canRun) {
      onRun?.(activeFile.fileName, activeFile.content || '');
    }
  }, [isRunning, canRun, activeFile, onRun, onStop]);

  // Keyboard shortcut: F5 or Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        handleClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClick]);

  // Tooltip for non-executable files
  const getTooltip = () => {
    if (!activeFile) return 'Open a file to run it';
    if (!isExecutable) return `${langInfo?.displayName || 'This file type'} cannot be executed`;
    if (isRunning) return 'Stop execution';
    return `Run ${activeFile.fileName} (F5)`;
  };

  return (
    <button
      onClick={handleClick}
      disabled={!activeFile && !isRunning}
      title={getTooltip()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 14px',
        background: isRunning ? '#da3633' : canRun ? '#238636' : '#21262d',
        color: isRunning ? '#ffffff' : canRun ? '#ffffff' : '#484f58',
        border: '1px solid',
        borderColor: isRunning ? '#f85149' : canRun ? '#2ea043' : '#30363d',
        borderRadius: 6,
        cursor: !activeFile && !isRunning ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontFamily: "'Inter', sans-serif",
        fontWeight: 500,
        transition: 'all 0.15s ease',
        opacity: !activeFile && !isRunning ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (isRunning) {
          e.currentTarget.style.background = '#b91c1c';
        } else if (canRun) {
          e.currentTarget.style.background = '#2ea043';
        }
      }}
      onMouseLeave={(e) => {
        if (isRunning) {
          e.currentTarget.style.background = '#da3633';
        } else if (canRun) {
          e.currentTarget.style.background = '#238636';
        }
      }}
    >
      {isRunning ? <SpinnerIcon /> : <PlayIcon />}
      {isRunning ? 'Stop' : 'Run'}
      {!isRunning && langInfo?.displayName && (
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          opacity: 0.8,
          fontWeight: 400,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: langInfo.color || '#7d8590' }} />
          ({langInfo.displayName})
        </span>
      )}
    </button>
  );
};

export default RunButton;
