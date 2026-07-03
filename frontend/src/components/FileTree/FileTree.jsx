/**
 * Orion IDE — File Tree Component
 *
 * Recursive tree with folder expand/collapse, file icons,
 * right-click context menu, inline rename, and loading skeletons.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor } from '../../context/EditorContext';
import { getLanguageFromFileName } from '../../utils/languageMap';
import NewFileDialog from './NewFileDialog';

import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode2,
  RefreshCw,
  FilePlus,
  FolderPlus
} from 'lucide-react';

/* ── Context Menu ─────────────────────────────────────────────────────── */

const ContextMenu = ({ x, y, options, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'fixed', left: x, top: y, zIndex: 1000,
      background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
      padding: '4px 0', minWidth: 160,
      boxShadow: 'var(--shadow-md)',
      fontFamily: 'var(--font-ui)', fontSize: 'var(--font-size-md)',
    }}>
      {options.map((opt, i) =>
        opt.separator ? (
          <div key={i} style={{ height: 1, background: 'var(--bg-emphasis)', margin: '4px 0' }} />
        ) : (
          <div
            key={i}
            onClick={() => { opt.action(); onClose(); }}
            style={{
              padding: '6px 12px', cursor: 'pointer', color: opt.danger ? 'var(--accent-red-emphasis)' : 'var(--text-primary)',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {opt.icon && <span style={{ display: 'flex', color: 'var(--text-muted)' }}>{opt.icon}</span>}
            {opt.label}
          </div>
        )
      )}
    </div>
  );
};

/* ── Tree Node ────────────────────────────────────────────────────────── */

const TreeNode = ({ node, depth, expandedFolders, onToggleFolder, onClickFile, onCreateItem, onDelete, onRename, activeFileId }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [contextMenu, setContextMenu] = useState(null);
  const inputRef = useRef(null);

  const isExpanded = expandedFolders.has(node.id);
  const langInfo = !node.isFolder ? getLanguageFromFileName(node.name) : null;
  const isActiveFile = activeFileId === node.id;

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = () => {
    if (node.isFolder) {
      onToggleFolder(node.id);
    } else {
      onClickFile(node.id, node.name);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== node.name) {
      onRename(node.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const contextOptions = node.isFolder
    ? [
        { label: 'New File', icon: <FilePlus size={14} />, action: () => onCreateItem(node.id, 'file') },
        { label: 'New Folder', icon: <FolderPlus size={14} />, action: () => onCreateItem(node.id, 'folder') },
        { separator: true },
        { label: 'Rename', action: () => { setRenameValue(node.name); setIsRenaming(true); } },
        { label: 'Delete', action: () => onDelete(node.id, node.name), danger: true },
      ]
    : [
        { label: 'Rename', action: () => { setRenameValue(node.name); setIsRenaming(true); } },
        { separator: true },
        { label: 'Delete', action: () => onDelete(node.id, node.name), danger: true },
      ];

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', paddingLeft: 8 + depth * 16,
          cursor: 'pointer', fontSize: 'var(--font-size-md)',
          color: isActiveFile ? 'var(--text-primary)' : 'var(--text-secondary)',
          background: isActiveFile ? 'rgba(31, 111, 235, 0.08)' : 'transparent',
          borderLeft: isActiveFile ? '2px solid var(--accent-blue-subtle)' : '2px solid transparent',
          transition: 'all var(--transition-fast)',
          userSelect: 'none', borderRadius: 'var(--radius-sm)',
          margin: '1px 4px',
        }}
        onMouseEnter={(e) => {
          if (!isActiveFile) {
            e.currentTarget.style.background = 'var(--bg-subtle)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActiveFile) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
      >
        {/* Chevron for folders */}
        <span style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', opacity: node.isFolder ? 1 : 0 }}>
          {node.isFolder && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </span>

        {/* Icon */}
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {node.isFolder
            ? (isExpanded ? <FolderOpen size={14} color="var(--accent-blue-subtle)" /> : <Folder size={14} color="var(--text-muted)" />)
            : <FileCode2 size={14} color={langInfo?.color || 'var(--text-muted)'} />
          }
        </span>

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, background: 'var(--bg-default)', border: '1px solid var(--border-active)',
              color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '1px 6px',
              fontSize: 'var(--font-size-md)', fontFamily: 'var(--font-ui)', outline: 'none',
            }}
          />
        ) : (
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontWeight: node.isFolder && depth === 0 ? 600 : 400,
          }}>
            {node.name}
          </span>
        )}

        {/* Language badge for files */}
        {!node.isFolder && langInfo && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: langInfo.color,
            fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto', flexShrink: 0,
          }}>
            {langInfo.icon}
          </span>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          options={contextOptions}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Children */}
      {node.isFolder && isExpanded && node.children && (
        <>
          {node._loading && (
            <LoadingSkeleton depth={depth + 1} />
          )}
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onClickFile={onClickFile}
              onCreateItem={onCreateItem}
              onDelete={onDelete}
              onRename={onRename}
              activeFileId={activeFileId}
            />
          ))}
        </>
      )}
    </>
  );
};

