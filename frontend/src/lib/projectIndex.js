/**
 * Lightweight project code index (lexical) for Search + agent context.
 * Not embeddings — indexes identifiers/keywords from open buffers + optional snippets.
 */

const STOP = new Set([
  'the', 'and', 'for', 'var', 'let', 'const', 'function', 'class', 'return',
  'import', 'export', 'from', 'this', 'that', 'with', 'true', 'false', 'null',
  'undefined', 'async', 'await', 'void', 'type', 'interface', 'public', 'private',
]);

function extractTokens(text) {
  const set = new Set();
  const src = String(text || '').slice(0, 200_000);
  for (const m of src.matchAll(/\b[A-Za-z_][A-Za-z0-9_]{2,}\b/g)) {
    const t = m[0];
    if (STOP.has(t.toLowerCase())) continue;
    set.add(t);
    if (set.size >= 800) break;
  }
  return [...set];
}

function extractDefs(text, fileName) {
  const lines = String(text || '').split('\n');
  const defs = [];
  const patterns = [
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][\w]*)/,
    /^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_][\w]*)/,
    /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_][\w]*)\s*=/,
    /^\s*def\s+([A-Za-z_][\w]*)\s*\(/,
    /^\s*class\s+([A-Za-z_][\w]*)\s*[:\(]/,
    /^\s*fn\s+([A-Za-z_][\w]*)\s*[<\(]/,
    /^\s*func\s+([A-Za-z_][\w]*)\s*\(/,
    /^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)/,
    /^\s*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?class\s+([A-Za-z_][\w]*)/,
    /^\s*(?:public|private|protected)\s+(?:static\s+)?(?:[\w.<>,\[\]\s]+)\s+([A-Za-z_][\w]*)\s*\(/,
    /^\s*(?:public|private|protected)\s+interface\s+([A-Za-z_][\w]*)/,
  ];
  lines.forEach((line, i) => {
    for (const re of patterns) {
      const m = line.match(re);
      if (m) {
        defs.push({
          name: m[1],
          line: i + 1,
          fileName,
          preview: line.trim().slice(0, 120),
        });
        break;
      }
    }
  });
  return defs.slice(0, 200);
}

/**
 * @param {{ id: string, name: string, content: string }[]} files
 */
export function buildProjectIndex(files = []) {
  const byToken = new Map(); // token → [{ fileId, name, line? }]
  const defs = [];

  files.forEach((f) => {
    if (!f?.id || typeof f.content !== 'string') return;
    const tokens = extractTokens(f.content);
    tokens.forEach((t) => {
      const key = t.toLowerCase();
      if (!byToken.has(key)) byToken.set(key, []);
      const list = byToken.get(key);
      if (list.length < 12) list.push({ fileId: f.id, name: f.name, token: t });
    });
    defs.push(...extractDefs(f.content, f.name).map((d) => ({ ...d, fileId: f.id })));
  });

  return { byToken, defs, fileCount: files.length, builtAt: Date.now() };
}

export function searchIndex(index, query, limit = 40) {
  const q = String(query || '').trim().toLowerCase();
  if (!q || !index) return { symbols: [], tokens: [] };
  const symbols = (index.defs || [])
    .filter((d) => d.name.toLowerCase().includes(q))
    .slice(0, limit);
  const tokens = [];
  if (index.byToken) {
    for (const [key, hits] of index.byToken) {
      if (key.includes(q) || q.includes(key)) {
        hits.forEach((h) => tokens.push({ ...h, key }));
        if (tokens.length >= limit) break;
      }
    }
  }
  return { symbols, tokens: tokens.slice(0, limit) };
}

/** Compact context string for agent prompts */
export function indexToAgentContext(index, maxChars = 3500) {
  if (!index?.defs?.length) return '';
  const lines = index.defs.slice(0, 80).map(
    (d) => `${d.fileName}:${d.line} ${d.name} — ${d.preview}`,
  );
  let out = '# Project symbol index (open + recent files)\n' + lines.join('\n');
  if (out.length > maxChars) out = `${out.slice(0, maxChars)}\n…`;
  return out;
}
