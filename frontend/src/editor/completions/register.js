/**
 * Register permanent completion + snippet providers for every Orion language.
 * Also harvests words from the current document so local identifiers appear.
 */

import { CATALOGS } from './catalogs';

let registered = false;

function kindMap(monaco) {
  const K = monaco.languages.CompletionItemKind;
  return {
    keyword: K.Keyword,
    function: K.Function,
    method: K.Method,
    class: K.Class,
    module: K.Module,
    variable: K.Variable,
    snippet: K.Snippet,
    constant: K.Constant,
    property: K.Property,
    text: K.Text,
  };
}

function collectDocumentWords(model, monaco) {
  const text = model.getValue();
  const words = text.match(/[A-Za-z_][\w$]*/g) || [];
  const uniq = [...new Set(words)];
  const K = monaco.languages.CompletionItemKind;
  return uniq.slice(0, 800).map((w) => ({
    label: w,
    kind: K.Text,
    insertText: w,
    detail: 'in file',
    sortText: `3_${w}`,
  }));
}

function buildFromCatalog(catalog, monaco, range, { afterDot } = {}) {
  const kinds = kindMap(monaco);
  const out = [];

  const push = (label, kind, detail, extra = {}) => {
    out.push({
      label,
      kind,
      insertText: extra.insertText || label,
      insertTextRules: extra.insertText
        ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        : undefined,
      detail,
      documentation: extra.documentation,
      range,
      sortText: extra.sortText || `1_${label}`,
    });
  };

  if (afterDot) {
    (catalog.methods || []).forEach((m) => push(m, kinds.method, 'method', { sortText: `0_${m}` }));
    (catalog.builtins || []).forEach((b) => push(b, kinds.property, 'member', { sortText: `1_${b}` }));
    return out;
  }

  (catalog.snippets || []).forEach((s) => {
    push(s.label, kinds.snippet, s.detail || 'snippet', {
      insertText: s.insertText,
      sortText: `0_${s.label}`,
    });
  });
  (catalog.keywords || []).forEach((k) => push(k, kinds.keyword, 'keyword', { sortText: `1_${k}` }));
  (catalog.builtins || []).forEach((b) => push(b, kinds.function, 'builtin', { sortText: `1_${b}` }));
  (catalog.modules || []).forEach((m) => push(m, kinds.module, 'library / module', { sortText: `2_${m}` }));
  (catalog.methods || []).forEach((m) => push(m, kinds.method, 'method', { sortText: `2_${m}` }));

  return out;
}

function makeProvider(monaco, languageId, catalog) {
  return {
    triggerCharacters: ['.', '_', '"', "'", '/', '<', '#', '@'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const afterDot = /\.\s*[\w$]*$/.test(linePrefix);

      const suggestions = [
        ...buildFromCatalog(catalog, monaco, range, { afterDot }),
        ...collectDocumentWords(model, monaco).map((s) => ({ ...s, range })),
      ];

      // Deduplicate by label (keep first / higher-priority)
      const seen = new Set();
      const deduped = [];
      for (const s of suggestions) {
        const key = String(s.label);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(s);
      }

      return { suggestions: deduped };
    },
  };
}

/**
 * One-time registration for all languages in CATALOGS.
 * Safe to call multiple times.
 */
export function registerLanguageCompletions(monaco) {
  if (!monaco || registered) return;
  registered = true;

  // Ensure languages exist (Monaco ships most; register any missing ids).
  const known = new Set(monaco.languages.getLanguages().map((l) => l.id));
  Object.keys(CATALOGS).forEach((id) => {
    if (!known.has(id)) {
      try { monaco.languages.register({ id }); } catch { /* ignore */ }
    }
  });

  Object.entries(CATALOGS).forEach(([languageId, catalog]) => {
    monaco.languages.registerCompletionItemProvider(
      languageId,
      makeProvider(monaco, languageId, catalog),
    );
  });

  // Plaintext / fallback — document words only
  monaco.languages.registerCompletionItemProvider('plaintext', {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: collectDocumentWords(model, monaco).map((s) => ({ ...s, range })),
      };
    },
  });
}
