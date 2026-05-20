/**
 * Orion IDE — Status Bar
 *
 * Bottom bar showing: language, line/col, save status, indent, encoding.
 */

import React from 'react';
import { useEditor } from '../../context/EditorContext';
import { getLanguageFromFileName } from '../../utils/languageMap';

import { Check, Loader2, AlertTriangle } from 'lucide-react';

const DotIcon = ({ color }) => (
  <svg width="8" height="8" viewBox="0 0 8 8">
    <circle cx="4" cy="4" r="4" fill={color} />
  </svg>
);

const StatusBar = () => {
  const { activeFile, saveStatus, cursorPosition } = useEditor();

  if (!activeFile) return null;

  const langInfo = getLanguageFromFileName(activeFile.fileName);

  const saveIndicators = {
    idle: {
      icon: activeFile.isDirty ? <DotIcon color="var(--accent-yellow)" /> : null,
      text: activeFile.isDirty ? 'Unsaved' : '',
      color: activeFile.isDirty ? 'var(--accent-yellow)' : 'var(--text-muted)',
    },
    saving: {
      icon: <Loader2 size={12} className="spin" />,
      text: 'Saving...',
      color: 'var(--info)',
    },
    saved: {
      icon: <Check size={12} />,
      text: 'Saved',
      color: 'var(--success)',
    },
    error: {
      icon: <AlertTriangle size={12} />,
      text: 'Save failed',
      color: 'var(--error)',
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
      background: 'var(--bg-canvas)',
      borderTop: '1px solid var(--border-default)',
      fontSize: 'var(--font-size-sm)',
      fontFamily: 'var(--font-ui)',
      color: 'var(--text-muted)',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Left side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Save status */}
        {save.text && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: save.color,
            transition: 'color var(--transition-normal)',
          }}>
            {save.icon}
            {save.text}
          </span>
        )}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Cursor position */}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>
          Ln {cursorPosition?.line || 1}, Col {cursorPosition?.column || 1}
        </span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '1px 8px',
          background: 'var(--bg-subtle)',
          borderRadius: 4,
        }}>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
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
