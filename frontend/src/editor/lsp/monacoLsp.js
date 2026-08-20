/**
 * Monaco ↔ Orion LSP bridge.
 * Completion, hover, definition, references, rename, signature help,
 * document symbols (outline), formatting, code actions, diagnostics.
 */

import { LspJsonRpcClient } from './LspJsonRpcClient';
import { getAccessToken } from '../../services/api';
import { syncWithDrive } from '../../lib/terminalSession';

const sessions = new Map(); // language -> session entry
const uriToFileId = new Map();
const statusListeners = new Set();
let monacoRef = null;
let projectIdRef = null;
let userIdRef = null;
let openFileHandler = null;
let openerRegistered = false;
let outlineListeners = new Set();
let lastWorkspacePullAt = 0;
let lastWorkspacePullProject = null;
/** @type {Promise<void> | null} */
let workspacePullInFlight = null;

async function ensureWorkspaceFilesOnDisk({ force = false } = {}) {
  if (!projectIdRef) return;
  const now = Date.now();
  if (
    !force
    && lastWorkspacePullProject === projectIdRef
    && now - lastWorkspacePullAt < 45_000
  ) {
    if (workspacePullInFlight) await workspacePullInFlight;
    return;
  }

  if (workspacePullInFlight) {
    await workspacePullInFlight;
    if (!force && lastWorkspacePullProject === projectIdRef && Date.now() - lastWorkspacePullAt < 45_000) {
      return;
    }
  }

  const projectId = projectIdRef;
  workspacePullInFlight = (async () => {
    try {
      await syncWithDrive('pull');
      lastWorkspacePullAt = Date.now();
      lastWorkspacePullProject = projectId;
    } catch {
      /* terminal may not be ready — LSP still works for open docs */
    } finally {
      workspacePullInFlight = null;
    }
  })();
  await workspacePullInFlight;
}

export function subscribeOutline(listener) {
  outlineListeners.add(listener);
  return () => outlineListeners.delete(listener);
}

export function subscribeLspStatus(listener) {
  statusListeners.add(listener);
  try { listener(getLspStatusSummary()); } catch { /* ignore */ }
  return () => statusListeners.delete(listener);
}

function emitStatus() {
  const snap = getLspStatusSummary();
  statusListeners.forEach((l) => { try { l(snap); } catch { /* ignore */ } });
}

export function getLspStatusSummary() {
  const byLang = {};
  sessions.forEach((entry, lang) => {
    byLang[lang] = entry.client?.status || { status: entry.error ? 'error' : 'idle' };
  });
  const primary = [...sessions.values()].find((e) => e.client?.ready)
    || [...sessions.values()][0];
  return {
    byLanguage: byLang,
    status: primary?.client?.status?.status || (primary?.error ? 'error' : 'idle'),
    language: primary?.language || null,
    message: primary?.client?.status?.message || primary?.error || null,
  };
}

export function setLspOpenFileHandler(fn) {
  openFileHandler = fn;
}

export function registerLspFileBinding(uri, fileId) {
  if (uri && fileId) uriToFileId.set(String(uri), fileId);
}

function emitOutline(symbols, uri) {
  outlineListeners.forEach((l) => {
    try { l({ symbols, uri }); } catch { /* ignore */ }
  });
}

function notifyMarkersChanged() {
  try {
    window.dispatchEvent(new CustomEvent('orion-markers-changed'));
  } catch { /* ignore */ }
}

function lspWsUrl(language, projectId, userId) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const token = getAccessToken() || '';
  const q = new URLSearchParams({
    language,
    projectId: String(projectId || ''),
    userId: String(userId || ''),
  });
  if (token) q.set('token', token);
  if (import.meta.env.DEV && /:3010$/.test(host)) {
    return `ws://localhost:3000/api/lsp/ws?${q}`;
  }
  return `${proto}//${host}/api/lsp/ws?${q}`;
}

export function fileUri(projectId, relativePath) {
  const rel = String(relativePath || 'untitled').replace(/\\/g, '/').replace(/^\/+/, '');
  return `file:///workspace/${projectId}/${rel}`;
}

