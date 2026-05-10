/**
 * Orion IDE — Status Bar
 *
 * Bottom bar showing: language, line/col, save status, indent, encoding.
 */

import React from 'react';
import { useEditor } from '../../context/EditorContext';
import { getLanguageFromFileName } from '../../utils/languageMap';

/* ── SVG Icons ──────────────────────────────────────────────────────────── */

const GitBranchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6.5A3.5 3.5 0 019 10H6.5v1.128a2.25 2.25 0 11-1.5 0V4.872a2.25 2.25 0 111.5 0v3.628H9a2 2 0 002-2V5.372a2.25 2.25 0 01-1.5-2.122zM5.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm0 9.5a.75.75 0 100 1.5.75.75 0 000-1.5z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
  </svg>
);

const SyncIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.001 7.001 0 0115 8a.75.75 0 01-1.5 0A5.5 5.5 0 008 2.5zM2.5 8a.75.75 0 00-1.5 0 7.001 7.001 0 0012.193 4.693l1.38 1.38a.25.25 0 00.427-.177V10.25a.25.25 0 00-.25-.25h-3.646a.25.25 0 00-.177.427l1.204 1.204A5.501 5.501 0 012.5 8z" />
  </svg>
);

const WarningIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z" />
  </svg>
);

const DotIcon = ({ color }) => (
  <svg width="8" height="8" viewBox="0 0 8 8">
    <circle cx="4" cy="4" r="4" fill={color} />
  </svg>
);

const StatusBar = () => {
  const { activeFile, saveStatus } = useEditor();

  if (!activeFile) return null;

  const langInfo = getLanguageFromFileName(activeFile.fileName);

  const saveIndicators = {
    idle: {
      icon: activeFile.isDirty ? <DotIcon color="#e3b341" /> : null,
      text: activeFile.isDirty ? 'Unsaved' : '',
      color: activeFile.isDirty ? '#e3b341' : '#7d8590',
    },
    saving: {
      icon: <SyncIcon />,
      text: 'Saving...',
      color: '#58a6ff',
    },
    saved: {
      icon: <CheckIcon />,
      text: 'Saved',
      color: '#3fb950',
    },
    error: {
      icon: <WarningIcon />,
      text: 'Save failed',
      color: '#f85149',
    },
  };

  const save = saveIndicators[saveStatus] || saveIndicators.idle;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      height: 24,
      background: '#010409',
      borderTop: '1px solid #21262d',
      fontSize: 12,
      fontFamily: "'Inter', sans-serif",
      color: '#7d8590',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Left side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Branch indicator */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <GitBranchIcon />
          main
        </span>

        {/* Save status */}
        {save.text && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: save.color,
            transition: 'color 0.2s',
          }}>
            {save.icon}
            {save.text}
          </span>
        )}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '1px 8px',
          background: '#161b22',
          borderRadius: 4,
        }}>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color: langInfo.color,
          }}>
            {langInfo.icon}
          </span>
          {langInfo.displayName}
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
