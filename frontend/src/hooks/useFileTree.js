import { useCallback, useEffect, useRef, useState } from 'react';
import * as driveService from '../services/driveService';
import { getLanguageByFileName } from '../utils/languageMap';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

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

export function useFileTree(projectId, projectName) {
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
    insertNode(node);
    setSelectedId(node.id);
    return node;
  }, [resolveParentForNew, siblingClash, expandedIds, loadFolder, insertNode]);

  const deleteItem = useCallback(async (id) => {
    await driveService.deleteFile(id);
    if (selectedId === id) setSelectedId(null);
    setNodesById((prev) => {
      const next = { ...prev };
      delete next[id];
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
  }, [selectedId]);

  const refreshFolder = useCallback((id) => loadFolder(id || projectId), [loadFolder, projectId]);

  return {
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
    refreshFolder,
    projectId,
  };
}
