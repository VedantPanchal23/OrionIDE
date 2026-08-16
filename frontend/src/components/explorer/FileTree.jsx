import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronRight, FilePlus, FolderPlus, MoreHorizontal, Pencil, RefreshCw, Trash2,
} from 'lucide-react';
import { useFileTreeContext } from '../../context/FileTreeContext';
import { useEditor } from '../../context/EditorContext';
import { useToast } from '../../context/ToastContext';
import { FileIcon, FolderIcon } from '../../utils/fileIcons';
import { IconButton, Spinner } from '../ui/primitives';
import ConfirmModal from '../ui/ConfirmModal';
import { useGitDecorations, gitGlyphForNode, gitGlyphClass } from '../../hooks/useGitDecorations';

const INDENT = 12;

function flattenVisible(id, tree, out = []) {
  out.push(id);
  const node = tree.nodesById[id];
  if (node?.isFolder && tree.expandedIds.has(id)) {
    (tree.childrenByParent[id] || []).forEach((cid) => flattenVisible(cid, tree, out));
  }
  return out;
}

function TreeNode({
  id, depth = 0, onOpen, onContext, renamingId, renameValue, setRenameValue, onRenameSubmit, onRenameCancel,
  gitDecorations,
}) {
  const tree = useFileTreeContext();
  const node = tree.nodesById[id];
  if (!node) return null;
  const kids = tree.childrenByParent[id] || [];
  const expanded = tree.expandedIds.has(id);
  const selected = tree.selectedId === id;
  const loading = tree.loadingIds.has(id);
  const renaming = renamingId === id;
  const gitGlyph = gitGlyphForNode(gitDecorations, tree, node);

  return (
    <div>
      <button
        type="button"
        data-tree-id={id}
        className={[
          'tree-row',
          selected ? 'selected' : '',
          node.isFolder ? 'is-folder' : 'is-file',
          depth === 0 ? 'is-root' : '',
          renaming ? 'renaming' : '',
        ].filter(Boolean).join(' ')}
        style={{ paddingLeft: 8 + depth * INDENT }}
        onClick={() => {
          if (renaming) return;
          tree.setSelectedId(id);
          if (node.isFolder) tree.toggleExpand(id);
          else onOpen(node);
        }}
        onDoubleClick={() => {
          if (renaming) return;
          if (!node.isFolder) onOpen(node);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          tree.setSelectedId(id);
          onContext?.(e, node);
        }}
      >
        {depth > 0 && (
          <span className="tree-indent-guides" aria-hidden="true" style={{ left: 8 }}>
            {Array.from({ length: depth }, (_, i) => <span key={i} />)}
          </span>
        )}
        <span className={`chev ${expanded ? 'open' : ''}`} aria-hidden="true">
          {node.isFolder
            ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            : <span className="chev-spacer" />}
        </span>
        <span className="tree-icon" aria-hidden="true">
          {node.isFolder
            ? <FolderIcon open={expanded} size={15} />
            : <FileIcon name={node.name} size={16} />}
        </span>
        {renaming ? (
          <input
            className="tree-rename-input"
            value={renameValue}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') onRenameSubmit();
              if (e.key === 'Escape') onRenameCancel();
            }}
            onBlur={() => onRenameSubmit()}
          />
        ) : (
          <span className="tree-name" title={node.name}>{node.name}</span>
        )}
        {gitGlyph && (
          <span className={`tree-git-glyph ${gitGlyphClass(gitGlyph)}`} title={`Git: ${gitGlyph}`} aria-hidden="true">
            {gitGlyph}
          </span>
        )}
        {loading && <Spinner size={11} />}
      </button>
      {node.isFolder && expanded && kids.map((cid) => (
        <TreeNode
          key={cid}
          id={cid}
          depth={depth + 1}
          onOpen={onOpen}
          onContext={onContext}
          renamingId={renamingId}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onRenameSubmit={onRenameSubmit}
          onRenameCancel={onRenameCancel}
          gitDecorations={gitDecorations}
        />
      ))}
    </div>
  );
}

