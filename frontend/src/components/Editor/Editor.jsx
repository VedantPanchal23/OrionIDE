/**
 * Orion IDE — Monaco Code Editor Component
 *
 * Core editor with syntax highlighting, Ctrl+S save, and debounced content updates.
 * Reads editor preferences (fontSize, tabSize, minimap, etc.) from ThemeContext.
 */

import React, { useRef, useCallback, useEffect } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useEditor } from '../../context/EditorContext';
import { useTheme } from '../../context/ThemeContext';
import { registerAllSnippets } from './snippets';

const DEBOUNCE_MS = 500;

/** Extensions that cannot be shown in Monaco — need special preview */
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp']);
const PDF_EXTS   = new Set(['.pdf']);

function getPreviewType(fileName) {
  if (!fileName) return null;
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (PDF_EXTS.has(ext))   return 'pdf';
  return null;
}

const Editor = ({ fileId, fileName, language, initialContent }) => {
  const { updateContent, saveFile, setCursorPosition, registerReveal } = useEditor();
  const { editorFontSize, editorFontFamily, tabSize, wordWrap, minimap, lineNumbers, theme } = useTheme();
  const editorRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Determine Monaco theme name from ThemeContext
  const monacoTheme = theme === 'light' ? 'orion-light' : 'orion-dark';

  // Detect binary/image files that can't be shown in Monaco
  const previewType = getPreviewType(fileName);

  // Image/PDF preview — don't render Monaco for these
  if (previewType === 'image') {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-canvas)', gap: 16, padding: 24,
        fontFamily: 'var(--font-ui)',
      }}>
        <div style={{
          fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)',
          padding: '4px 10px', background: 'var(--bg-emphasis)',
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)',
          fontFamily: 'var(--font-mono)',
        }}>
          {fileName}
        </div>
        <div style={{
          fontSize: 'var(--font-size-sm)', color: 'var(--text-disabled)', marginTop: -8,
        }}>
          Binary files cannot be displayed in the editor.
        </div>
      </div>
    );
  }

  if (previewType === 'pdf') {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-canvas)', fontFamily: 'var(--font-ui)',
        color: 'var(--text-disabled)', fontSize: 'var(--font-size-sm)',
      }}>
        PDF preview is not supported in the browser editor.
      </div>
    );
  }

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.focus();

    // Register code snippets for all 18 languages
    registerAllSnippets(monaco);

    // Register Ctrl+S / Cmd+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile(fileId);
    });

    // Register Ctrl+Shift+I — Format Document
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI,
      () => { editor.getAction('editor.action.formatDocument')?.run(); }
    );

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({ line: e.position.lineNumber, column: e.position.column });
    });

    // Register reveal callback so SearchPanel / other callers can jump to a line
    const unregister = registerReveal(fileId, (lineNumber) => {
      editor.revealLineInCenter(lineNumber);
      editor.setPosition({ lineNumber, column: 1 });
      editor.focus();
    });

    return unregister;
  };

  // Update editor options when preferences change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize: editorFontSize,
        fontFamily: editorFontFamily,
        tabSize,
        wordWrap,
        minimap: { enabled: minimap, scale: 1 },
        lineNumbers,
      });
    }
  }, [editorFontSize, editorFontFamily, tabSize, wordWrap, minimap, lineNumbers]);

  // Sync Monaco theme when ThemeContext changes
  useEffect(() => {
    if (window.__monaco_instance) {
      window.__monaco_instance.editor.setTheme(monacoTheme);
    }
  }, [monacoTheme]);

  // Debounced onChange → write buffer
  const handleChange = useCallback((value) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      updateContent(fileId, value || '');
    }, DEBOUNCE_MS);
  }, [fileId, updateContent]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MonacoEditor
        height="100%"
        language={language || 'plaintext'}
        theme={monacoTheme}
        value={initialContent || ''}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        beforeMount={(monaco) => {
          // Store monaco instance globally for theme switching
          window.__monaco_instance = monaco;

          // Define Orion Dark theme
          monaco.editor.defineTheme('orion-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: 'comment',  foreground: '6A737D', fontStyle: 'italic' },
              { token: 'keyword',  foreground: 'C678DD' },
              { token: 'string',   foreground: '98C379' },
              { token: 'number',   foreground: 'D19A66' },
              { token: 'type',     foreground: 'E5C07B' },
            ],
            colors: {
              'editor.background':                    '#0d1117',
              'editor.foreground':                    '#e6edf3',
              'editor.lineHighlightBackground':       '#161b22',
              'editor.selectionBackground':           '#264f78',
              'editorCursor.foreground':              '#58a6ff',
              'editorLineNumber.foreground':          '#484f58',
              'editorLineNumber.activeForeground':    '#e6edf3',
              'editor.inactiveSelectionBackground':   '#1c3050',
              'editorIndentGuide.background1':        '#21262d',
              'editorIndentGuide.activeBackground1':  '#30363d',
            },
          });

          // Define Orion Light theme
          monaco.editor.defineTheme('orion-light', {
            base: 'vs',
            inherit: true,
            rules: [
              { token: 'comment',  foreground: '6A737D', fontStyle: 'italic' },
              { token: 'keyword',  foreground: '8250df' },
              { token: 'string',   foreground: '0a3069' },
              { token: 'number',   foreground: '0550ae' },
              { token: 'type',     foreground: '953800' },
            ],
            colors: {
              'editor.background':                    '#f6f8fa',
              'editor.foreground':                    '#1f2328',
              'editor.lineHighlightBackground':       '#eef0f3',
              'editor.selectionBackground':           '#add6ff',
              'editorCursor.foreground':              '#0969da',
              'editorLineNumber.foreground':          '#8c959f',
              'editorLineNumber.activeForeground':    '#1f2328',
              'editor.inactiveSelectionBackground':   '#c8d8ea',
              'editorIndentGuide.background1':        '#d0d7de',
              'editorIndentGuide.activeBackground1':  '#8c959f',
            },
          });
        }}
        options={{
          fontSize: editorFontSize,
          fontFamily: editorFontFamily,
          fontLigatures: true,
          tabSize,
          wordWrap,
          minimap: { enabled: minimap, scale: 1 },
          lineNumbers,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: 'all',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          suggest: { showMethods: true, showFunctions: true },
          quickSuggestions: true,
        }}
        loading={
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-default)', color: 'var(--text-disabled)', fontFamily: 'var(--font-ui)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8, animation: 'pulse 1.5s infinite' }}>⚡</div>
              <div>Loading editor...</div>
            </div>
          </div>
        }
      />
    </div>
  );
};

export default Editor;
