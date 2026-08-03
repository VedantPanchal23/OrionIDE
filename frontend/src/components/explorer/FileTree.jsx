/**
 * Orion IDE — Explorer file tree
 */

import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, File, FileCode,
  FilePlus, FolderPlus, RefreshCw, Trash2, Pencil,
} from 'lucide-react';
import { useFileTree } from '../../hooks/useFileTree';
import { useEditor } from '../../context/EditorContext';
import { useToast } from '../../context/ToastContext';
import { getLanguageAbbr } from '../../utils/languageMap';
import { IconButton, Spinner, EmptyState } from '../ui/primitives';
import ConfirmModal from '../ui/ConfirmModal';

const INDENT = 16;

function fileIcon(name) {
  const abbr = getLanguageAbbr(name);
  return abbr && abbr !== 'TXT' ? <FileCode size={14} /> : <File size={14} />;
}

function friendlyError(err, fallback) {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

const FileTree = forwardRef(function FileTree({ projectId, projectName }, ref) {
  const tree = useFileTree(projectId, projectName);
  const { openFile } = useEditor();
  const toast = useToast();
  const [menu, setMenu] = useState(null); // { x, y, targetId }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  const handleSelect = useCallback((node) => {
    tree.setSelectedId(node.id);
    if (node.isFolder) {
      tree.toggleExpand(node.id);
    } else {
      openFile({ id: node.id, name: node.name, parentId: node.parentId }).catch((err) => {
        toast.error(friendlyError(err, 'Failed to open file'));
      });
    }
  }, [tree, openFile, toast]);

  const beginCreate = useCallback((type, parentIdOverride) => {
    const parentId = parentIdOverride || tree.resolveParentForNew();
    tree.expand(parentId);
    tree.setSelectedId(parentId);
    tree.setEditingId(`new:${parentId}:${type}`);
    setMenu(null);
  }, [tree]);

  useImperativeHandle(ref, () => ({
    newFile: () => beginCreate('file'),
    newFolder: () => beginCreate('folder'),
    refresh: () => tree.refreshFolder(tree.resolveParentForNew()),
  }), [beginCreate, tree]);

  const submitCreate = useCallback(async (parentId, type, name) => {
    if (!name.trim()) { tree.setEditingId(null); return; }
    try {
      const node = await tree.createItem(name, type, parentId);
      tree.setEditingId(null);
      if (!node.isFolder) {
        openFile({ id: node.id, name: node.name, parentId: node.parentId }).catch(() => {});
      }
    } catch (err) {
      toast.error(friendlyError(err, `Failed to create ${type}`));
      if (err.code === 'DUPLICATE') return; // keep editing so the user can rename
      tree.setEditingId(null);
    }
  }, [tree, toast, openFile]);

  const submitRename = useCallback(async (id, name) => {
    try {
      await tree.renameItem(id, name);
    } catch (err) {
      toast.error(friendlyError(err, 'Rename failed'));
    } finally {
      tree.setEditingId(null);
    }
  }, [tree, toast]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await tree.deleteItem(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}"`);
    } catch (err) {
      toast.error(friendlyError(err, 'Delete failed'));
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, tree, toast]);

  const openMenu = useCallback((e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    tree.setSelectedId(targetId);
    setMenu({ x: e.clientX, y: e.clientY, targetId });
  }, [tree]);

  const renderInlineInput = (parentId, type, depth) => (
    <InlineInput
      depth={depth}
      isFolder={type === 'folder'}
      placeholder={type === 'folder' ? 'Folder name' : 'File name'}
      onSubmit={(name) => submitCreate(parentId, type, name)}
      onCancel={() => tree.setEditingId(null)}
    />
  );

  const renderNode = (id, depth) => {
    const node = tree.nodesById[id];
    if (!node) return null;
    const isExpanded = tree.expandedIds.has(id);
    const isEditing = tree.editingId === id;
    const isLoading = tree.loadingIds.has(id);
    const childIds = tree.childrenByParent[id] || [];
    const pendingNew = tree.editingId && tree.editingId.startsWith(`new:${id}:`)
      ? tree.editingId.split(':')[2]
      : null;

    return (
      <div key={id}>
        <div
          className={`tree-row ${tree.selectedId === id ? 'selected' : ''}`}
          style={{ paddingLeft: 6 + depth * INDENT }}
          onClick={() => (isEditing ? null : handleSelect(node))}
          onContextMenu={(e) => openMenu(e, id)}
          title={node.name}
        >
          {node.isFolder ? (
            <span className="tree-chevron">
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
          ) : (
            <span className="tree-chevron" />
          )}
          <span className={`tree-icon ${node.isFolder ? 'folder' : ''}`}>
            {node.isFolder
              ? (isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />)
              : fileIcon(node.name)}
          </span>
          {isEditing ? (
            <RenameInput
              initial={node.name}
              onSubmit={(name) => submitRename(id, name)}
              onCancel={() => tree.setEditingId(null)}
            />
          ) : (
            <span className="tree-name">{node.name}</span>
          )}
          {isLoading && <Spinner size={11} />}
        </div>
        {node.isFolder && isExpanded && (
          <div>
            {childIds.map((cid) => renderNode(cid, depth + 1))}
            {pendingNew && renderInlineInput(id, pendingNew, depth + 1)}
            {!isLoading && childIds.length === 0 && !pendingNew && (
              <div className="tree-row" style={{ paddingLeft: 6 + (depth + 1) * INDENT, color: 'var(--text-muted)', cursor: 'default' }}>
                <span className="tree-chevron" />
                <span style={{ fontSize: 11 }}>Empty</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const rootChildIds = tree.childrenByParent[projectId] || [];
  const rootPendingNew = tree.editingId && tree.editingId.startsWith(`new:${projectId}:`)
    ? tree.editingId.split(':')[2]
    : null;
  const menuNode = menu ? tree.nodesById[menu.targetId] : null;

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      onContextMenu={(e) => { if (e.target === containerRef.current) openMenu(e, projectId); }}
    >
      <div className="o-panel-header">
        <span className="o-panel-title">{projectName || 'Explorer'}</span>
        <div className="explorer-toolbar">
          <IconButton title="New File" onClick={() => beginCreate('file')}><FilePlus size={14} /></IconButton>
          <IconButton title="New Folder" onClick={() => beginCreate('folder')}><FolderPlus size={14} /></IconButton>
          <IconButton title="Refresh" onClick={() => tree.refreshFolder(tree.resolveParentForNew())}><RefreshCw size={13} /></IconButton>
        </div>
      </div>
      <div className="ide-sidebar-body" onClick={() => tree.setSelectedId(projectId)}>
        {!tree.ready ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
        ) : rootChildIds.length === 0 && !rootPendingNew ? (
          <EmptyState title="No files yet" hint="Create a file to get started." />
        ) : (
          <>
            {rootChildIds.map((id) => renderNode(id, 0))}
            {rootPendingNew && renderInlineInput(projectId, rootPendingNew, 0)}
          </>
        )}
      </div>

      {menu && (
        <div className="ctx-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="ctx-item" onClick={() => beginCreate('file', menuNode?.isFolder ? menu.targetId : menuNode?.parentId)}>
            <FilePlus size={13} style={{ marginRight: 8 }} /> New File
          </button>
          <button type="button" className="ctx-item" onClick={() => beginCreate('folder', menuNode?.isFolder ? menu.targetId : menuNode?.parentId)}>
            <FolderPlus size={13} style={{ marginRight: 8 }} /> New Folder
          </button>
          {menuNode && menuNode.id !== projectId && (
            <>
              <div className="ctx-sep" />
              <button type="button" className="ctx-item" onClick={() => { tree.setEditingId(menu.targetId); setMenu(null); }}>
                <Pencil size={13} style={{ marginRight: 8 }} /> Rename
              </button>
              <button
                type="button"
                className="ctx-item"
                style={{ color: 'var(--danger)' }}
                onClick={() => { setDeleteTarget(menuNode); setMenu(null); }}
              >
                <Trash2 size={13} style={{ marginRight: 8 }} /> Delete
              </button>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Delete "${deleteTarget?.name}"?`}
        message={deleteTarget?.isFolder
          ? 'This folder and its contents will be moved to Drive trash.'
          : 'This file will be moved to Drive trash.'}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
});

export default FileTree;

function RenameInput({ initial, onSubmit, onCancel }) {
  const ref = useRef(null);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className="tree-input"
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSubmit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit(value);
        if (e.key === 'Escape') onCancel();
      }}
    />
  );
}

function InlineInput({ depth, isFolder, placeholder, onSubmit, onCancel }) {
  const ref = useRef(null);
  const [value, setValue] = useState('');

  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="tree-row" style={{ paddingLeft: 6 + depth * INDENT }}>
      <span className="tree-chevron" />
      <span className={`tree-icon ${isFolder ? 'folder' : ''}`}>
        {isFolder ? <Folder size={14} /> : <File size={14} />}
      </span>
      <input
        ref={ref}
        className="tree-input"
        placeholder={placeholder}
        value={value}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSubmit(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(value);
          if (e.key === 'Escape') onCancel();
        }}
      />
    </div>
  );
}
