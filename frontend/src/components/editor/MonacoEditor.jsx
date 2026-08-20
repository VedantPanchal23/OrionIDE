import { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as problemsApi from '../../services/problemsService';
import { MONO_FONT, monacoThemeDef } from '../../theme/workbench';
import { bootstrapMonaco, SUGGEST_EDITOR_OPTIONS } from '../../editor/setupMonaco';
import {
  initMonacoLsp, lspDidOpen, lspDidChange, lspDidClose,
  lspFormatDocument, lspRename, lspGoToDefinition, lspFindReferences, refreshOutline,
} from '../../editor/lsp/monacoLsp';
import { useAuth } from '../../context/AuthContext';
import InlineEditBar from './InlineEditBar';
import { bindMonacoCollab } from '../../editor/collab/yjsMonaco';
import { scanSecrets, toMonacoMarkers } from '../../lib/secretPatterns';

function defineThemes(monaco) {
  monaco.editor.defineTheme('orion-dark', monacoThemeDef('dark'));
  monaco.editor.defineTheme('orion-light', monacoThemeDef('light'));
}

function getBreakpoints(fileId) {
  if (!window.__orionBreakpoints) window.__orionBreakpoints = {};
  if (!window.__orionBreakpoints[fileId]) window.__orionBreakpoints[fileId] = [];
  return window.__orionBreakpoints[fileId];
}

function setBreakpoints(fileId, lines) {
  if (!window.__orionBreakpoints) window.__orionBreakpoints = {};
  window.__orionBreakpoints[fileId] = [...new Set(lines)].sort((a, b) => a - b);
}

export default function MonacoEditor({
  file, fontSize, tabSize, wordWrap, minimap, lineNumbers, themeMode, projectId,
  stickyScroll = true, formatOnSave = false,
  onChange, onCursorChange, onSaveShortcut, onRegisterLiveContent,
  revealRequest, onRevealHandled, onFocus, modelPath, pauseLine, relativePath,
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const pushTimer = useRef(null);
  const changeTimer = useRef(null);
  const bpDecorations = useRef([]);
  const pauseDecorations = useRef([]);
  const collabRef = useRef(null);
  const formatOnSaveRef = useRef(formatOnSave);
  formatOnSaveRef.current = formatOnSave;
  /** Tracks last content we intentionally applied from props (open / external reload). */
  const appliedContentRef = useRef(file.content);
  const fileContentRef = useRef(file.content);
  fileContentRef.current = file.content;
  const { user } = useAuth();
  const userId = user?.id || user?.userId || user?.sub || '';
  const [inlineOpen, setInlineOpen] = useState(false);
  const [editorReady, setEditorReady] = useState(0);
  const openInlineEdit = useCallback(() => setInlineOpen(true), []);
  const closeInlineEdit = useCallback(() => {
    setInlineOpen(false);
    requestAnimationFrame(() => editorRef.current?.focus?.());
  }, []);

  useEffect(() => {
    window.__orionOpenInlineEdit = openInlineEdit;
    return () => {
      if (window.__orionOpenInlineEdit === openInlineEdit) {
        delete window.__orionOpenInlineEdit;
      }
    };
  }, [openInlineEdit]);

  const applyBreakpointDecorations = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const lines = getBreakpoints(file.id);
    bpDecorations.current = editor.deltaDecorations(
      bpDecorations.current,
      lines.map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'orion-breakpoint',
          glyphMarginHoverMessage: { value: 'Breakpoint' },
        },
      })),
    );
  };

  useEffect(() => () => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    try { collabRef.current?.dispose?.(); } catch { /* ignore */ }
    collabRef.current = null;
  }, []);

  // Live collab when entitlements allow (room = project:file)
  useEffect(() => {
    if (!editorReady) return undefined;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !projectId || !file?.id) return undefined;
    const collabOn = Boolean(
      user?.entitlements?.features?.collab
      ?? user?.entitlements?.limits?.collabEnabled,
    );
    if (!collabOn) return undefined;

    try { collabRef.current?.dispose?.(); } catch { /* ignore */ }
    collabRef.current = bindMonacoCollab({
      editor,
      roomId: `${projectId}:${file.id}`,
      userName: user?.name || user?.email || 'Orion',
      enabled: true,
    });
    return () => {
      try { collabRef.current?.dispose?.(); } catch { /* ignore */ }
      collabRef.current = null;
    };
  }, [
    editorReady,
    projectId,
    file.id,
    user?.id,
    user?.entitlements?.features?.collab,
    user?.entitlements?.limits?.collabEnabled,
    user?.name,
    user?.email,
  ]);

  // Stable live-content registration — must not depend on file.content or an
  // inline callback wrapper, or Run/Save can read the previous buffer.
  useEffect(() => {
    if (!onRegisterLiveContent || !file?.id) return undefined;
    return onRegisterLiveContent(file.id, () => {
      const live = editorRef.current?.getValue?.();
      return typeof live === 'string' ? live : (fileContentRef.current ?? '');
    });
  }, [onRegisterLiveContent, file.id]);

  useEffect(() => {
    applyBreakpointDecorations();
  }, [file.id]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({
      fontSize,
      tabSize,
      wordWrap: wordWrap ? 'on' : 'off',
      minimap: { enabled: minimap },
      lineNumbers: lineNumbers ? 'on' : 'off',
      stickyScroll: { enabled: stickyScroll },
      lineHeight: Math.round(fontSize * 1.55),
    });
  }, [fontSize, tabSize, wordWrap, minimap, lineNumbers, stickyScroll]);

  /**
   * Uncontrolled editor: do NOT bind `value={file.content}` (that rewrites the
   * model on every React update and causes cursor jumps / fake undo).
   * Only push props → model for external reloads while the editor is not focused.
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = typeof file.content === 'string' ? file.content : '';
    if (next === appliedContentRef.current) return;
    const live = editor.getValue();
    if (next === live) {
      appliedContentRef.current = next;
      return;
    }
    // While the user is typing, React `content` mirrors onChange — ignore.
    // Only apply when the buffer is not focused (agent / reload / open).
    if (editor.hasTextFocus?.()) return;
    const pos = editor.getPosition();
    editor.setValue(next);
    appliedContentRef.current = next;
    if (pos) {
      try { editor.setPosition(pos); } catch { /* ignore */ }
    }
  }, [file.content, file.id]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    if (pauseLine?.fileId === file.id && pauseLine.line) {
      const line = pauseLine.line;
      pauseDecorations.current = editor.deltaDecorations(pauseDecorations.current, [{
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'orion-debug-line',
          glyphMarginClassName: 'orion-debug-glyph',
        },
      }]);
      editor.revealLineInCenter(line);
    } else {
      pauseDecorations.current = editor.deltaDecorations(pauseDecorations.current, []);
    }
  }, [pauseLine, file.id]);

  useEffect(() => {
    if (!revealRequest || revealRequest.fileId !== file.id) return;
    const editor = editorRef.current;
    if (!editor) return;
    const line = Math.max(1, revealRequest.line || 1);
    const column = Math.max(1, revealRequest.column || 1);
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column });
    editor.focus();
    onRevealHandled?.();
  }, [revealRequest, file.id, onRevealHandled]);

  return (
    <div className="monaco-host">
      <Editor
      height="100%"
      width="100%"
      path={modelPath || file.id}
      language={file.language}
      defaultValue={file.content ?? ''}
      theme={themeMode === 'light' ? 'orion-light' : 'orion-dark'}
      loading={<div className="editor-loading">Loading editor…</div>}
      keepCurrentModel
      beforeMount={(monaco) => {
        defineThemes(monaco);
        bootstrapMonaco(monaco);
        loader.config({ monaco });
      }}
      onMount={(editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        appliedContentRef.current = editor.getValue();
        setEditorReady((n) => n + 1);
        defineThemes(monaco);
        bootstrapMonaco(monaco);
        initMonacoLsp(monaco, { projectId, userId });
        monaco.editor.setTheme(themeMode === 'light' ? 'orion-light' : 'orion-dark');
        // Force suggest options on this instance (in case defaults lagged).
        editor.updateOptions(SUGGEST_EDITOR_OPTIONS);
        onRegisterLiveContent?.(file.id, () => editor.getValue());
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
          if (formatOnSaveRef.current) {
            try { await lspFormatDocument(editor); } catch { /* ignore */ }
          }
          onSaveShortcut?.();
        });
        // Ctrl+Space always opens suggestions
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
          editor.trigger('orion', 'editor.action.triggerSuggest', {});
        });
        // Ctrl/Cmd+K — inline AI edit (Cursor-style)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
          window.__orionActiveEditor = editor;
          setInlineOpen(true);
        });
        // LSP power-user shortcuts
        editor.addCommand(monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
          lspFormatDocument(editor);
        });
        editor.addCommand(monaco.KeyCode.F2, () => { lspRename(editor); });
        editor.addCommand(monaco.KeyCode.F12, () => { lspGoToDefinition(editor); });
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F12, () => { lspFindReferences(editor); });
        editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.F12, () => {
          editor.trigger('orion', 'editor.action.peekDefinition', {});
        });

        editor.onDidChangeCursorPosition((e) => {
          onCursorChange?.({ line: e.position.lineNumber, column: e.position.column });
        });
        editor.onDidFocusEditorText?.(() => {
          window.__orionActiveEditor = editor;
          onFocus?.();
        });
        editor.onDidFocusEditorWidget?.(() => {
          window.__orionActiveEditor = editor;
          onFocus?.();
        });
        window.__orionActiveEditor = editor;

        const model = editor.getModel();
        if (model) {
          lspDidOpen(model, file.language, model.getValue(), file.id).then(() => {
            refreshOutline(editor);
          });
        }

        editor.onMouseDown((e) => {
          if (e.target?.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
            && e.target?.type !== monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
            return;
          }
          const line = e.target.position?.lineNumber;
          if (!line) return;
          const current = getBreakpoints(file.id);
          const next = current.includes(line)
            ? current.filter((l) => l !== line)
            : [...current, line];
          setBreakpoints(file.id, next);
          applyBreakpointDecorations();
        });

        const syncMarkers = () => {
          const m = editor.getModel();
          if (!m) return;
          // Client secret scan → Monaco markers (source: orion-secrets)
          try {
            const hits = scanSecrets(m.getValue());
            monaco.editor.setModelMarkers(m, 'orion-secrets', toMonacoMarkers(hits, monaco));
          } catch { /* ignore */ }
          const markers = monaco.editor.getModelMarkers({ resource: m.uri });
          if (!window.__orionMarkers) window.__orionMarkers = {};
          window.__orionMarkers[file.id] = markers;
          if (pushTimer.current) clearTimeout(pushTimer.current);
          pushTimer.current = setTimeout(() => {
            problemsApi.setFileProblems(file.id, {
              projectId,
              filePath: relativePath || file.name,
              diagnostics: markers.map((mk) => ({
                message: mk.message,
                severity: mk.severity,
                startLineNumber: mk.startLineNumber,
                startColumn: mk.startColumn,
                endLineNumber: mk.endLineNumber,
                endColumn: mk.endColumn,
                source: mk.source || 'monaco',
              })),
            }).catch(() => {});
          }, 800);
        };

        const disposable = monaco.editor.onDidChangeMarkers((uris) => {
          const m = editor.getModel();
          if (!m) return;
          if (uris.some((u) => u.toString() === m.uri.toString())) syncMarkers();
        });
        editor.onDidDispose(() => {
          disposable.dispose();
          const m = editor.getModel();
          if (m) lspDidClose(m, file.language);
        });

        requestAnimationFrame(() => {
          try { editor.layout(); } catch { /* ignore */ }
          applyBreakpointDecorations();
          if (revealRequest?.fileId === file.id) {
            const line = Math.max(1, revealRequest.line || 1);
            editor.revealLineInCenter(line);
            editor.setPosition({ lineNumber: line, column: revealRequest.column || 1 });
            onRevealHandled?.();
          } else {
            editor.focus();
          }
          syncMarkers();
        });
      }}
      onChange={(value) => {
        const next = value ?? '';
        appliedContentRef.current = next;
        onChange?.(next);
        const model = editorRef.current?.getModel?.();
        if (model) {
          if (changeTimer.current) clearTimeout(changeTimer.current);
          changeTimer.current = setTimeout(() => {
            lspDidChange(model, file.language);
            refreshOutline(editorRef.current);
            // Refresh secret markers while typing (debounced)
            try {
              const monaco = monacoRef.current;
              if (monaco) {
                const hits = scanSecrets(model.getValue());
                monaco.editor.setModelMarkers(model, 'orion-secrets', toMonacoMarkers(hits, monaco));
              }
            } catch { /* ignore */ }
          }, 350);
        }
      }}
      options={{
        fontSize,
        tabSize,
        wordWrap: wordWrap ? 'on' : 'off',
        minimap: { enabled: minimap },
        lineNumbers: lineNumbers ? 'on' : 'off',
        glyphMargin: true,
        fontFamily: MONO_FONT,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        padding: { top: 18, bottom: 18 },
        lineHeight: Math.round(fontSize * 1.55),
        letterSpacing: 0.2,
        renderLineHighlight: 'all',
        overviewRulerBorder: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        bracketPairColorization: { enabled: true },
        renderWhitespace: 'selection',
        stickyScroll: { enabled: stickyScroll },
        fontLigatures: true,
        ...SUGGEST_EDITOR_OPTIONS,
      }}
      />
      <InlineEditBar
        open={inlineOpen}
        onClose={closeInlineEdit}
        editor={editorRef.current}
        monaco={monacoRef.current}
        language={file.language}
        filePath={relativePath || file.name}
        projectFolderId={projectId}
      />
    </div>
  );
}
