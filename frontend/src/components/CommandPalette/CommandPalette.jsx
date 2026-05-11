import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '../../context/EditorContext';
import { Search, File, PlayCircle, Settings, X, Terminal } from 'lucide-react';
import useTerminal from '../../hooks/useTerminal';

const CommandPalette = ({ tree }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const { openFile } = useEditor();
  const { runCode } = useTerminal();

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
      if (node.type === 'file') {
        result.push({ ...node, fullPath });
      } else if (node.children) {
        result = result.concat(flattenTree(node.children, fullPath));
      }
    });
    return result;
  };

  const files = tree ? flattenTree(tree) : [];
  
  const commands = [
    { id: 'cmd-run', name: 'Run Active File', icon: <PlayCircle size={16} />, action: () => { /* Add global run trigger */ } },
    { id: 'cmd-settings', name: 'Open Settings', icon: <Settings size={16} />, action: () => {} },
    { id: 'cmd-terminal', name: 'Toggle Terminal', icon: <Terminal size={16} />, action: () => {} },
  ];

  const items = [
    ...files.map(f => ({ ...f, isCommand: false, icon: <File size={16} /> })),
    ...commands.map(c => ({ ...c, isCommand: true }))
  ].filter(item => 
    (item.fullPath || item.name).toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleExecute = (item) => {
    if (item.isCommand) {
      item.action();
    } else {
      openFile(item);
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
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)'
    }} onClick={() => setIsOpen(false)}>
      <div 
        style={{
          width: 600, background: '#161b22', borderRadius: 12,
          border: '1px solid #30363d', boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #21262d' }}>
          <Search size={18} color="#7d8590" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search files or commands..."
            style={{
              flex: 1, background: 'transparent', border: 'none', color: '#e6edf3',
              fontSize: 15, outline: 'none', padding: '0 12px', fontFamily: "'Inter', sans-serif"
            }}
          />
          <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#7d8590', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ maxHeight: 340, overflowY: 'auto', padding: '8px 0' }}>
          {items.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#7d8590', fontSize: 13 }}>
              No matching files or commands found.
            </div>
          ) : (
            items.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id || item.fileId}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => handleExecute(item)}
                  style={{
                    padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    background: isSelected ? '#238636' : 'transparent',
                    color: isSelected ? '#fff' : '#c9d1d9',
                    cursor: 'pointer', transition: 'background 0.1s'
                  }}
                >
                  <div style={{ opacity: isSelected ? 1 : 0.7 }}>{item.icon}</div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                    {item.fullPath && !item.isCommand && (
                      <span style={{ fontSize: 11, color: isSelected ? '#e6edf3' : '#7d8590', marginTop: 2, opacity: 0.8 }}>
                        {item.fullPath}
                      </span>
                    )}
                  </div>
                  {item.isCommand && (
                    <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 4 }}>
                      Command
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