export function parseWorkspaceUri(uri) {
  const m = String(uri || '').match(/\/workspace\/[^/]+\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function posToLsp(position) {
  return { line: position.lineNumber - 1, character: position.column - 1 };
}

function rangeToMonaco(monaco, range) {
  if (!range?.start || !range?.end) return null;
  return new monaco.Range(
    range.start.line + 1,
    range.start.character + 1,
    range.end.line + 1,
    range.end.character + 1,
  );
}

function mapSymbols(monaco, result) {
  const mapSym = (s) => ({
    name: s.name,
    detail: s.detail,
    kind: s.kind,
    range: rangeToMonaco(monaco, s.range || s.location?.range),
    selectionRange: rangeToMonaco(monaco, s.selectionRange || s.range || s.location?.range),
    tags: s.tags,
    children: (s.children || []).map(mapSym),
  });
  if (Array.isArray(result) && result[0]?.location) {
    return result.map((s) => ({
      name: s.name,
      kind: s.kind,
      range: rangeToMonaco(monaco, s.location.range),
      selectionRange: rangeToMonaco(monaco, s.location.range),
    }));
  }
  return (result || []).map(mapSym);
}

function lspSeverityToMarker(sev) {
  if (sev === 1) return 8;
  if (sev === 2) return 4;
  if (sev === 3) return 2;
  return 1;
}

function completionKind(monaco, kind) {
  const K = monaco.languages.CompletionItemKind;
  const map = {
    1: K.Text, 2: K.Method, 3: K.Function, 4: K.Constructor, 5: K.Field,
    6: K.Variable, 7: K.Class, 8: K.Interface, 9: K.Module, 10: K.Property,
    11: K.Unit, 12: K.Value, 13: K.Enum, 14: K.Keyword, 15: K.Snippet,
    16: K.Color, 17: K.File, 18: K.Reference, 19: K.Folder, 20: K.EnumMember,
    21: K.Constant, 22: K.Struct, 23: K.Event, 24: K.Operator, 25: K.TypeParameter,
  };
  return map[kind] || K.Text;
}

function workspaceEditToMonaco(monaco, edit) {
  if (!edit) return undefined;
  const edits = [];
  if (edit.changes) {
    Object.entries(edit.changes).forEach(([uri, textEdits]) => {
      (textEdits || []).forEach((te) => {
        edits.push({
          resource: monaco.Uri.parse(uri),
          textEdit: {
            range: rangeToMonaco(monaco, te.range),
            text: te.newText,
          },
        });
      });
    });
  }
  if (edit.documentChanges) {
    edit.documentChanges.forEach((dc) => {
      if (!dc.edits || !dc.textDocument?.uri) return;
      dc.edits.forEach((te) => {
        edits.push({
          resource: monaco.Uri.parse(dc.textDocument.uri),
          textEdit: {
            range: rangeToMonaco(monaco, te.range),
            text: te.newText,
          },
        });
      });
    });
  }
  return edits.length ? { edits } : undefined;
}

function dropSession(language) {
  const entry = sessions.get(language);
  if (!entry) return;
  entry.disposables.forEach((d) => { try { d.dispose(); } catch { /* ignore */ } });
  try { entry.client.dispose(); } catch { /* ignore */ }
  sessions.delete(language);
  emitStatus();
}

async function ensureSession(language) {
  if (!language || !projectIdRef || !monacoRef) return null;
  const existing = sessions.get(language);
  if (existing) {
    if (existing.initializing) return existing;
    if (existing.client?.ready) return existing;
    // Dead / failed — clear and retry
    dropSession(language);
  }

  const userId = userIdRef;
  if (!userId) return null;

  const client = new LspJsonRpcClient();
  const entry = {
    client,
    language,
    disposables: [],
    caps: null,
    initializing: true,
    providersRegistered: false,
  };
  sessions.set(language, entry);
  emitStatus();

  client.onStatus((st) => {
    emitStatus();
    if (st?.status === 'closed' || st?.status === 'exited') {
      // Allow a later ensureSession to recreate
      setTimeout(() => {
        if (sessions.get(language) === entry && !entry.client?.ready) {
          dropSession(language);
        }
      }, 800);
    }
  });

  try {
    await ensureWorkspaceFilesOnDisk();
    await client.connect(lspWsUrl(language, projectIdRef, userId));
    const caps = await client.request('initialize', {
      processId: null,
      rootUri: `file:///workspace/${projectIdRef}`,
      workspaceFolders: [{ uri: `file:///workspace/${projectIdRef}`, name: String(projectIdRef) }],
      capabilities: {
        textDocument: {
          synchronization: { willSave: false, didSave: true, dynamicRegistration: false },
          completion: {
            completionItem: {
              snippetSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
            },
            contextSupport: true,
          },
          hover: { contentFormat: ['markdown', 'plaintext'] },
          signatureHelp: { signatureInformation: { documentationFormat: ['markdown', 'plaintext'] } },
          definition: { linkSupport: true },
          references: {},
          rename: { prepareSupport: true },
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          formatting: {},
          rangeFormatting: {},
          codeAction: {
            codeActionLiteralSupport: {
              codeActionKind: { valueSet: ['quickfix', 'refactor', 'source'] },
            },
          },
          publishDiagnostics: { relatedInformation: true },
        },
        workspace: {
          workspaceFolders: true,
          configuration: true,
        },
      },
      initializationOptions: {},
      locale: 'en',
    });
    entry.caps = caps?.capabilities || {};
    client.notify('initialized', {});
    entry.initializing = false;

    client.onNotification('textDocument/publishDiagnostics', (params) => {
      applyDiagnostics(monacoRef, params);
    });

    if (!entry.providersRegistered) {
      registerProviders(monacoRef, language, entry);
      entry.providersRegistered = true;
    }
    emitStatus();
  } catch (err) {
    entry.initializing = false;
    entry.error = err.message;
    emitStatus();
    // Drop after a beat so the next open retries
    setTimeout(() => {
      if (sessions.get(language) === entry && !entry.client?.ready) dropSession(language);
    }, 2500);
  }

  return entry;
}

function applyDiagnostics(monaco, params) {
  if (!monaco || !params?.uri) return;
  let target = monaco.editor.getModels().find((m) => m.uri.toString() === params.uri);
  if (!target) {
    const leaf = params.uri.split('/').pop();
    target = monaco.editor.getModels().find((m) => {
      const p = m.uri.path || '';
      return p.endsWith(`/${leaf}`) || p.endsWith(leaf);
    });
  }
  if (!target) return;
  const markers = (params.diagnostics || []).map((d) => ({
    message: d.message,
    severity: lspSeverityToMarker(d.severity),
    startLineNumber: (d.range?.start?.line ?? 0) + 1,
    startColumn: (d.range?.start?.character ?? 0) + 1,
    endLineNumber: (d.range?.end?.line ?? 0) + 1,
    endColumn: (d.range?.end?.character ?? 0) + 1,
    source: d.source || 'lsp',
    code: typeof d.code === 'object' ? d.code?.value : d.code,
  }));
  monaco.editor.setModelMarkers(target, 'orion-lsp', markers);
  if (!window.__orionMarkers) window.__orionMarkers = {};
  const fileId = uriToFileId.get(params.uri) || uriToFileId.get(target.uri.toString());
  // Prefer Drive file id so ProblemsPanel / dock counts stay consistent
  if (fileId) {
    window.__orionMarkers[fileId] = markers;
    delete window.__orionMarkers[target.uri.toString()];
  } else {
    window.__orionMarkers[target.uri.toString()] = markers;
  }
  notifyMarkersChanged();
}

function registerProviders(monaco, language, entry) {
  const { client } = entry;
  const getModelUri = (model) => model.uri.toString();

  entry.disposables.push(
    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['.', '"', "'", '/', '@', '('],
      provideCompletionItems: async (model, position, _ctx, token) => {
        if (!client.ready) return { suggestions: [] };
        try {
          const result = await client.request('textDocument/completion', {
            textDocument: { uri: getModelUri(model) },
            position: posToLsp(position),
          });
          if (token.isCancellationRequested) return { suggestions: [] };
          const items = Array.isArray(result) ? result : (result?.items || []);
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          return {
            suggestions: items.map((item) => ({
              label: item.label,
              kind: completionKind(monaco, item.kind),
              detail: item.detail,
              documentation: item.documentation?.value || item.documentation,
              insertText: item.insertText || (typeof item.label === 'string' ? item.label : item.label?.label) || '',
              insertTextRules: item.insertTextFormat === 2
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              range: item.textEdit?.range ? rangeToMonaco(monaco, item.textEdit.range) : range,
              sortText: item.sortText,
              filterText: item.filterText,
            })),
          };
        } catch {
          return { suggestions: [] };
        }
      },
    }),
  );

  entry.disposables.push(
    monaco.languages.registerHoverProvider(language, {
      provideHover: async (model, position) => {
        if (!client.ready) return null;
        try {
          const result = await client.request('textDocument/hover', {
            textDocument: { uri: getModelUri(model) },
            position: posToLsp(position),
          });
          if (!result?.contents) return null;
          const contents = Array.isArray(result.contents)
            ? result.contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n\n')
            : (typeof result.contents === 'string' ? result.contents : result.contents.value);
          return {
            range: rangeToMonaco(monaco, result.range),
            contents: [{ value: contents }],
          };
        } catch {
          return null;
        }
      },
    }),
  );

  entry.disposables.push(
    monaco.languages.registerDefinitionProvider(language, {
      provideDefinition: async (model, position) => {
        if (!client.ready) return [];
        try {
          const result = await client.request('textDocument/definition', {
            textDocument: { uri: getModelUri(model) },
            position: posToLsp(position),
          });
          const locs = Array.isArray(result) ? result : (result ? [result] : []);
          return locs.map((loc) => ({
            uri: monaco.Uri.parse(loc.uri || loc.targetUri),
            range: rangeToMonaco(monaco, loc.range || loc.targetRange || loc.targetSelectionRange),
          })).filter((l) => l.range);
        } catch {
          return [];
        }
      },
    }),
  );

  entry.disposables.push(
    monaco.languages.registerReferenceProvider(language, {
      provideReferences: async (model, position, context) => {
        if (!client.ready) return [];
        try {
          const result = await client.request('textDocument/references', {
            textDocument: { uri: getModelUri(model) },
            position: posToLsp(position),
            context: { includeDeclaration: context?.includeDeclaration !== false },
          });
          return (result || []).map((loc) => ({
            uri: monaco.Uri.parse(loc.uri),
            range: rangeToMonaco(monaco, loc.range),
          })).filter((l) => l.range);
        } catch {
          return [];
        }
      },
    }),
  );

  entry.disposables.push(
    monaco.languages.registerRenameProvider(language, {
      provideRenameEdits: async (model, position, newName) => {
        if (!client.ready) return null;
        try {
          const result = await client.request('textDocument/rename', {
            textDocument: { uri: getModelUri(model) },
            position: posToLsp(position),
            newName,
          });
          return workspaceEditToMonaco(monaco, result);
        } catch {
          return null;
        }
      },
    }),
  );

  entry.disposables.push(
    monaco.languages.registerSignatureHelpProvider(language, {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp: async (model, position) => {
        if (!client.ready) return null;
        try {
          const result = await client.request('textDocument/signatureHelp', {
            textDocument: { uri: getModelUri(model) },
            position: posToLsp(position),
          });
          if (!result) return null;
          return {
            value: {
              signatures: (result.signatures || []).map((s) => ({
                label: s.label,
                documentation: s.documentation?.value || s.documentation,
                parameters: (s.parameters || []).map((p) => ({
                  label: p.label,
                  documentation: p.documentation?.value || p.documentation,
                })),
              })),
              activeSignature: result.activeSignature || 0,
              activeParameter: result.activeParameter || 0,
            },
            dispose: () => {},
          };
        } catch {
          return null;
        }
      },
    }),
  );

  entry.disposables.push(
    monaco.languages.registerDocumentSymbolProvider(language, {
      provideDocumentSymbols: async (model) => {
        if (!client.ready) return [];
        try {
          const result = await client.request('textDocument/documentSymbol', {
            textDocument: { uri: getModelUri(model) },
          });
          const tree = mapSymbols(monaco, result);
          emitOutline(tree, getModelUri(model));
          return tree;
        } catch {
          return [];
        }
      },
    }),
  );

  entry.disposables.push(
    monaco.languages.registerDocumentFormattingEditProvider(language, {
      provideDocumentFormattingEdits: async (model, options) => {
        if (!client.ready) return [];
        try {
          const result = await client.request('textDocument/formatting', {
            textDocument: { uri: getModelUri(model) },
            options: {
              tabSize: options.tabSize,
              insertSpaces: options.insertSpaces,
            },
          });
          return (result || []).map((te) => ({
            range: rangeToMonaco(monaco, te.range),
            text: te.newText,
          }));
        } catch {
          return [];
        }
      },
    }),
  );

  entry.disposables.push(
    monaco.languages.registerCodeActionProvider(language, {
      provideCodeActions: async (model, range, context) => {
        if (!client.ready) return { actions: [], dispose: () => {} };
        try {
          const result = await client.request('textDocument/codeAction', {
            textDocument: { uri: getModelUri(model) },
            range: {
              start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
              end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
            },
            context: {
              diagnostics: (context.markers || []).map((m) => ({
                message: m.message,
                severity: 1,
                range: {
                  start: { line: m.startLineNumber - 1, character: m.startColumn - 1 },
                  end: { line: m.endLineNumber - 1, character: m.endColumn - 1 },
                },
              })),
            },
          });
          const actions = (result || []).map((ca) => {
            if (typeof ca === 'object' && ca.title) {
              return {
                title: ca.title,
                kind: ca.kind || 'quickfix',
                edit: workspaceEditToMonaco(monaco, ca.edit),
                command: ca.command ? {
                  id: ca.command.command || ca.command,
                  title: ca.title,
                  arguments: ca.command.arguments,
                } : undefined,
              };
            }
            return { title: String(ca), kind: 'quickfix' };
          });
          return { actions, dispose: () => {} };
        } catch {
          return { actions: [], dispose: () => {} };
        }
      },
    }),
  );
}

