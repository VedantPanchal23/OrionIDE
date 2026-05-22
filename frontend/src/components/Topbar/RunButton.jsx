/**
 * Orion IDE — Run Button
 *
 * Triggers code execution for the active file.
 * Disabled when running. Keyboard: F5 or Ctrl+Enter.
 * Uses design tokens for consistent styling.
 */

import React, { useEffect, useCallback } from 'react';
import { useEditor } from '../../context/EditorContext';
import { getLanguageFromFileName } from '../../utils/languageMap';

import { Play, Square, Loader2 } from 'lucide-react';

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
        background: isRunning
          ? 'var(--accent-red)'
          : canRun
            ? 'var(--accent-green)'
            : 'var(--bg-emphasis)',
        color: isRunning || canRun ? '#ffffff' : 'var(--text-disabled)',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: !activeFile && !isRunning ? 'not-allowed' : 'pointer',
        fontSize: 'var(--font-size-md)',
        fontFamily: 'var(--font-ui)',
        fontWeight: 600,
        transition: 'all var(--transition-normal)',
        opacity: !activeFile && !isRunning ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (isRunning) e.currentTarget.style.background = '#b91c1c';
        else if (canRun) e.currentTarget.style.background = 'var(--accent-green-emphasis)';
      }}
      onMouseLeave={(e) => {
        if (isRunning) e.currentTarget.style.background = 'var(--accent-red)';
        else if (canRun) e.currentTarget.style.background = 'var(--accent-green)';
      }}
    >
      {isRunning ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
      {isRunning ? 'Stop' : 'Run'}
      {!isRunning && langInfo?.displayName && (
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 'var(--font-size-xs)', opacity: 0.85, fontWeight: 400,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: langInfo.color || 'var(--text-muted)',
          }} />
          {langInfo.displayName}
        </span>
      )}
    </button>
  );
};

export default RunButton;
