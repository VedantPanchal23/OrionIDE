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
  FolderPlus,
  FileJson,
  FileCog,
  FileText,
  Terminal,
  Image as ImageIcon
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
      background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: 6,
      padding: '4px 0', minWidth: 160,
      boxShadow: 'var(--shadow-lg)',
      fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-primary)'
    }}>
      {options.map((opt, i) =>
        opt.separator ? (
          <div key={i} style={{ height: 1, background: 'var(--border-default)', margin: '4px 0' }} />
        ) : (
          <div
            key={i}
            onClick={() => { opt.action(); onClose(); }}
            style={{
              padding: '4px 24px 4px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-blue)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{opt.label}</span>
            </div>
            {opt.shortcut && <span style={{ fontSize: 11, opacity: 0.6 }}>{opt.shortcut}</span>}
          </div>
        )
      )}
    </div>
  );
};

/* ── Tree Node ────────────────────────────────────────────────────────── */

const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'jsx': return <FileCode2 size={14} color="#61dafb" />;
    case 'js': return <FileCode2 size={14} color="#f7df1e" />;
    case 'ts': case 'tsx': return <FileCode2 size={14} color="#3178c6" />;
    case 'css': return <FileCode2 size={14} color="#264de4" />;
    case 'html': return <FileCode2 size={14} color="#e34c26" />;
    case 'json': return <FileJson size={14} color="#cbcb41" />;
    case 'env': case 'gitignore': case 'dockerfile': return <FileCog size={14} color="#6a9955" />;
    case 'md': return <FileText size={14} color="#083fa1" />;
    case 'sh': case 'bash': return <Terminal size={14} color="#4EAA25" />;
    case 'png': case 'jpg': case 'jpeg': case 'svg': case 'gif': return <ImageIcon size={14} color="#a074c4" />;
    default: return <FileText size={14} color="#cccccc" />;
  }
};

const TreeNode = ({ node, depth, expandedFolders, onToggleFolder, onClickFile, onCreateItem, onDelete, onRename, activeFileId }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [contextMenu, setContextMenu] = useState(null);
  const inputRef = useRef(null);

  const isExpanded = expandedFolders.has(node.id);
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
        { label: 'New File...', action: () => onCreateItem(node.id, 'file') },
        { label: 'New Folder...', action: () => onCreateItem(node.id, 'folder') },
        { separator: true },
        { label: 'Rename', action: () => { setRenameValue(node.name); setIsRenaming(true); }, shortcut: 'F2' },
        { label: 'Delete', action: () => onDelete(node.id, node.name) },
      ]
    : [
        { label: 'Rename', action: () => { setRenameValue(node.name); setIsRenaming(true); }, shortcut: 'F2' },
        { separator: true },
        { label: 'Delete', action: () => onDelete(node.id, node.name) },
      ];

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', paddingLeft: 8 + depth * 12,
          cursor: 'pointer', fontSize: 13,
          color: isActiveFile ? '#ffffff' : '#cccccc',
          background: isActiveFile ? '#37373d' : 'transparent',
          border: '1px solid transparent',
        }}
        onMouseEnter={(e) => {
          if (!isActiveFile) {
            e.currentTarget.style.background = '#2a2d2e';
            e.currentTarget.style.color = '#ffffff';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActiveFile) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#cccccc';
          }
        }}
      >
        {/* Chevron for folders */}
        <span style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {node.isFolder ? (isExpanded ? <ChevronDown size={14} color="#cccccc" /> : <ChevronRight size={14} color="#cccccc" />) : <span style={{ width: 14 }} />}
        </span>

        {/* Icon */}
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: 2 }}>
          {node.isFolder
            ? (isExpanded ? <FolderOpen size={14} color="#dcb67a" /> : <Folder size={14} color="#dcb67a" />)
            : getFileIcon(node.name)
          }
        </span>

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
              flex: 1, background: 'var(--bg-emphasis)', border: '1px solid var(--accent-blue)',
              color: '#cccccc', padding: '0 2px',
              fontSize: 'inherit', fontFamily: 'inherit', outline: 'none', height: 20,
            }}
          />
        ) : (
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {node.name}
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
        padding: '2px 8px', paddingLeft: 8 + (depth || 0) * 12,
      }}>
        <div style={{ width: 14 + Math.random() * 80, height: 10, background: 'var(--bg-emphasis)', borderRadius: 2 }} />
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
        transition: 'all 0.1s',
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
  const [isHoveringHeader, setIsHoveringHeader] = useState(false);

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
      onDeleteItem(itemId, itemName);
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
      <div style={{ padding: 16, fontSize: 13, color: 'var(--error)', textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>{error}</div>
        <button onClick={onRefresh} style={{
          background: 'none', border: '1px solid var(--border-default)', color: 'var(--text-primary)',
          padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
        }}>
          Retry
        </button>
      </div>
    );
  }

  if (!tree) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>
        <div>No project open</div>
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-subtle)', userSelect: 'none' }}>
      {/* Workspace Header */}
      <div 
        onMouseEnter={() => setIsHoveringHeader(true)}
        onMouseLeave={() => setIsHoveringHeader(false)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 8px', position: 'sticky', top: 0, background: 'var(--bg-subtle)', zIndex: 1,
          cursor: 'pointer', height: 26,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          <ChevronDown size={16} />
          <span>{tree.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 2, opacity: isHoveringHeader ? 1 : 0, transition: 'opacity 0.1s' }}>
          <ActionButton title="New File..." onClick={() => handleCreateItem(tree.id, 'file')}>
            <FilePlus size={16} />
          </ActionButton>
          <ActionButton title="New Folder..." onClick={() => handleCreateItem(tree.id, 'folder')}>
            <FolderPlus size={16} />
          </ActionButton>
          <ActionButton title="Refresh Explorer" onClick={onRefresh}>
            <RefreshCw size={16} />
          </ActionButton>
        </div>
      </div>

      {/* Tree nodes */}
      <div style={{ paddingBottom: 16 }}>
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
          <div style={{ padding: '16px 8px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            Empty folder
          </div>
        )}
      </div>

      {/* New File Dialog */}
      <NewFileDialog
        isOpen={newFileDialog.open}
        onClose={() => setNewFileDialog({ open: false, parentId: null, type: 'file' })}
        onCreate={handleCreateFromDialog}
      />
    </div>
  );
};

export default FileTree;
