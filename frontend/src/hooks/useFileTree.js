/**
 * Orion IDE — Explorer file tree state
 *
 * Bug fixes baked in:
 *  - New file/folder parent resolves to the selected folder, or the parent
 *    of the selected file, or the project root — never hard-coded root.
 *  - Duplicate sibling names are rejected client-side before hitting the
 *    API, and server 409s are surfaced with a distinguishable error code
 *    so the caller can toast them.
 *  - Folders created client-side always carry isFolder:true regardless of
 *    what the API happens to echo back.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as driveService from '../services/driveService';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function toNode(apiItem, parentId) {
  const isFolder = Boolean(apiItem.isFolder ?? apiItem.mimeType === FOLDER_MIME);
  return {
    id: apiItem.id,
    name: apiItem.name,
    isFolder,
    mimeType: apiItem.mimeType || (isFolder ? FOLDER_MIME : null),
    parentId,
    modifiedTime: apiItem.modifiedTime || null,
  };
}

function sortIds(ids, nodesById) {
  return [...ids].sort((a, b) => {
    const na = nodesById[a];
    const nb = nodesById[b];
    if (!na || !nb) return 0;
    if (na.isFolder !== nb.isFolder) return na.isFolder ? -1 : 1;
    return na.name.localeCompare(nb.name, undefined, { sensitivity: 'base' });
  });
}

export function useFileTree(projectId, projectName) {
  const [nodesById, setNodesById] = useState({});
  const [childrenByParent, setChildrenByParent] = useState({});
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [loadingIds, setLoadingIds] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null); // node id being renamed, or 'new:<parentId>:<type>'
  const [ready, setReady] = useState(false);

  const nodesRef = useRef(nodesById);
  const childrenRef = useRef(childrenByParent);

  useEffect(() => { nodesRef.current = nodesById; }, [nodesById]);
  useEffect(() => { childrenRef.current = childrenByParent; }, [childrenByParent]);

  const setLoading = useCallback((id, on) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const loadFolder = useCallback(async (folderId) => {
    setLoading(folderId, true);
    try {
      const res = await driveService.listFiles(folderId);
      const items = res.data?.data?.files || [];
      const nodes = items.map((it) => toNode(it, folderId));
      setNodesById((prev) => {
        const next = { ...prev };
        nodes.forEach((n) => { next[n.id] = n; });
        return next;
      });
      setChildrenByParent((prev) => ({
        ...prev,
        [folderId]: sortIds(nodes.map((n) => n.id), Object.fromEntries(nodes.map((n) => [n.id, n]))),
      }));
      return nodes;
    } finally {
      setLoading(folderId, false);
    }
  }, [setLoading]);

  // (Re)initialize whenever the project changes.
  useEffect(() => {
    if (!projectId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting tree state for a new project id
    setReady(false);
    const rootNode = { id: projectId, name: projectName || 'Project', isFolder: true, parentId: null, mimeType: FOLDER_MIME };
    setNodesById({ [projectId]: rootNode });
    setChildrenByParent({});
    setExpandedIds(new Set([projectId]));
    setSelectedId(null);
    setEditingId(null);
    loadFolder(projectId).finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const toggleExpand = useCallback((id) => {
    const node = nodesRef.current[id];
    if (!node?.isFolder) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!childrenRef.current[id]) loadFolder(id);
      }
      return next;
    });
  }, [loadFolder]);

  const expand = useCallback((id) => {
    setExpandedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    if (!childrenRef.current[id]) return loadFolder(id);
    return Promise.resolve(childrenRef.current[id]);
  }, [loadFolder]);

  /** Bug fix #1: never default straight to root. */
  const resolveParentForNew = useCallback(() => {
    if (!selectedId) return projectId;
    const node = nodesRef.current[selectedId];
    if (!node) return projectId;
    if (node.isFolder) return selectedId;
    return node.parentId || projectId;
  }, [selectedId, projectId]);

  const siblingClash = useCallback((parentId, name, isFolder) => {
    const ids = childrenRef.current[parentId] || [];
    return ids.some((id) => {
      const n = nodesRef.current[id];
      return n && n.isFolder === isFolder && n.name.toLowerCase() === name.toLowerCase();
    });
  }, []);

  const insertNode = useCallback((node) => {
    setNodesById((prev) => ({ ...prev, [node.id]: node }));
    setChildrenByParent((prev) => {
      const existing = prev[node.parentId] || [];
      const withNew = existing.includes(node.id) ? existing : [...existing, node.id];
      const merged = { ...nodesRef.current, [node.id]: node };
      return { ...prev, [node.parentId]: sortIds(withNew, merged) };
    });
  }, []);

  /**
   * Create a file or folder. Parent resolves via resolveParentForNew()
   * unless explicitly overridden (e.g. "New File" from a folder's context menu).
   * Throws { code: 'DUPLICATE' } client-side, or rethrows the axios error
   * (with .response.status === 409) from the server — callers should toast both.
   */
  const createItem = useCallback(async (name, type, parentIdOverride) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) throw Object.assign(new Error('Name is required'), { code: 'INVALID_NAME' });
    const parentId = parentIdOverride || resolveParentForNew();
    const isFolder = type === 'folder';

    if (siblingClash(parentId, trimmed, isFolder)) {
      throw Object.assign(
        new Error(`A ${isFolder ? 'folder' : 'file'} named "${trimmed}" already exists here`),
        { code: 'DUPLICATE' },
      );
    }

    // Ensure the parent folder is expanded/loaded so the new node is visible immediately.
    await expand(parentId);
    if (siblingClash(parentId, trimmed, isFolder)) {
      throw Object.assign(
        new Error(`A ${isFolder ? 'folder' : 'file'} named "${trimmed}" already exists here`),
        { code: 'DUPLICATE' },
      );
    }

    const res = await driveService.createFile(parentId, trimmed, isFolder ? 'folder' : 'file', '');
    const created = res.data?.data;
    const node = toNode({ ...created, isFolder: isFolder ? true : Boolean(created?.isFolder) }, parentId);
    insertNode(node);
    setSelectedId(node.id);
    return node;
  }, [resolveParentForNew, siblingClash, expand, insertNode]);

  const renameItem = useCallback(async (id, newName) => {
    const trimmed = String(newName || '').trim();
    const node = nodesRef.current[id];
    if (!node || !trimmed || trimmed === node.name) return node;
    if (siblingClash(node.parentId, trimmed, node.isFolder)) {
      throw Object.assign(new Error(`"${trimmed}" already exists here`), { code: 'DUPLICATE' });
    }
    await driveService.renameFile(id, trimmed);
    setNodesById((prev) => ({ ...prev, [id]: { ...prev[id], name: trimmed } }));
    setChildrenByParent((prev) => {
      const merged = { ...nodesRef.current, [id]: { ...node, name: trimmed } };
      return { ...prev, [node.parentId]: sortIds(prev[node.parentId] || [], merged) };
    });
    return { ...node, name: trimmed };
  }, [siblingClash]);

  const removeSubtree = useCallback((id) => {
    setNodesById((prev) => {
      const next = { ...prev };
      const stack = [id];
      while (stack.length) {
        const cur = stack.pop();
        const kids = childrenRef.current[cur] || [];
        kids.forEach((k) => stack.push(k));
        delete next[cur];
      }
      return next;
    });
    setChildrenByParent((prev) => {
      const next = { ...prev };
      delete next[id];
      Object.keys(next).forEach((parent) => {
        next[parent] = next[parent].filter((cid) => cid !== id);
      });
      return next;
    });
  }, []);

  const deleteItem = useCallback(async (id) => {
    await driveService.deleteFile(id);
    if (selectedId === id) setSelectedId(null);
    removeSubtree(id);
  }, [removeSubtree, selectedId]);

  const refreshFolder = useCallback((id) => loadFolder(id), [loadFolder]);

  return {
    rootId: projectId,
    nodesById,
    childrenByParent,
    expandedIds,
    loadingIds,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    ready,
    toggleExpand,
    expand,
    resolveParentForNew,
    createItem,
    renameItem,
    deleteItem,
    refreshFolder,
  };
}

export default useFileTree;
