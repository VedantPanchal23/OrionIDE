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

const Editor = ({ fileId, fileName, language, initialContent }) => {
  const { updateContent, saveFile, setCursorPosition, registerReveal } = useEditor();
  const { editorFontSize, editorFontFamily, tabSize, wordWrap, minimap, lineNumbers } = useTheme();
  const editorRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.focus();

    // Register code snippets for all 18 languages
    registerAllSnippets(monaco);

    // Register Ctrl+S / Cmd+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile(fileId);
    });

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
        theme="orion-dark"
        value={initialContent || ''}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        beforeMount={(monaco) => {
          // Define Orion Dark theme
          monaco.editor.defineTheme('orion-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: 'comment', foreground: '6A737D', fontStyle: 'italic' },
              { token: 'keyword', foreground: 'C678DD' },
              { token: 'string', foreground: '98C379' },
              { token: 'number', foreground: 'D19A66' },
              { token: 'type', foreground: 'E5C07B' },
            ],
            colors: {
              'editor.background': '#0d1117',
              'editor.foreground': '#e6edf3',
              'editor.lineHighlightBackground': '#161b22',
              'editor.selectionBackground': '#264f78',
              'editorCursor.foreground': '#58a6ff',
              'editorLineNumber.foreground': '#484f58',
              'editorLineNumber.activeForeground': '#e6edf3',
              'editor.inactiveSelectionBackground': '#1c3050',
              'editorIndentGuide.background': '#21262d',
              'editorIndentGuide.activeBackground': '#30363d',
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
