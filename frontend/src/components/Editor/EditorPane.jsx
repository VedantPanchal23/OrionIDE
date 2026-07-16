import React from 'react';
import { useEditor } from '../../context/EditorContext';
import EditorTabs from './EditorTabs';
import Breadcrumbs from './Breadcrumbs';
import Editor from './Editor';
import StatusBar from './StatusBar';

import { FileText, Search, Play, Terminal } from 'lucide-react';

const SHORTCUTS = [
  { action: 'Show All Commands', keys: 'Ctrl+Shift+P' },
  { action: 'Go to File',        keys: 'Ctrl+P' },
  { action: 'Find in Files',     keys: 'Ctrl+Shift+F' },
  { action: 'Start Debugging',   keys: 'F5' },
  { action: 'Toggle Terminal',   keys: 'Ctrl+`' },
  { action: 'Toggle Sidebar',    keys: 'Ctrl+B' },
];

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
        background: 'var(--bg-canvas)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-ui)',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Orion IDE Logo Watermark */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.03,
          pointerEvents: 'none',
        }}>
          <svg viewBox="0 0 1024 1024" width="400" height="400" xmlns="http://www.w3.org/2000/svg">
            <path d="M725.3 125.7L298.7 512l426.6 386.3c15.1 13.7 38.7 2.9 38.7-17.6V143.3c0-20.5-23.6-31.3-38.7-17.6z" fill="#007acc"/>
            <path d="M304 466.7l-94.2-85.3c-14.7-13.3-37.5-3.3-37.5 16.5v228.2c0 19.8 22.8 29.8 37.5 16.5L304 557.3V466.7z" fill="#22a559"/>
            <path d="M298.7 512l-133 120.5-88-79.7c-12-10.9-12-29.6 0-40.5l88-79.7 133 120.5z" fill="#0065a9"/>
          </svg>
        </div>

        <div style={{ zIndex: 1, textAlign: 'left' }}>
          {/* App title */}
          <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-green))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                Orion IDE
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                Open a file to start editing
              </div>
            </div>
          </div>

          {/* Keyboard shortcuts table */}
          <div style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            minWidth: 360,
          }}>
            <div style={{
              padding: '8px 14px', borderBottom: '1px solid var(--border-default)',
              fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              Keyboard Shortcuts
            </div>
            {SHORTCUTS.map(({ action, keys }) => (
              <div key={action} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 14px',
                borderBottom: '1px solid var(--border-default)',
                fontSize: 12,
              }}>
                <span style={{ color: 'var(--text-primary)' }}>{action}</span>
                <kbd style={{
                  background: 'var(--bg-emphasis)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-emphasis)', borderRadius: 4,
                  padding: '2px 7px', fontSize: 11, fontFamily: 'var(--font-mono)',
                }}>
                  {keys}
                </kbd>
              </div>
            ))}
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
      background: 'var(--bg-canvas)',
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
