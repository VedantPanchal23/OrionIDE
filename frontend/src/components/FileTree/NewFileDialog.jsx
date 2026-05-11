/**
 * Orion IDE — NewFileDialog Component
 *
 * Creates new files with language auto-detection and file templates.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { getLanguageByFileName, getExecutableLanguages, getAllLanguages, DEFAULT_LANGUAGE } from '../../utils/languageMap';

import { X, FilePlus } from 'lucide-react';

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
            <FilePlus size={16} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9' }}>New File</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7d8590', cursor: 'pointer', padding: 4 }}>
            <X size={14} />
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
