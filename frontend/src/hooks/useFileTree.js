/**
 * Orion IDE — useFileTree Hook
 *
 * Manages file tree state: loading, expanding, creating, deleting, renaming.
 * Auto-updates via notification events.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { driveService } from '../services/driveService';
import { on, off } from '../services/notificationService';

/**
 * @typedef {{ id: string, name: string, mimeType: string, isFolder: boolean, children: TreeNode[]|null, parentId: string|null }} TreeNode
 */

const useFileTree = () => {
  const [tree, setTree] = useState(null);          // Root tree node
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const rootIdRef = useRef(null);

  /**
   * Convert Drive API items to tree nodes.
   */
  const toNode = (item) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    isFolder: item.mimeType === 'application/vnd.google-apps.folder',
    children: item.mimeType === 'application/vnd.google-apps.folder' ? null : undefined,
    parentId: item.parents?.[0] || null,
    modifiedTime: item.modifiedTime,
    size: item.size,
  });

  /**
   * Load the project root folder.
   */
  const loadTree = useCallback(async (projectFolderId) => {
    setIsLoading(true);
    setError(null);
    rootIdRef.current = projectFolderId;

    try {
      const res = await driveService.listFiles(projectFolderId);
      const items = (res.data?.data?.files || res.data?.data || []).map(toNode);

      // Sort: folders first, then alphabetical
      items.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setTree({
        id: projectFolderId,
        name: 'OrionIDE',
        isFolder: true,
        children: items,
        parentId: null,
      });
      setExpandedFolders(new Set([projectFolderId]));
    } catch (err) {
      setError(err.message || 'Failed to load file tree');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Expand a folder (load children if not loaded).
   */
  const expandFolder = useCallback(async (folderId) => {
    const newExpanded = new Set(expandedFolders);

    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
      setExpandedFolders(newExpanded);
      return;
    }

    newExpanded.add(folderId);
    setExpandedFolders(newExpanded);

    // Load children if not yet loaded
    setTree((prev) => {
      if (!prev) return prev;
      return updateNodeChildren(prev, folderId, null, true);
    });

    try {
      const res = await driveService.listFiles(folderId);
      const items = (res.data?.data?.files || res.data?.data || []).map(toNode);
      items.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setTree((prev) => {
        if (!prev) return prev;
        return updateNodeChildren(prev, folderId, items, false);
      });
    } catch {
      // Collapse on error
      newExpanded.delete(folderId);
      setExpandedFolders(new Set(newExpanded));
    }
  }, [expandedFolders]);

  /**
   * Create a new file or folder.
   */
  const createItem = useCallback(async (parentFolderId, name, type = 'file') => {
    try {
      const res = await driveService.createFile(parentFolderId, name, type);
      const newItem = toNode(res.data?.data || res.data);

      // Add to tree
      setTree((prev) => {
        if (!prev) return prev;
        return addNodeChild(prev, parentFolderId, newItem);
      });

      // Auto-expand parent
      setExpandedFolders((prev) => new Set([...prev, parentFolderId]));
      return newItem;
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Delete a file or folder.
   */
  const deleteItem = useCallback(async (itemId) => {
    try {
      await driveService.deleteFile(itemId);
      setTree((prev) => {
        if (!prev) return prev;
        return removeNode(prev, itemId);
      });
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Rename a file or folder.
   */
  const renameItem = useCallback(async (itemId, newName) => {
    try {
      await driveService.renameFile(itemId, newName);
      setTree((prev) => {
        if (!prev) return prev;
        return renameNode(prev, itemId, newName);
      });
    } catch (err) {
      throw err;
    }
  }, []);

  /**
   * Refresh the tree from root.
   */
  const refreshTree = useCallback(() => {
    if (rootIdRef.current) loadTree(rootIdRef.current);
  }, [loadTree]);

  // ── Listen for Drive events to auto-update ─────────────────────────
  useEffect(() => {
    const handleCreated = (event) => {
      const item = event?.payload;
      if (item && item.parentId) {
        setTree((prev) => {
          if (!prev) return prev;
          return addNodeChild(prev, item.parentId, toNode(item));
        });
      }
    };

    const handleDeleted = (event) => {
      const fileId = event?.payload?.fileId;
      if (fileId) {
        setTree((prev) => {
          if (!prev) return prev;
          return removeNode(prev, fileId);
        });
      }
    };

    on('DRIVE_FILE_CREATED', handleCreated);
    on('DRIVE_FILE_DELETED', handleDeleted);

    return () => {
      off('DRIVE_FILE_CREATED', handleCreated);
      off('DRIVE_FILE_DELETED', handleDeleted);
    };
  }, []);

  return {
    tree,
    expandedFolders,
    isLoading,
    error,
    loadTree,
    expandFolder,
    createItem,
    deleteItem,
    renameItem,
    refreshTree,
  };
};

// ── Tree manipulation helpers ─────────────────────────────────────────────

function updateNodeChildren(node, targetId, children, loading) {
  if (node.id === targetId) {
    return { ...node, children: children || node.children, _loading: loading };
  }
  if (node.children) {
    return { ...node, children: node.children.map((c) => updateNodeChildren(c, targetId, children, loading)) };
  }
  return node;
}

function addNodeChild(node, parentId, child) {
  if (node.id === parentId) {
    const existing = node.children || [];
    if (existing.find((c) => c.id === child.id)) return node;
    const newChildren = [...existing, child];
    newChildren.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return { ...node, children: newChildren };
  }
  if (node.children) {
    return { ...node, children: node.children.map((c) => addNodeChild(c, parentId, child)) };
  }
  return node;
}

function removeNode(node, targetId) {
  if (node.id === targetId) return null;
  if (node.children) {
    return { ...node, children: node.children.map((c) => removeNode(c, targetId)).filter(Boolean) };
  }
  return node;
}

function renameNode(node, targetId, newName) {
  if (node.id === targetId) return { ...node, name: newName };
  if (node.children) {
    return { ...node, children: node.children.map((c) => renameNode(c, targetId, newName)) };
  }
  return node;
}

export default useFileTree;
