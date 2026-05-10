/**
 * Orion IDE — File Tree Component
 *
 * Recursive tree with folder expand/collapse, file icons,
 * right-click context menu, inline rename, and loading skeletons.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor } from '../../context/EditorContext';
import { getLanguageFromFileName } from '../../utils/languageMap';

/* ── SVG Icons ────────────────────────────────────────────────────────── */

const ChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
  </svg>
);

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z" />
  </svg>
);

const FolderClosedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="#7d8590">
    <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
  </svg>
);

const FolderOpenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="#58a6ff">
    <path d="M.513 1.513A1.75 1.75 0 011.75 1h3.5c.55 0 1.07.26 1.4.7l.9 1.2a.25.25 0 00.2.1h6.5A1.75 1.75 0 0116 4.75v8.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75c0-.464.184-.91.513-1.237z" />
  </svg>
);

const FileIcon = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill={color || '#7d8590'}>
    <path fillRule="evenodd" d="M3.75 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v8.086A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25V1.75z" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.001 7.001 0 0115 8a.75.75 0 01-1.5 0A5.5 5.5 0 008 2.5zM2.5 8a.75.75 0 00-1.5 0 7.001 7.001 0 0012.193 4.693l1.38 1.38a.25.25 0 00.427-.177V10.25a.25.25 0 00-.25-.25h-3.646a.25.25 0 00-.177.427l1.204 1.204A5.501 5.501 0 012.5 8z" />
  </svg>
);

const NewFileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0112.25 16h-8.5A1.75 1.75 0 012 14.25V1.75zM8 8a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 018 8z" />
  </svg>
);

const NewFolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75zM8 8a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 018 8z" />
  </svg>
);

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
      background: '#161b22', border: '1px solid #30363d', borderRadius: 6,
      padding: '4px 0', minWidth: 160,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      fontFamily: "'Inter', sans-serif", fontSize: 13,
    }}>
      {options.map((opt, i) =>
        opt.separator ? (
          <div key={i} style={{ height: 1, background: '#21262d', margin: '4px 0' }} />
        ) : (
          <div
            key={i}
            onClick={() => { opt.action(); onClose(); }}
            style={{
              padding: '6px 12px', cursor: 'pointer', color: opt.danger ? '#f85149' : '#c9d1d9',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#21262d'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {opt.icon && <span style={{ display: 'flex', color: '#7d8590' }}>{opt.icon}</span>}
            {opt.label}
          </div>
        )
      )}
    </div>
  );
};

/* ── Tree Node ────────────────────────────────────────────────────────── */

const TreeNode = ({ node, depth, expandedFolders, onToggleFolder, onClickFile, onCreateItem, onDelete, onRename }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [contextMenu, setContextMenu] = useState(null);
  const inputRef = useRef(null);

  const isExpanded = expandedFolders.has(node.id);
  const langInfo = !node.isFolder ? getLanguageFromFileName(node.name) : null;

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
        { label: 'New File', icon: <NewFileIcon />, action: () => onCreateItem(node.id, 'file') },
        { label: 'New Folder', icon: <NewFolderIcon />, action: () => onCreateItem(node.id, 'folder') },
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
          padding: '3px 8px', paddingLeft: 8 + depth * 16,
          cursor: 'pointer', fontSize: 13,
          color: '#c9d1d9', transition: 'background 0.1s',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#161b22'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Chevron for folders */}
        <span style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', opacity: node.isFolder ? 1 : 0 }}>
          {node.isFolder && (isExpanded ? <ChevronDown /> : <ChevronRight />)}
        </span>

        {/* Icon */}
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {node.isFolder
            ? (isExpanded ? <FolderOpenIcon /> : <FolderClosedIcon />)
            : <FileIcon color={langInfo?.color || '#7d8590'} />
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
              flex: 1, background: '#0d1117', border: '1px solid #58a6ff',
              color: '#c9d1d9', borderRadius: 3, padding: '1px 4px',
              fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none',
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
        <div style={{ width: 14 + Math.random() * 80, height: 10, background: '#21262d', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
      </div>
    ))}
  </>
);

/* ── FileTree Main ────────────────────────────────────────────────────── */

const FileTree = ({ tree, expandedFolders, isLoading, error, onToggleFolder, onCreateItem, onDeleteItem, onRenameItem, onRefresh }) => {
  const { openFile } = useEditor();

  const handleClickFile = useCallback((fileId, fileName) => {
    openFile(fileId, fileName);
  }, [openFile]);

  const handleCreateItem = useCallback((parentId, type) => {
    const name = window.prompt(`Enter ${type} name:`);
    if (name?.trim()) {
      onCreateItem(parentId, name.trim(), type);
    }
  }, [onCreateItem]);

  const handleDelete = useCallback((itemId, itemName) => {
    if (window.confirm(`Delete "${itemName}"? This cannot be undone.`)) {
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
        padding: 16, fontSize: 13, color: '#f85149',
        fontFamily: "'Inter', sans-serif", textAlign: 'center',
      }}>
        <div style={{ marginBottom: 8 }}>{error}</div>
        <button onClick={onRefresh} style={{
          background: 'none', border: '1px solid #30363d', color: '#7d8590',
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
        padding: 16, fontSize: 13, color: '#484f58',
        fontFamily: "'Inter', sans-serif", textAlign: 'center',
      }}>
        <div>
          <FolderClosedIcon />
          <div style={{ marginTop: 8 }}>No project open</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      {/* Header with actions */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 8px', position: 'sticky', top: 0, background: '#010409', zIndex: 1,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#7d8590', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {tree.name}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button title="New File" onClick={() => handleCreateItem(tree.id, 'file')} style={actionBtnStyle}>
            <NewFileIcon />
          </button>
          <button title="New Folder" onClick={() => handleCreateItem(tree.id, 'folder')} style={actionBtnStyle}>
            <NewFolderIcon />
          </button>
          <button title="Refresh" onClick={onRefresh} style={actionBtnStyle}>
            <RefreshIcon />
          </button>
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
        />
      ))}

      {tree.children?.length === 0 && (
        <div style={{ padding: '16px 8px', fontSize: 13, color: '#484f58', textAlign: 'center' }}>
          Empty folder
        </div>
      )}
    </div>
  );
};

const actionBtnStyle = {
  background: 'none', border: 'none', color: '#7d8590', cursor: 'pointer',
  padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
};

export default FileTree;
