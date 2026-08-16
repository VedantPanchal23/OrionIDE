/**
 * Poll git status and map relative paths → single-letter glyphs for Explorer.
 */
import { useCallback, useEffect, useState } from 'react';
import * as gitService from '../services/gitService';
import { gitStatusGlyph } from '../utils/fileIcons';

function fileNameFromPath(path) {
  const parts = String(path || '').replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

/**
 * @returns {{ decorations: Record<string, string>, refreshGitDecorations: () => Promise<void> }}
 */
export function useGitDecorations(projectId, { intervalMs = 8000 } = {}) {
  const [byPath, setByPath] = useState({});

  const refresh = useCallback(async () => {
    if (!projectId) {
      setByPath({});
      return;
    }
    try {
      const res = await gitService.getStatus(projectId);
      const data = res.data?.data || {};
      const next = {};
      const ingest = (list, sectionTitle) => {
        (list || []).forEach((it) => {
          const path = typeof it === 'string' ? it : it.path;
          if (!path) return;
          const st = gitStatusGlyph(
            typeof it === 'string' ? '' : it.status,
            sectionTitle,
          );
          const norm = String(path).replace(/\\/g, '/');
          next[norm] = st;
          next[fileNameFromPath(norm)] = st;
        });
      };
      ingest(data.staged, 'Staged');
      ingest(data.unstaged || data.modified || data.changed, 'Modified');
      ingest(data.untracked, 'Untracked');
      ingest(data.deleted, 'Deleted');
      ingest(data.files, '');
      setByPath(next);
    } catch {
      /* no git repo yet — silent */
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
    if (!projectId || !intervalMs) return undefined;
    const id = setInterval(refresh, intervalMs);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [projectId, intervalMs, refresh]);

  return { decorations: byPath, refreshGitDecorations: refresh };
}

export function gitGlyphForNode(decorations, tree, node) {
  if (!node || node.isFolder || !decorations) return '';
  try {
    const parts = (tree.getPath(node.id) || []).map((n) => n.name);
    const rel = parts.length > 1 ? parts.slice(1).join('/') : node.name;
    return decorations[rel] || decorations[node.name] || '';
  } catch {
    return decorations[node.name] || '';
  }
}

export function gitGlyphClass(glyph) {
  const g = String(glyph || '').toUpperCase();
  if (g === 'U' || g === '?') return 'git-st-u';
  if (g === 'A') return 'git-st-a';
  if (g === 'D') return 'git-st-d';
  if (g === 'M' || g === 'R' || g === 'C') return 'git-st-m';
  return '';
}
