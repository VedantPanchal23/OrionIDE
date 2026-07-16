import React from 'react';
import { useEditor } from '../../context/EditorContext';
import EditorTabs from './EditorTabs';
import Breadcrumbs from './Breadcrumbs';
import Editor from './Editor';

import { FileText, Search, Play, Terminal } from 'lucide-react';

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
        {/* VS Code Logo Watermark */}
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

        <div style={{ zIndex: 1, textAlign: 'left', minWidth: 400 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16, marginBottom: 8, fontSize: 13 }}>
             <div style={{ color: '#cccccc' }}>Show All Commands</div>
             <div style={{ color: '#858585' }}>Ctrl+Shift+P</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16, marginBottom: 8, fontSize: 13 }}>
             <div style={{ color: '#cccccc' }}>Go to File</div>
             <div style={{ color: '#858585' }}>Ctrl+P</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16, marginBottom: 8, fontSize: 13 }}>
             <div style={{ color: '#cccccc' }}>Find in Files</div>
             <div style={{ color: '#858585' }}>Ctrl+Shift+F</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16, marginBottom: 8, fontSize: 13 }}>
             <div style={{ color: '#cccccc' }}>Start Debugging</div>
             <div style={{ color: '#858585' }}>F5</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16, marginBottom: 8, fontSize: 13 }}>
             <div style={{ color: '#cccccc' }}>Toggle Terminal</div>
             <div style={{ color: '#858585' }}>Ctrl+`</div>
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
    </div>
  );
};

export default EditorPane;