export async function lspDidOpen(model, language, text, fileId) {
  if (fileId) registerLspFileBinding(model.uri.toString(), fileId);
  // Soft pull so language servers see latest Drive materialization for this file open
  await ensureWorkspaceFilesOnDisk({ force: false });
  const entry = await ensureSession(language);
  if (!entry?.client?.ready) {
    // Retry once after a forced pull if session failed/cold
    await ensureWorkspaceFilesOnDisk({ force: true });
    const retry = await ensureSession(language);
    if (!retry?.client?.ready) return;
    retry.client.notify('textDocument/didOpen', {
      textDocument: {
        uri: model.uri.toString(),
        languageId: language,
        version: model.getVersionId(),
        text: text ?? model.getValue(),
      },
    });
    return;
  }
  entry.client.notify('textDocument/didOpen', {
    textDocument: {
      uri: model.uri.toString(),
      languageId: language,
      version: model.getVersionId(),
      text: text ?? model.getValue(),
    },
  });
}

export function lspDidChange(model, language) {
  const entry = sessions.get(language);
  if (!entry?.client?.ready) return;
  entry.client.notify('textDocument/didChange', {
    textDocument: {
      uri: model.uri.toString(),
      version: model.getVersionId(),
    },
    contentChanges: [{ text: model.getValue() }],
  });
}

