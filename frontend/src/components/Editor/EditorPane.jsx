/**
 * Orion IDE — Editor Pane
 *
 * Main editor area: EditorTabs + Editor + StatusBar.
 * Welcome screen when no files are open.
 */

import React from 'react';
import { useEditor } from '../../context/EditorContext';
import EditorTabs from './EditorTabs';
import Breadcrumbs from './Breadcrumbs';
import Editor from './Editor';
import StatusBar from './StatusBar';

import { Code2 } from 'lucide-react';

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
        background: 'var(--bg-default)',
        color: 'var(--text-disabled)',
        fontFamily: 'var(--font-ui)',
        userSelect: 'none',
      }}>
        <div style={{ marginBottom: 24, opacity: 0.3 }}>
          <Code2 size={56} color="var(--border-default)" strokeWidth={1} />
        </div>
        <h2 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 500,
          color: 'var(--text-muted)',
          marginBottom: 8,
        }}>
          No files open
        </h2>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-disabled)', marginBottom: 32 }}>
          Open a file from the sidebar to start editing
        </p>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontSize: 'var(--font-size-md)',
          color: 'var(--text-disabled)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <kbd>Ctrl</kbd>
            <span>+</span>
            <kbd>S</kbd>
            <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>Save file</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <kbd>Ctrl</kbd>
            <span>+</span>
            <kbd>P</kbd>
            <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>Quick open</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <kbd>Ctrl</kbd>
            <span>+</span>
            <kbd>Shift</kbd>
            <span>+</span>
            <kbd>P</kbd>
            <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>Command palette</span>
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
      background: 'var(--bg-default)',
    }}>
      <EditorTabs />
      <Breadcrumbs />
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
