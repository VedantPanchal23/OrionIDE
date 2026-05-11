/**
 * Orion IDE — Editor Pane
 *
 * Main editor area: EditorTabs + Editor + StatusBar.
 * Welcome screen when no files are open.
 */

import React from 'react';
import { useEditor } from '../../context/EditorContext';
import EditorTabs from './EditorTabs';
import Editor from './Editor';
import StatusBar from './StatusBar';

import { Code2 } from 'lucide-react';

const KbdKey = ({ children }) => (
  <kbd style={{
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    color: '#7d8590',
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 4,
    boxShadow: '0 1px 0 #21262d',
    lineHeight: '18px',
  }}>
    {children}
  </kbd>
);

const EditorPane = () => {
  const { openFiles, activeFile } = useEditor();

  if (openFiles.length === 0) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        color: '#484f58',
        fontFamily: "'Inter', sans-serif",
        userSelect: 'none',
      }}>
        <div style={{ marginBottom: 24, opacity: 0.4 }}>
          <Code2 size={56} color="#30363d" strokeWidth={1} />
        </div>
        <h2 style={{
          fontSize: 20,
          fontWeight: 500,
          color: '#7d8590',
          marginBottom: 8,
        }}>
          No files open
        </h2>
        <p style={{ fontSize: 14, color: '#484f58', marginBottom: 32 }}>
          Open a file from the sidebar to start editing
        </p>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontSize: 13,
          color: '#484f58',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <KbdKey>Ctrl</KbdKey>
            <span>+</span>
            <KbdKey>S</KbdKey>
            <span style={{ marginLeft: 8, color: '#7d8590' }}>Save file</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <KbdKey>Ctrl</KbdKey>
            <span>+</span>
            <KbdKey>P</KbdKey>
            <span style={{ marginLeft: 8, color: '#7d8590' }}>Quick open</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <KbdKey>Ctrl</KbdKey>
            <span>+</span>
            <KbdKey>Shift</KbdKey>
            <span>+</span>
            <KbdKey>P</KbdKey>
            <span style={{ marginLeft: 8, color: '#7d8590' }}>Command palette</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0d1117',
    }}>
      <EditorTabs />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeFile && (
          <Editor
            key={activeFile.fileId}
            fileId={activeFile.fileId}
            fileName={activeFile.fileName}
            language={activeFile.language}
            initialContent={activeFile.content || ''}
          />
        )}
      </div>
      <StatusBar />
    </div>
  );
};

export default EditorPane;
