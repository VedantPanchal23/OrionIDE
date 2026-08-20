/**
 * Ghost-text Tab completions (Monaco InlineCompletions).
 * Local catalog / word heuristics — no network round-trip for latency.
 */

import { CATALOGS } from '../completions/catalogs';

function wordsFromDoc(model) {
  const text = model.getValue().slice(0, 80000);
  const set = new Set();
  for (const m of text.matchAll(/\b[A-Za-z_][A-Za-z0-9_]{2,}\b/g)) {
    set.add(m[0]);
    if (set.size > 400) break;
  }
  return set;
}

function catalogWords(languageId) {
  const c = CATALOGS[languageId] || CATALOGS.plaintext;
  if (!c) return [];
  return [...(c.builtins || []), ...(c.methods || []), ...(c.keywords || [])].slice(0, 200);
}

/**
 * @param {import('monaco-editor').editor.IStandaloneCodeEditor} editor
 * @param {typeof import('monaco-editor')} monaco
 */
export function registerTabCompletions(monaco) {
  if (!monaco || monaco.__orionTabCompletions) return;
  monaco.__orionTabCompletions = true;

  monaco.languages.registerInlineCompletionsProvider('*', {
    provideInlineCompletions(model, position) {
      const line = model.getLineContent(position.lineNumber);
      const before = line.slice(0, position.column - 1);
      const m = before.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!m) return { items: [] };
      const prefix = m[1];
      if (prefix.length < 2) return { items: [] };

      const lang = model.getLanguageId();
      const pool = new Set([...catalogWords(lang), ...wordsFromDoc(model)]);
      const hits = [...pool]
        .filter((w) => w.startsWith(prefix) && w !== prefix)
        .sort((a, b) => a.length - b.length)
        .slice(0, 3);

      return {
        items: hits.map((w) => ({
          insertText: w.slice(prefix.length),
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
        })),
      };
    },
    freeInlineCompletions() {},
  });
}