/* ── Loading Skeleton ─────────────────────────────────────────────────── */

const LoadingSkeleton = ({ depth }) => (
  <>
    {[1, 2, 3].map((i) => (
      <div key={i} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px', paddingLeft: 8 + (depth || 0) * 16,
      }}>
        <div style={{ width: 14 + Math.random() * 80, height: 10, background: 'var(--bg-emphasis)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
      </div>
    ))}
  </>
);

const ActionButton = ({ title, onClick, children }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'var(--bg-emphasis)' : 'transparent',
        border: 'none',
        color: hover ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        padding: 4,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        transition: 'all var(--transition-fast)',
      }}
    >
      {children}
    </button>
  );
};

/* ── FileTree Main ────────────────────────────────────────────────────── */

const FileTree = ({ tree, expandedFolders, isLoading, error, onToggleFolder, onCreateItem, onDeleteItem, onRenameItem, onRefresh }) => {
  const { openFile, activeFileId } = useEditor();
  const [newFileDialog, setNewFileDialog] = useState({ open: false, parentId: null, type: 'file' });

  const handleClickFile = useCallback((fileId, fileName) => {
    openFile(fileId, fileName);
  }, [openFile]);

  const handleCreateItem = useCallback((parentId, type) => {
    if (type === 'folder') {
      const name = window.prompt('Enter folder name:');
      if (name?.trim()) {
        onCreateItem(parentId, name.trim(), type);
      }
    } else {
      setNewFileDialog({ open: true, parentId, type: 'file' });
    }
  }, [onCreateItem]);

  const handleCreateFromDialog = useCallback((fileName, lang) => {
    if (newFileDialog.parentId && fileName) {
      onCreateItem(newFileDialog.parentId, fileName, 'file');
    }
  }, [newFileDialog.parentId, onCreateItem]);

  const handleDelete = useCallback((itemId, itemName) => {
    if (window.confirm(`Delete "${itemName}"? This action moves the file to trash.`)) {
      onDeleteItem(itemId);
    }
  }, [onDeleteItem]);

  if (isLoading && !tree) {
    return (
      <div style={{ padding: 8 }}>
        <LoadingSkeleton depth={0} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: 16, fontSize: 13, color: 'var(--accent-red-emphasis)',
        fontFamily: "'Inter', sans-serif", textAlign: 'center',
      }}>
        <div style={{ marginBottom: 8 }}>{error}</div>
        <button onClick={onRefresh} style={{
          background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-muted)',
          padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
        }}>
          Retry
        </button>
      </div>
    );
  }

  if (!tree) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, fontSize: 13, color: 'var(--border-emphasis)',
        fontFamily: "'Inter', sans-serif", textAlign: 'center',
      }}>
        <div>
          <Folder size={32} color="var(--border-emphasis)" style={{ margin: '0 auto 12px', display: 'block' }} />
          <div>No project open</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header with actions */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', position: 'sticky', top: 0, background: 'var(--bg-canvas)', zIndex: 1,
        borderBottom: '1px solid var(--border-default)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {tree.name}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <ActionButton title="New File" onClick={() => handleCreateItem(tree.id, 'file')}>
            <FilePlus size={14} />
          </ActionButton>
          <ActionButton title="New Folder" onClick={() => handleCreateItem(tree.id, 'folder')}>
            <FolderPlus size={14} />
          </ActionButton>
          <ActionButton title="Refresh" onClick={onRefresh}>
            <RefreshCw size={14} />
          </ActionButton>
        </div>
      </div>

      {/* Tree nodes */}
      {tree.children?.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={0}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          onClickFile={handleClickFile}
          onCreateItem={handleCreateItem}
          onDelete={handleDelete}
          onRename={onRenameItem}
          activeFileId={activeFileId}
        />
      ))}

      {tree.children?.length === 0 && (
        <div style={{ padding: '16px 8px', fontSize: 13, color: 'var(--border-emphasis)', textAlign: 'center' }}>
          Empty folder
        </div>
      )}

      {/* New File Dialog */}
      <NewFileDialog
        isOpen={newFileDialog.open}
        onClose={() => setNewFileDialog({ open: false, parentId: null, type: 'file' })}
        onCreate={handleCreateFromDialog}
      />
    </div>
  );
};

const actionBtnStyle = {
  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
  padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
};

export default FileTree;
