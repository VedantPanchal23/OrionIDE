/**
 * Orion IDE — Command Palette
 *
 * Quick access to files and commands via Ctrl+P.
 * Uses design tokens for consistent styling.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '../../context/EditorContext';
import { Search, File, PlayCircle, Settings, X, Terminal, Command } from 'lucide-react';

const CommandPalette = ({ tree, onRun, onNewTerminal, onOpenSettings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const { openFile } = useEditor();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setIsOpen(true);
        setQuery('');
        setSelectedIndex(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 50);
    }
  }, [isOpen]);

  const flattenTree = (nodes, path = '') => {
    let result = [];
    nodes.forEach(node => {
      const fullPath = path ? `${path}/${node.name}` : node.name;
      if (!node.isFolder) {
        result.push({ ...node, fullPath });
      } else if (node.children) {
        result = result.concat(flattenTree(node.children, fullPath));
      }
    });
    return result;
  };

  const files = tree?.children ? flattenTree(tree.children) : [];
  
  const commands = [
    { id: 'cmd-run', name: 'Run Active File', icon: <PlayCircle size={15} />, action: () => { if (onRun) onRun(); } },
    { id: 'cmd-settings', name: 'Open Settings', icon: <Settings size={15} />, action: () => { if (onOpenSettings) onOpenSettings(); } },
    { id: 'cmd-terminal', name: 'New Terminal', icon: <Terminal size={15} />, action: () => { if (onNewTerminal) onNewTerminal(); } },
  ];

  const items = [
    ...files.map(f => ({ ...f, isCommand: false, icon: <File size={15} /> })),
    ...commands.map(c => ({ ...c, isCommand: true }))
  ].filter(item => 
    (item.fullPath || item.name).toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex];
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleExecute = (item) => {
    if (item.isCommand) {
      item.action();
    } else {
      openFile(item.id, item.name);
    }
    setIsOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(items.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      e.preventDefault();
      handleExecute(items[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '15vh',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }} onClick={() => setIsOpen(false)}>
      <div 
        style={{
          width: 560, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xl)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '12px 16px',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search files or type > for commands..."
            style={{
              flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)',
              fontSize: 'var(--font-size-base)', outline: 'none', padding: '0 12px',
              fontFamily: 'var(--font-ui)',
            }}
          />
          <kbd style={{ fontSize: 10, padding: '1px 5px', minWidth: 'auto', height: 18 }}>Esc</kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} style={{ maxHeight: 360, overflowY: 'auto', padding: '4px 0' }}>
          {items.length === 0 ? (
            <div style={{
              padding: 32, textAlign: 'center', color: 'var(--text-muted)',
              fontSize: 'var(--font-size-md)',
            }}>
              No matching files or commands
            </div>
          ) : (
            items.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => handleExecute(item)}
                  style={{
                    padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10,
                    margin: '0 4px', borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--accent-blue)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer', transition: 'background var(--transition-fast)',
                  }}
                >
                  <div style={{
                    opacity: isSelected ? 1 : 0.6,
                    color: isSelected ? '#fff' : 'var(--text-muted)',
                    display: 'flex', flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{
                      fontSize: 'var(--font-size-md)', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.name}
                    </span>
                    {item.fullPath && !item.isCommand && (
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                        marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.fullPath}
                      </span>
                    )}
                  </div>
                  {item.isCommand && (
                    <span style={{
                      fontSize: 'var(--font-size-xs)', fontWeight: 600,
                      background: isSelected ? 'rgba(255,255,255,0.15)' : 'var(--bg-emphasis)',
                      color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)',
                      padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Command size={10} />
                      cmd
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px', borderTop: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', gap: 16,
          fontSize: 'var(--font-size-xs)', color: 'var(--text-disabled)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={{ fontSize: 10, padding: '0 4px', minWidth: 'auto', height: 16 }}>↑↓</kbd>
            Navigate
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={{ fontSize: 10, padding: '0 4px', minWidth: 'auto', height: 16 }}>↵</kbd>
            Open
          </span>
          <span style={{ marginLeft: 'auto' }}>
            {items.length} result{items.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
