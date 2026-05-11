/**
 * Orion IDE — Status Bar
 *
 * Bottom bar showing: language, line/col, save status, indent, encoding.
 */

import React from 'react';
import { useEditor } from '../../context/EditorContext';
import { getLanguageFromFileName } from '../../utils/languageMap';

import { GitBranch, Check, Loader2, AlertTriangle } from 'lucide-react';

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
      icon: <Loader2 size={12} className="spin" />,
      text: 'Saving...',
      color: '#58a6ff',
    },
    saved: {
      icon: <Check size={12} />,
      text: 'Saved',
      color: '#3fb950',
    },
    error: {
      icon: <AlertTriangle size={12} />,
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
          <GitBranch size={12} />
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
