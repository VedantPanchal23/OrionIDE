/**
 * Orion IDE — Editor Pane
 *
 * Main editor area: EditorTabs + Editor + StatusBar.
 * Welcome screen when no files are open.
 */

import React, { useState } from 'react';
import { useEditor } from '../../context/EditorContext';
import EditorTabs from './EditorTabs';
import Breadcrumbs from './Breadcrumbs';
import Editor from './Editor';
import StatusBar from './StatusBar';

import { Code2, FilePlus, Terminal, Bot, Settings } from 'lucide-react';

const actionCardStyle = {
  background: 'var(--bg-canvas)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  transition: 'all var(--transition-normal)',
  boxShadow: 'var(--shadow-sm)',
};

const actionTitleStyle = {
  fontSize: 'var(--font-size-base)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 4,
};

const actionDescStyle = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--text-muted)',
};

const kbdContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const kbdStyle = {
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border-emphasis)',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
};

const applyCardHover = (e, isHover) => {
  e.currentTarget.style.background = isHover ? 'var(--bg-subtle)' : 'var(--bg-canvas)';
  e.currentTarget.style.borderColor = isHover ? 'var(--accent-blue)' : 'var(--border-default)';
  e.currentTarget.style.transform = isHover ? 'translateY(-2px)' : 'translateY(0)';
  e.currentTarget.style.boxShadow = isHover ? '0 8px 24px rgba(31, 111, 235, 0.12)' : 'var(--shadow-sm)';
};

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
        background: 'radial-gradient(circle at center, var(--bg-subtle) 0%, var(--bg-default) 100%)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-ui)',
        userSelect: 'none',
        padding: 40,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Glow Effects */}
        <div style={{
          position: 'absolute', top: '10%', left: '10%', width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(31, 111, 235, 0.03) 0%, transparent 70%)',
          zIndex: 0, pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '10%', width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(35, 134, 54, 0.02) 0%, transparent 70%)',
          zIndex: 0, pointerEvents: 'none',
        }} />

        <div style={{ zIndex: 1, textAlign: 'center', maxWidth: 640 }}>
          {/* Logo Icon */}
          <div style={{
            width: 68, height: 68, borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(31, 111, 235, 0.1) 0%, rgba(35, 134, 54, 0.08) 100%)',
            border: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          }}>
            <Code2 size={32} style={{
              color: 'var(--accent-blue-subtle)',
            }} strokeWidth={1.5} />
          </div>

          <h2 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.5px',
            marginBottom: 8,
          }}>
            Orion Cloud IDE
          </h2>
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--text-muted)',
            marginBottom: 40,
            maxWidth: 480,
            lineHeight: 1.5,
            marginRight: 'auto',
            marginLeft: 'auto',
          }}>
            Welcome to your cloud workspace. Open a file from the explorer sidebar, use search, or launch the terminal to begin.
          </p>

          {/* Premium Quick Actions Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
            textAlign: 'left', width: '100%', maxWidth: 540, margin: '0 auto',
          }}>
            {/* Action 1: Create File */}
            <div
              onClick={() => {
                const btn = document.querySelector('[title="New File"]');
                if (btn) btn.click();
              }}
              style={actionCardStyle}
              onMouseEnter={(e) => applyCardHover(e, true)}
              onMouseLeave={(e) => applyCardHover(e, false)}
            >
              <div>
                <div style={actionTitleStyle}>New File</div>
                <div style={actionDescStyle}>Create a code document</div>
              </div>
              <div style={kbdContainerStyle}>
                <kbd style={kbdStyle}>Ctrl</kbd>
                <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>+</span>
                <kbd style={kbdStyle}>P</kbd>
              </div>
            </div>

            {/* Action 2: Open Command Palette */}
            <div
              onClick={() => {
                const btn = document.querySelector('[data-run-trigger]');
                // Mimic palette open by dispatching Ctrl+Shift+P key event or calling custom click
                const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, shiftKey: true });
                window.dispatchEvent(event);
              }}
              style={actionCardStyle}
              onMouseEnter={(e) => applyCardHover(e, true)}
              onMouseLeave={(e) => applyCardHover(e, false)}
            >
              <div>
                <div style={actionTitleStyle}>Command Palette</div>
                <div style={actionDescStyle}>Run commands & options</div>
              </div>
              <div style={kbdContainerStyle}>
                <kbd style={kbdStyle}>Ctrl</kbd>
                <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>+</span>
                <kbd style={kbdStyle}>Shft</kbd>
                <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>+</span>
                <kbd style={kbdStyle}>P</kbd>
              </div>
            </div>

            {/* Action 3: New Terminal */}
            <div
              onClick={() => {
                // Trigger the '+' terminal panel icon click
                const btn = document.querySelector('[title="New Terminal"]');
                if (btn) btn.click();
              }}
              style={actionCardStyle}
              onMouseEnter={(e) => applyCardHover(e, true)}
              onMouseLeave={(e) => applyCardHover(e, false)}
            >
              <div>
                <div style={actionTitleStyle}>New Terminal</div>
                <div style={actionDescStyle}>Open interactive shell</div>
              </div>
              <div style={kbdContainerStyle}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Click +</span>
              </div>
            </div>

            {/* Action 4: Ask AI Agent */}
            <div
              onClick={() => {
                // Focus AI Panel tab
                const btn = document.querySelector('[title="AI Agent"]');
                if (btn) btn.click();
              }}
              style={actionCardStyle}
              onMouseEnter={(e) => applyCardHover(e, true)}
              onMouseLeave={(e) => applyCardHover(e, false)}
            >
              <div>
                <div style={actionTitleStyle}>AI Code Agent</div>
                <div style={actionDescStyle}>Build features using AI</div>
              </div>
              <div style={kbdContainerStyle}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Sidebar</span>
              </div>
            </div>
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
