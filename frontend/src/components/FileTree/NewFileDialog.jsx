/**
 * Orion IDE — NewFileDialog Component
 *
 * Creates new files with language auto-detection and file templates.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { getLanguageByFileName, getExecutableLanguages, getAllLanguages, DEFAULT_LANGUAGE } from '../../utils/languageMap';

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
  </svg>
);

const FileAddIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v8.086A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25V1.75z" />
    <path d="M8 6.5a.75.75 0 01.75.75v1h1a.75.75 0 010 1.5h-1v1a.75.75 0 01-1.5 0v-1h-1a.75.75 0 010-1.5h1v-1A.75.75 0 018 6.5z" />
  </svg>
);

const NewFileDialog = ({ isOpen, onClose, onCreate }) => {
  const [fileName, setFileName] = useState('');
  const [selectedLanguageId, setSelectedLanguageId] = useState('');

  const detectedLang = useMemo(() => {
    if (!fileName.includes('.')) return DEFAULT_LANGUAGE;
    return getLanguageByFileName(fileName);
  }, [fileName]);

  const allLanguages = useMemo(() => getAllLanguages(), []);

  const handleCreate = useCallback(() => {
    if (!fileName.trim()) return;
    const lang = detectedLang;
    onCreate(fileName.trim(), lang);
    setFileName('');
    setSelectedLanguageId('');
    onClose();
  }, [fileName, detectedLang, onCreate, onClose]);

  const handleLanguageSelect = useCallback((langId) => {
    setSelectedLanguageId(langId);
    const lang = allLanguages.find((l) => l.id === langId);
    if (lang && (!fileName || !fileName.includes('.'))) {
      const ext = lang.extensions[0] || '';
      setFileName(`main${ext}`);
    }
  }, [fileName, allLanguages]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 1000, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Dialog */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 420, background: '#161b22', border: '1px solid #30363d', borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)', zIndex: 1001, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid #21262d',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileAddIcon />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9' }}>New File</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7d8590', cursor: 'pointer', padding: 4 }}>
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px' }}>
          {/* File name input */}
          <label style={{ fontSize: 12, fontWeight: 600, color: '#7d8590', display: 'block', marginBottom: 6 }}>
            File Name
          </label>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="e.g. main.py, index.js, App.tsx"
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', paddingRight: 100,
                background: '#0d1117', border: '1px solid #30363d', borderRadius: 8,
                color: '#c9d1d9', fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#58a6ff'; }}
              onBlur={(e) => { e.target.style.borderColor = '#30363d'; }}
            />
            {/* Language badge */}
            {fileName.includes('.') && (
              <span style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6,
                background: '#21262d', fontSize: 11, color: '#c9d1d9',
                border: `1px solid ${detectedLang.color}44`,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: detectedLang.color }} />
                {detectedLang.displayName}
              </span>
            )}
          </div>

          {/* Language selector */}
          <label style={{ fontSize: 12, fontWeight: 600, color: '#7d8590', display: 'block', marginBottom: 6 }}>
            Or select a language
          </label>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
            maxHeight: 180, overflow: 'auto', padding: 2,
          }}>
            {allLanguages.filter((l) => l.pistonLanguage).map((lang) => (
              <button
                key={lang.id}
                onClick={() => handleLanguageSelect(lang.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 8px', borderRadius: 6,
                  background: selectedLanguageId === lang.id ? '#21262d' : 'transparent',
                  border: selectedLanguageId === lang.id ? `1px solid ${lang.color}66` : '1px solid transparent',
                  color: '#c9d1d9', cursor: 'pointer', fontSize: 11,
                  fontFamily: "'Inter', sans-serif",
                  transition: 'all 0.1s',
                }}
                onMouseEnter={(e) => { if (selectedLanguageId !== lang.id) e.currentTarget.style.background = '#161b22'; }}
                onMouseLeave={(e) => { if (selectedLanguageId !== lang.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: lang.color, flexShrink: 0 }} />
                {lang.displayName}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid #21262d',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', background: '#21262d', color: '#c9d1d9',
            border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif",
          }}>Cancel</button>
          <button onClick={handleCreate} disabled={!fileName.trim()} style={{
            padding: '8px 16px',
            background: fileName.trim() ? '#238636' : '#21262d',
            color: fileName.trim() ? '#fff' : '#484f58',
            border: 'none', borderRadius: 6,
            cursor: fileName.trim() ? 'pointer' : 'not-allowed',
            fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif",
          }}>Create File</button>
        </div>
      </div>
    </>
  );
};

export default NewFileDialog;