export function lspDidClose(model, language) {
  const entry = sessions.get(language);
  const uri = model?.uri?.toString?.();
  if (uri) uriToFileId.delete(uri);
  if (!entry?.client?.ready) return;
  entry.client.notify('textDocument/didClose', {
    textDocument: { uri },
  });
}

export async function lspFormatDocument(editor) {
  const action = editor.getAction('editor.action.formatDocument');
  if (action) await action.run();
}

export async function lspRename(editor) {
  const action = editor.getAction('editor.action.rename');
  if (action) await action.run();
}

export async function lspGoToDefinition(editor) {
  const action = editor.getAction('editor.action.revealDefinition');
  if (action) await action.run();
}

export async function lspFindReferences(editor) {
  const action = editor.getAction('editor.action.goToReferences');
  if (action) await action.run();
}

export async function refreshOutline(editor) {
  const model = editor?.getModel?.();
  if (!model || !monacoRef) return [];
  const language = model.getLanguageId();
  const entry = sessions.get(language);
  if (!entry?.client?.ready) return [];
  try {
    const result = await entry.client.request('textDocument/documentSymbol', {
      textDocument: { uri: model.uri.toString() },
    });
    const tree = mapSymbols(monacoRef, result);
    emitOutline(tree, model.uri.toString());
    return tree;
  } catch {
    return [];
  }
}

export function initMonacoLsp(monaco, { projectId, userId }) {
  monacoRef = monaco;
  projectIdRef = projectId;
  userIdRef = userId;

  if (!openerRegistered) {
    openerRegistered = true;
    monaco.editor.registerEditorOpener({
      openCodeEditor: async (_source, resource, selection) => {
        const uri = resource.toString();
        // Same-model navigation — let Monaco handle
        const existing = monaco.editor.getModels().find((m) => m.uri.toString() === uri);
        if (existing && !openFileHandler) return false;
        if (typeof openFileHandler === 'function') {
          const ok = await openFileHandler(uri, selection);
          return Boolean(ok);
        }
        return false;
      },
    });
  }
  emitStatus();
}

export function getLspStatus(language) {
  if (language) return sessions.get(language)?.client?.status || { status: 'idle' };
  return getLspStatusSummary();
}

export function disposeAllLsp() {
  [...sessions.keys()].forEach(dropSession);
  uriToFileId.clear();
  emitStatus();
}
