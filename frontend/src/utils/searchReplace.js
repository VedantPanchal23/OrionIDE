/**
 * Case-insensitive replace-all for open-editor search.
 */
export function replaceAllInText(content, query, replacement) {
  const q = String(query || '').trim();
  const src = String(content ?? '');
  if (!q) return { text: src, count: 0 };
  const lower = src.toLowerCase();
  const needle = q.toLowerCase();
  let count = 0;
  let i = 0;
  let out = '';
  while (i < src.length) {
    const idx = lower.indexOf(needle, i);
    if (idx < 0) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, idx) + String(replacement ?? '');
    count += 1;
    i = idx + needle.length;
  }
  return { text: out, count };
}
