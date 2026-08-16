/**
 * Shared Drive file tree for Explorer, Search, Quick Open, and palette.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import * as driveService from '../services/driveService';
import { getLanguageByFileName } from '../utils/languageMap';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FileTreeContext = createContext(null);

function toNode(item, parentId) {
  const isFolder = Boolean(
    item.isFolder || item.mimeType === FOLDER_MIME || item.type === 'folder',
  );
  return {
    id: item.id,
    name: item.name,
    isFolder,
    parentId,
    mimeType: item.mimeType || (isFolder ? FOLDER_MIME : 'text/plain'),
  };
}

function sortIds(ids, nodes) {
  return [...ids].sort((a, b) => {
    const na = nodes[a];
    const nb = nodes[b];
    if (na.isFolder !== nb.isFolder) return na.isFolder ? -1 : 1;
    return na.name.localeCompare(nb.name, undefined, { sensitivity: 'base' });
  });
}

export function FileTreeProvider({ projectId, projectName, children }) {
  const [nodesById, setNodesById] = useState({});
  const [childrenByParent, setChildrenByParent] = useState({});
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadingIds, setLoadingIds] = useState(new Set());

  const nodesRef = useRef(nodesById);
  const childrenRef = useRef(childrenByParent);
  useEffect(() => { nodesRef.current = nodesById; }, [nodesById]);
  useEffect(() => { childrenRef.current = childrenByParent; }, [childrenByParent]);

  const setLoading = useCallback((id, on) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
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
        [folderId]: sortIds(
          nodes.map((n) => n.id),
          Object.fromEntries(nodes.map((n) => [n.id, n])),
        ),
      }));
      return nodes;
    } finally {
      setLoading(folderId, false);
    }
  }, [setLoading]);

  useEffect(() => {
    if (!projectId) return;
    setReady(false);
    const rootNode = {
      id: projectId,
      name: projectName || 'Project',
      isFolder: true,
      parentId: null,
      mimeType: FOLDER_MIME,
    };
    setNodesById({ [projectId]: rootNode });
    setChildrenByParent({});
    setExpandedIds(new Set([projectId]));
    setSelectedId(null);
    loadFolder(projectId).finally(() => setReady(true));
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = useCallback((id) => {
    const node = nodesRef.current[id];
    if (!node?.isFolder) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        if (!childrenRef.current[id]) loadFolder(id);
      }
      return next;
    });
  }, [loadFolder]);

  const siblingClash = useCallback((parentId, name, isFolder) => {
    const kids = childrenRef.current[parentId] || [];
    const needle = name.toLowerCase();
    return kids.some((id) => {
      const n = nodesRef.current[id];
      return n && n.isFolder === isFolder && n.name.toLowerCase() === needle;
    });
  }, []);

  const resolveParentForNew = useCallback(() => {
    if (!selectedId) return projectId;
    const node = nodesRef.current[selectedId];
    if (!node) return projectId;
    return node.isFolder ? node.id : (node.parentId || projectId);
  }, [selectedId, projectId]);

  const insertNode = useCallback((node) => {
    setNodesById((prev) => ({ ...prev, [node.id]: node }));
    setChildrenByParent((prev) => {
      const list = prev[node.parentId] || [];
      const merged = { ...nodesRef.current, [node.id]: node };
      return {
        ...prev,
        [node.parentId]: sortIds([...list, node.id], merged),
      };
    });
  }, []);

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
    if (!expandedIds.has(parentId)) {
      setExpandedIds((prev) => new Set(prev).add(parentId));
      await loadFolder(parentId);
    }
    const content = isFolder ? '' : (getLanguageByFileName(trimmed).fileTemplate || '');
    const res = await driveService.createFile(parentId, trimmed, isFolder ? 'folder' : 'file', content);
    const created = res.data?.data;
    const node = toNode({ ...created, isFolder }, parentId);
    if (!isFolder) node.initialContent = content;
    insertNode(node);
    setSelectedId(node.id);
    return node;
  }, [resolveParentForNew, siblingClash, expandedIds, loadFolder, insertNode]);

  const deleteItem = useCallback(async (id) => {
    await driveService.deleteFile(id);
    if (selectedId === id) setSelectedId(null);

    const removeIds = new Set([id]);
    const walk = (pid) => {
      (childrenRef.current[pid] || []).forEach((cid) => {
        removeIds.add(cid);
        walk(cid);
      });
    };
    walk(id);

    setNodesById((prev) => {
      const next = { ...prev };
      removeIds.forEach((rid) => { delete next[rid]; });
      return next;
    });
    setChildrenByParent((prev) => {
      const next = { ...prev };
      removeIds.forEach((rid) => { delete next[rid]; });
      Object.keys(next).forEach((parent) => {
        next[parent] = next[parent].filter((cid) => !removeIds.has(cid));
      });
      return next;
    });
    setExpandedIds((prev) => {
      const next = new Set(prev);
      removeIds.forEach((rid) => next.delete(rid));
      return next;
    });
  }, [selectedId]);

  const renameItem = useCallback(async (id, newName) => {
    const trimmed = String(newName || '').trim();
    if (!trimmed) throw new Error('Name is required');
    const res = await driveService.renameFile(id, trimmed);
    const updated = res.data?.data;
    setNodesById((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return {
        ...prev,
        [id]: { ...cur, name: updated?.name || trimmed },
      };
    });
  }, []);

  const refreshFolder = useCallback((id) => loadFolder(id || projectId), [loadFolder, projectId]);

  const getPath = useCallback((id) => {
    const parts = [];
    let cur = nodesRef.current[id];
    while (cur) {
      parts.unshift(cur);
      cur = cur.parentId ? nodesRef.current[cur.parentId] : null;
    }
    return parts;
  }, []);

  const revealInTree = useCallback(async (id) => {
    if (!id || !nodesRef.current[id]) return;
    const parents = [];
    let cur = nodesRef.current[id];
    while (cur?.parentId) {
      parents.push(cur.parentId);
      cur = nodesRef.current[cur.parentId];
    }
    for (const pid of parents.reverse()) {
      if (!childrenRef.current[pid]) {
        await loadFolder(pid);
      }
    }
    setExpandedIds((prev) => {
      const next = new Set(prev);
      parents.forEach((pid) => next.add(pid));
      if (projectId) next.add(projectId);
      return next;
    });
    setSelectedId(id);
    requestAnimationFrame(() => {
      document.querySelector(`[data-tree-id="${CSS.escape(id)}"]`)?.scrollIntoView({
        block: 'nearest',
      });
    });
  }, [loadFolder, projectId]);

  const listFilesFlat = useCallback(() => {
    return Object.values(nodesRef.current).filter((n) => n && !n.isFolder);
  }, []);

  const value = useMemo(() => ({
    ready,
    nodesById,
    childrenByParent,
    expandedIds,
    selectedId,
    setSelectedId,
    loadingIds,
    toggleExpand,
    createItem,
    deleteItem,
    renameItem,
    refreshFolder,
    loadFolder,
    getPath,
    revealInTree,
    listFilesFlat,
    projectId,
    projectName,
  }), [
    ready, nodesById, childrenByParent, expandedIds, selectedId, loadingIds,
    toggleExpand, createItem, deleteItem, renameItem, refreshFolder, loadFolder,
    getPath, revealInTree, listFilesFlat, projectId, projectName,
  ]);

  return <FileTreeContext.Provider value={value}>{children}</FileTreeContext.Provider>;
}

export function useFileTreeContext() {
  const ctx = useContext(FileTreeContext);
  if (!ctx) throw new Error('useFileTreeContext must be used within FileTreeProvider');
  return ctx;
}
