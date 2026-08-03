/**
 * Orion IDE — Monaco host
 *
 * Uses a *local* monaco-editor bundle (never the CDN) wired through
 * @monaco-editor/react's loader.config({ monaco }). Web workers are wired
 * up manually since there is no vite monaco plugin in this project.
 *
 * The host element fills its parent absolutely — the parent
 * (`.editor-surface`) must be `position:absolute; inset:0` inside a
 * `position:relative; flex:1; min-height:0` container (see EditorPane).
 */

import { useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';

if (typeof window !== 'undefined' && !window.__orionMonacoReady) {
  window.__orionMonacoReady = true;

  self.MonacoEnvironment = {
    getWorker(_workerId, label) {
      if (label === 'json') return new JsonWorker();
      if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
      if (label === 'typescript' || label === 'javascript') return new TsWorker();
      return new EditorWorker();
    },
  };

  loader.config({ monaco });

  const base = {
    'editor.background': '#0a0b0f',
    'editor.foreground': '#e8e6e1',
    'editorLineNumber.foreground': '#3d3f4a',
    'editorLineNumber.activeForeground': '#9b9aa3',
    'editor.selectionBackground': '#343a4d',
    'editor.inactiveSelectionBackground': '#232735',
    'editor.lineHighlightBackground': '#0e1016',
    'editorCursor.foreground': '#d4a84b',
    'editorWhitespace.foreground': '#1f2230',
    'editorIndentGuide.background1': '#1a1d28',
    'editorIndentGuide.activeBackground1': '#343a4d',
    'editor.findMatchBackground': 'rgba(212, 168, 75, 0.35)',
    'editor.findMatchHighlightBackground': 'rgba(212, 168, 75, 0.16)',
    'scrollbarSlider.background': 'rgba(52, 58, 77, 0.55)',
    'scrollbarSlider.hoverBackground': 'rgba(109, 108, 118, 0.6)',
    'minimap.background': '#0a0b0f',
  };
  monaco.editor.defineTheme('orion-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6d6c76', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'd4a84b' },
      { token: 'string', foreground: '9fc98f' },
      { token: 'number', foreground: 'c99b6e' },
    ],
    colors: base,
  });
  monaco.editor.defineTheme('orion-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '848894', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'a87a20' },
    ],
    colors: {
      'editor.background': '#fafbfc',
      'editor.foreground': '#17181c',
      'editorLineNumber.foreground': '#c3c7d1',
      'editorLineNumber.activeForeground': '#555863',
      'editorCursor.foreground': '#a87a20',
    },
  });
}

export default function MonacoEditor({
  file, fontSize, tabSize, wordWrap, minimap, lineNumbers, themeMode,
  onChange, onCursorChange, onSaveShortcut, pendingRevealLine, onConsumeReveal, onRegisterReveal,
}) {
  const editorRef = useRef(null);

  const handleMount = (editorInstance) => {
    editorRef.current = editorInstance;

    const pos = editorInstance.getPosition();
    if (pos) onCursorChange?.({ line: pos.lineNumber, column: pos.column });

    editorInstance.onDidChangeCursorPosition((e) => {
      onCursorChange?.({ line: e.position.lineNumber, column: e.position.column });
    });

    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveShortcut?.();
    });

    const revealFn = (line) => {
      editorInstance.revealLineInCenter(line);
      editorInstance.setPosition({ lineNumber: line, column: 1 });
      editorInstance.focus();
    };
    onRegisterReveal?.(revealFn);

    if (pendingRevealLine != null) {
      revealFn(pendingRevealLine);
      onConsumeReveal?.();
    }

    editorInstance.focus();
  };

  return (
    <Editor
      path={file.id}
      defaultLanguage={file.language}
      defaultValue={file.content}
      theme={themeMode === 'light' ? 'orion-light' : 'orion-dark'}
      onMount={handleMount}
      onChange={(value) => onChange?.(value ?? '')}
      options={{
        fontSize,
        tabSize,
        wordWrap: wordWrap ? 'on' : 'off',
        minimap: { enabled: minimap },
        lineNumbers: lineNumbers ? 'on' : 'off',
        fontFamily: "'IBM Plex Mono', 'Cascadia Code', Consolas, monospace",
        fontLigatures: true,
        automaticLayout: true,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        padding: { top: 14 },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'all',
        bracketPairColorization: { enabled: true },
      }}
      loading={<div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Loading editor…</div>}
    />
  );
}