export default function FileTree({ projectId }) {
  const tree = useFileTreeContext();
  const { openFile, openToSide, closeFile, openFiles, activeFileId, focusedFile, renameOpenFile } = useEditor();
  const toast = useToast();
  const [prompt, setPrompt] = useState(null);
  const [menu, setMenu] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const treeRef = useRef(null);
  const lastRevealed = useRef(null);
  const { decorations: gitDecorations } = useGitDecorations(projectId);

  const deleteMessage = useMemo(() => {
    if (!pendingDelete) return '';
    const parts = (tree.getPath(pendingDelete.id) || []).map((n) => n.name);
    const rel = parts.length > 1 ? parts.slice(1).join('/') : pendingDelete.name;
    if (pendingDelete.isFolder) {
      return `Delete folder "${rel}" and everything inside it? This cannot be undone.`;
    }
    return `Delete "${rel}"? This cannot be undone.`;
  }, [pendingDelete, tree]);

  const visibleIds = useMemo(
    () => (tree.ready ? flattenVisible(projectId, tree) : []),
    [tree, projectId],
  );

  const activeId = focusedFile?.id || activeFileId;
  useEffect(() => {
    if (!activeId || !tree.ready || !tree.nodesById[activeId]) return;
    if (lastRevealed.current === activeId) return;
    lastRevealed.current = activeId;
    tree.revealInTree(activeId);
  }, [activeId, tree]);

  const submitCreate = async () => {
    if (!prompt?.name?.trim()) return;
    try {
      const node = await tree.createItem(prompt.name.trim(), prompt.type);
      toast.success(`${prompt.type === 'folder' ? 'Folder' : 'File'} created`);
      setPrompt(null);
      if (!node.isFolder) await openFile(node);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err.message);
    }
  };

  const startRename = useCallback((node) => {
    const target = node || tree.nodesById[tree.selectedId];
    if (!target || target.id === projectId) return;
    setRenamingId(target.id);
    setRenameValue(target.name);
    tree.setSelectedId(target.id);
  }, [tree, projectId]);

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const submitRename = async () => {
    if (!renamingId) return;
    const target = tree.nodesById[renamingId];
    const next = renameValue.trim();
    if (!target || !next || next === target.name) {
      cancelRename();
      return;
    }
    try {
      await tree.renameItem(renamingId, next);
      renameOpenFile(renamingId, next);
      toast.success('Renamed');
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err.message);
    } finally {
      cancelRename();
    }
  };

  const requestDelete = (node) => {
    const target = node || tree.nodesById[tree.selectedId];
    if (!target || target.id === projectId) return;
    setPendingDelete(target);
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await tree.deleteItem(target.id);
      openFiles.forEach((f) => {
        if (f.id === target.id) {
          closeFile(f.id, { force: true });
          return;
        }
        if (!target.isFolder) return;
        const path = tree.getPath(f.id) || [];
        if (path.some((n) => n.id === target.id)) {
          closeFile(f.id, { force: true });
        }
      });
      toast.success('Deleted');
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err.message);
    }
  };

  const onKeyDown = (e) => {
    if (renamingId) return;
    if (!visibleIds.length) return;
    const idx = Math.max(0, visibleIds.indexOf(tree.selectedId));
    const sel = tree.nodesById[tree.selectedId] || tree.nodesById[visibleIds[0]];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = visibleIds[Math.min(visibleIds.length - 1, idx + 1)];
      tree.setSelectedId(next);
      requestAnimationFrame(() => {
        document.querySelector(`[data-tree-id="${CSS.escape(next)}"]`)?.scrollIntoView({ block: 'nearest' });
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = visibleIds[Math.max(0, idx - 1)];
      tree.setSelectedId(next);
      requestAnimationFrame(() => {
        document.querySelector(`[data-tree-id="${CSS.escape(next)}"]`)?.scrollIntoView({ block: 'nearest' });
      });
    } else if (e.key === 'Home') {
      e.preventDefault();
      const next = visibleIds[0];
      if (next) {
        tree.setSelectedId(next);
        requestAnimationFrame(() => {
          document.querySelector(`[data-tree-id="${CSS.escape(next)}"]`)?.scrollIntoView({ block: 'nearest' });
        });
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      const next = visibleIds[visibleIds.length - 1];
      if (next) {
        tree.setSelectedId(next);
        requestAnimationFrame(() => {
          document.querySelector(`[data-tree-id="${CSS.escape(next)}"]`)?.scrollIntoView({ block: 'nearest' });
        });
      }
    } else if (e.key === 'ArrowRight' && sel?.isFolder) {
      e.preventDefault();
      if (!tree.expandedIds.has(sel.id)) tree.toggleExpand(sel.id);
      else {
        const kids = tree.childrenByParent[sel.id] || [];
        if (kids[0]) tree.setSelectedId(kids[0]);
      }
    } else if (e.key === 'ArrowLeft' && sel) {
      e.preventDefault();
      if (sel.isFolder && tree.expandedIds.has(sel.id)) tree.toggleExpand(sel.id);
      else if (sel.parentId) tree.setSelectedId(sel.parentId);
    } else if (e.key === 'Enter' && sel) {
      e.preventDefault();
      if (sel.isFolder) tree.toggleExpand(sel.id);
      else openFile(sel).catch((err) => toast.error(err.message));
    } else if (e.key === 'F2' && sel) {
      e.preventDefault();
      startRename(sel);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel && sel.id !== projectId && (e.metaKey || e.ctrlKey || e.key === 'Delete')) {
      if (e.key === 'Delete') {
        e.preventDefault();
        requestDelete(sel);
      }
    }
  };

  return (
    <div className="side-panel">
      <div className="ide-sidebar-title sticky-title">
        <span>Explorer</span>
        <span className="title-actions">
          <IconButton title="New File" onClick={() => setPrompt({ type: 'file', name: '' })}>
            <FilePlus size={14} />
          </IconButton>
          <IconButton title="New Folder" onClick={() => setPrompt({ type: 'folder', name: '' })}>
            <FolderPlus size={14} />
          </IconButton>
          <IconButton title="Refresh" onClick={() => tree.refreshFolder(projectId)}>
            <RefreshCw size={14} />
          </IconButton>
          <IconButton title="More" onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, node: tree.nodesById[tree.selectedId] })}>
            <MoreHorizontal size={14} />
          </IconButton>
        </span>
      </div>

      {prompt && (
        <div className="inline-prompt">
          <input
            autoFocus
            value={prompt.name}
            placeholder={prompt.type === 'folder' ? 'Folder name' : 'File name (e.g. main.py)'}
            onChange={(e) => setPrompt({ ...prompt, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') setPrompt(null);
            }}
            onBlur={() => { if (!prompt.name.trim()) setPrompt(null); }}
          />
        </div>
      )}

      <div
        className="tree"
        ref={treeRef}
        tabIndex={0}
        role="tree"
        onKeyDown={onKeyDown}
      >
        {!tree.ready ? (
          <div className="side-empty"><Spinner /></div>
        ) : (
          <TreeNode
            id={projectId}
            depth={0}
            onOpen={(node) => openFile(node).catch((err) => toast.error(err.message))}
            onContext={(e, node) => setMenu({ x: e.clientX, y: e.clientY, node })}
            renamingId={renamingId}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            onRenameSubmit={submitRename}
            onRenameCancel={cancelRename}
            gitDecorations={gitDecorations}
          />
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: 'Open',
              onClick: () => menu.node && !menu.node.isFolder && openFile(menu.node),
              disabled: !menu.node || menu.node.isFolder,
            },
            {
              label: 'Open to the Side',
              onClick: () => menu.node && !menu.node.isFolder && openToSide(menu.node),
              disabled: !menu.node || menu.node.isFolder,
            },
            { label: 'New File', onClick: () => setPrompt({ type: 'file', name: '' }) },
            { label: 'New Folder', onClick: () => setPrompt({ type: 'folder', name: '' }) },
            {
              label: 'Rename',
              onClick: () => startRename(menu.node),
              disabled: !menu.node || menu.node.id === projectId,
            },
            {
              label: 'Delete',
              onClick: () => requestDelete(menu.node),
              danger: true,
              disabled: !menu.node || menu.node.id === projectId,
            },
            { label: 'Refresh', onClick: () => tree.refreshFolder(menu.node?.isFolder ? menu.node.id : projectId) },
          ]}
        />
      )}

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={pendingDelete?.isFolder ? 'Delete folder' : 'Delete'}
        message={deleteMessage}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ContextMenu({ x, y, items, onClose }) {
  return (
    <>
      <button type="button" className="ctx-backdrop" aria-label="Close menu" onClick={onClose} />
      <ul className="ctx-menu" style={{ left: x, top: y }}>
        {items.map((it) => (
          <li key={it.label}>
            <button
              type="button"
              className={`ctx-item ${it.danger ? 'danger' : ''}`}
              disabled={it.disabled}
              onClick={() => { onClose(); it.onClick?.(); }}
            >
              {it.label === 'Rename' && <Pencil size={12} />}
              {it.label === 'Delete' && <Trash2 size={12} />}
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
