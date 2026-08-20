/**
 * Remembers recently loaded file contents for lexical indexing
 * (Search symbols + agent context) after tabs are closed.
 */

const MAX = 40;
/** @type {Map<string, { id: string, name: string, content: string, at: number }>} */
const cache = new Map();

export function rememberIndexedFile(file) {
  if (!file?.id || typeof file.content !== 'string') return;
  if (file.content.length > 400_000) return;
  cache.set(file.id, {
    id: file.id,
    name: file.name || 'file',
    content: file.content,
    at: Date.now(),
  });
  if (cache.size > MAX) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

export function forgetIndexedFile(id) {
  if (id) cache.delete(id);
}

/** Merge open editor buffers over the cache (open wins). */
export function collectIndexFiles(openFiles = [], getLiveContent) {
  const byId = new Map();
  cache.forEach((f, id) => byId.set(id, { id: f.id, name: f.name, content: f.content }));
  openFiles.forEach((f) => {
    if (!f?.id) return;
    const content = getLiveContent?.(f.id) ?? f.content ?? '';
    if (typeof content !== 'string') return;
    byId.set(f.id, { id: f.id, name: f.name, content });
    rememberIndexedFile({ id: f.id, name: f.name, content });
  });
  return [...byId.values()];
}
