/**
 * Orion IDE — Search Panel
 *
 * File-content search across the project.
 * Searches locally through the file tree by fetching file contents from Drive.
 * Shows results grouped by file with matching lines highlighted.
 */

import React, { useState, useCallback, useRef } from 'react';
import { useEditor } from '../../context/EditorContext';
import { driveService } from '../../services/driveService';
import { Search, X, FileCode2, Loader2, ChevronDown, ChevronRight, CaseSensitive, Regex } from 'lucide-react';

/**
 * Recursively flatten a file tree node into an array of files.
 */
function flattenFiles(node) {
  if (!node) return [];
  let result = [];
  if (!node.isFolder) {
    result.push({ id: node.id, name: node.name });
  }
  if (node.children) {
    node.children.forEach((child) => {
      result = result.concat(flattenFiles(child));
    });
  }
  return result;
}

const SearchPanel = ({ tree }) => {
  const { openFile } = useEditor();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]); // [{ fileId, fileName, matches: [{ lineNumber, lineText, matchStart, matchEnd }] }]
  const [isSearching, setIsSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState(new Set());
  const [totalMatches, setTotalMatches] = useState(0);
  const abortRef = useRef(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !tree) return;

    // Abort previous search
    if (abortRef.current) abortRef.current.aborted = true;
    const thisSearch = { aborted: false };
    abortRef.current = thisSearch;

    setIsSearching(true);
    setResults([]);
    setTotalMatches(0);

    const files = flattenFiles(tree);
    const foundResults = [];
    let matchCount = 0;

    let searchRegex;
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      searchRegex = useRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    } catch {
      setIsSearching(false);
      return;
    }

    for (const file of files) {
      if (thisSearch.aborted) return;

      try {
        const res = await driveService.readFile(file.id);
        const content = res.data?.data?.content ?? '';
        if (!content) continue;

        const lines = content.split('\n');
        const matches = [];

        lines.forEach((lineText, idx) => {
          searchRegex.lastIndex = 0;
          const match = searchRegex.exec(lineText);
          if (match) {
            matches.push({
              lineNumber: idx + 1,
              lineText: lineText.substring(0, 200), // Truncate very long lines
              matchStart: match.index,
              matchEnd: match.index + match[0].length,
            });
          }
        });

        if (matches.length > 0) {
          foundResults.push({ fileId: file.id, fileName: file.name, matches });
          matchCount += matches.length;
          // Stream results as they come in
          if (!thisSearch.aborted) {
            setResults([...foundResults]);
            setTotalMatches(matchCount);
            setExpandedFiles(new Set(foundResults.map((r) => r.fileId)));
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    if (!thisSearch.aborted) {
      setIsSearching(false);
    }
  }, [query, tree, caseSensitive, useRegex]);

  const toggleFile = useCallback((fileId) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const handleMatchClick = useCallback((fileId, fileName) => {
    openFile(fileId, fileName);
  }, [openFile]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Search input */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-emphasis)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-default)', padding: '4px 8px',
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Search in files…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 'var(--font-size-md)',
              fontFamily: 'var(--font-ui)',
            }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setTotalMatches(0); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
              <X size={12} color="var(--text-muted)" />
            </button>
          )}
        </div>

        {/* Options */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            title="Match Case"
            style={{
              ...optionBtnStyle,
              background: caseSensitive ? 'var(--accent-blue)' : 'var(--bg-emphasis)',
              color: caseSensitive ? 'white' : 'var(--text-muted)',
            }}
          >
            <CaseSensitive size={14} />
          </button>
          <button
            onClick={() => setUseRegex(!useRegex)}
            title="Use Regex"
            style={{
              ...optionBtnStyle,
              background: useRegex ? 'var(--accent-blue)' : 'var(--bg-emphasis)',
              color: useRegex ? 'white' : 'var(--text-muted)',
            }}
          >
            <Regex size={14} />
          </button>
        </div>
      </div>

      {/* Status */}
      {isSearching && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)',
        }}>
          <Loader2 size={12} className="spin" />
          Searching...
        </div>
      )}

      {!isSearching && totalMatches > 0 && (
        <div style={{
          padding: '6px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-default)',
        }}>
          {totalMatches} result{totalMatches !== 1 ? 's' : ''} in {results.length} file{results.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Results */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {results.map((fileResult) => (
          <div key={fileResult.fileId}>
            {/* File header */}
            <button
              onClick={() => toggleFile(fileResult.fileId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, width: '100%',
                padding: '4px 8px', background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-ui)',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {expandedFiles.has(fileResult.fileId) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <FileCode2 size={12} color="var(--text-muted)" />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fileResult.fileName}
              </span>
              <span style={{ color: 'var(--text-disabled)', fontSize: 'var(--font-size-xs)' }}>
                {fileResult.matches.length}
              </span>
            </button>

            {/* Matches */}
            {expandedFiles.has(fileResult.fileId) && fileResult.matches.map((match, i) => (
              <button
                key={i}
                onClick={() => handleMatchClick(fileResult.fileId, fileResult.fileName)}
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 8, width: '100%',
                  padding: '3px 8px 3px 32px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-secondary)', lineHeight: '18px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ color: 'var(--text-disabled)', minWidth: 28, textAlign: 'right', flexShrink: 0 }}>
                  {match.lineNumber}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {match.lineText.substring(0, match.matchStart)}
                  <span style={{ background: 'rgba(31, 111, 235, 0.3)', color: 'var(--info)', borderRadius: 2 }}>
                    {match.lineText.substring(match.matchStart, match.matchEnd)}
                  </span>
                  {match.lineText.substring(match.matchEnd)}
                </span>
              </button>
            ))}
          </div>
        ))}

        {/* Empty state */}
        {!isSearching && results.length === 0 && query && (
          <div style={{
            padding: '24px 16px', textAlign: 'center',
            color: 'var(--text-disabled)', fontSize: 'var(--font-size-sm)',
          }}>
            No results found
          </div>
        )}

        {!query && (
          <div style={{
            padding: '24px 16px', textAlign: 'center',
            color: 'var(--text-disabled)', fontSize: 'var(--font-size-sm)',
          }}>
            Type to search across files
          </div>
        )}
      </div>
    </div>
  );
};

const optionBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 24, border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: 0,
};

export default SearchPanel;
