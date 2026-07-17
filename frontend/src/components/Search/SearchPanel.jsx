/**
 * Orion IDE — Search Panel (Find & Replace)
 *
 * File-content search across the project with an optional Replace section.
 * Searches locally through the file tree by fetching file contents from Drive.
 * Shows results grouped by file with matching lines highlighted.
 *
 * Replace features:
 *  - Replace All  : replaces every match across all result files
 *  - Replace in File : replaces matches only in the currently active editor tab
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useEditor } from '../../context/EditorContext';
import { driveService } from '../../services/driveService';
import {
  Search, X, FileCode2, Loader2,
  ChevronDown, ChevronRight,
  CaseSensitive, Regex,
  Replace, ReplaceAll,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively flatten a file tree node into an array of { id, name } files.
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

/**
 * Build the search regex from the current query + options.
 * Returns null if the pattern is invalid.
 */
function buildRegex(query, caseSensitive, useRegex) {
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    return useRegex
      ? new RegExp(query, flags)
      : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SearchPanel = ({ tree }) => {
  const { openFile, revealLine, openFiles, activeFile } = useEditor();

  // Search state
  const [query, setQuery]                 = useState('');
  const [results, setResults]             = useState([]);
  const [isSearching, setIsSearching]     = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex]           = useState(false);
  const [expandedFiles, setExpandedFiles] = useState(new Set());
  const [totalMatches, setTotalMatches]   = useState(0);
  const abortRef = useRef(null);

  // Replace state
  const [showReplace, setShowReplace]       = useState(false);
  const [replaceText, setReplaceText]       = useState('');
  const [isReplacing, setIsReplacing]       = useState(false);
  const [replaceMessage, setReplaceMessage] = useState('');
  const replaceBannerTimerRef = useRef(null);

  // Cleanup banner timer on unmount
  useEffect(() => {
    return () => {
      if (replaceBannerTimerRef.current) clearTimeout(replaceBannerTimerRef.current);
    };
  }, []);

  // Show a transient info banner that auto-hides after 3 s
  const showBanner = useCallback((msg) => {
    setReplaceMessage(msg);
    if (replaceBannerTimerRef.current) clearTimeout(replaceBannerTimerRef.current);
    replaceBannerTimerRef.current = setTimeout(() => setReplaceMessage(''), 3000);
  }, []);

  // Core search
  const handleSearch = useCallback(async () => {
    if (!query.trim() || !tree) return;

    if (abortRef.current) abortRef.current.aborted = true;
    const thisSearch = { aborted: false };
    abortRef.current = thisSearch;

    setIsSearching(true);
    setResults([]);
    setTotalMatches(0);

    const searchRegex = buildRegex(query, caseSensitive, useRegex);
    if (!searchRegex) {
      setIsSearching(false);
      return;
    }

    const files = flattenFiles(tree);
    const foundResults = [];
    let matchCount = 0;

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
              lineText: lineText.substring(0, 200),
              matchStart: match.index,
              matchEnd: match.index + match[0].length,
            });
          }
        });

        if (matches.length > 0) {
          foundResults.push({ fileId: file.id, fileName: file.name, matches });
          matchCount += matches.length;
          if (!thisSearch.aborted) {
            setResults([...foundResults]);
            setTotalMatches(matchCount);
            setExpandedFiles(new Set(foundResults.map((r) => r.fileId)));
          }
        }
      } catch {
        // Skip unreadable files silently
      }
    }

    if (!thisSearch.aborted) {
      setIsSearching(false);
    }
  }, [query, tree, caseSensitive, useRegex]);

  // Replace All — across every result file
  const handleReplaceAll = useCallback(async () => {
    if (!query.trim() || results.length === 0) return;

    const searchRegex = buildRegex(query, caseSensitive, useRegex);
    if (!searchRegex) return;

    setIsReplacing(true);
    let totalReplaced = 0;
    let filesAffected = 0;

    for (const fileResult of results) {
      try {
        const res = await driveService.readFile(fileResult.fileId);
        const original = res.data?.data?.content ?? '';
        if (!original) continue;

        // Count first (matchAll needs the global flag which buildRegex always sets)
        const countMatches = [...original.matchAll(searchRegex)];
        searchRegex.lastIndex = 0;
        const updated = original.replace(searchRegex, replaceText);

        if (updated !== original) {
          await driveService.flushFile(fileResult.fileId, updated);
          totalReplaced += countMatches.length;
          filesAffected += 1;
        }
      } catch {
        // Skip files that fail
      }
    }

    setIsReplacing(false);

    if (filesAffected > 0) {
      showBanner(
        `Replaced ${totalReplaced} occurrence${totalReplaced !== 1 ? 's' : ''} in ${filesAffected} file${filesAffected !== 1 ? 's' : ''}`,
      );
      await handleSearch();
    } else {
      showBanner('No replacements made.');
    }
  }, [query, results, caseSensitive, useRegex, replaceText, handleSearch, showBanner]);

  // Replace in active file only
  const handleReplaceInFile = useCallback(async () => {
    if (!query.trim() || !activeFile) return;

    const searchRegex = buildRegex(query, caseSensitive, useRegex);
    if (!searchRegex) return;

    setIsReplacing(true);

    try {
      // Prefer editor in-memory content (most up-to-date)
      const openTab = openFiles.find((f) => f.fileId === activeFile.fileId);
      let original = openTab?.content ?? '';

      if (!original) {
        const res = await driveService.readFile(activeFile.fileId);
        original = res.data?.data?.content ?? '';
      }

      if (!original) {
        showBanner('Active file has no content.');
        setIsReplacing(false);
        return;
      }

      const countMatches = [...original.matchAll(searchRegex)];
      searchRegex.lastIndex = 0;
      const updated = original.replace(searchRegex, replaceText);

      if (updated !== original) {
        await driveService.flushFile(activeFile.fileId, updated);
        showBanner(
          `Replaced ${countMatches.length} occurrence${countMatches.length !== 1 ? 's' : ''} in ${activeFile.fileName}`,
        );
        await handleSearch();
      } else {
        showBanner('No matches found in active file.');
      }
    } catch {
      showBanner('Replace failed — could not read/write the file.');
    }

    setIsReplacing(false);
  }, [query, activeFile, openFiles, caseSensitive, useRegex, replaceText, handleSearch, showBanner]);

  // UI helpers
  const toggleFile = useCallback((fileId) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const handleMatchClick = useCallback((fileId, fileName, lineNumber) => {
    if (lineNumber) {
      revealLine(fileId, fileName, lineNumber);
    } else {
      openFile(fileId, fileName);
    }
  }, [openFile, revealLine]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setTotalMatches(0);
  }, []);

  // Derived booleans
  const isBusy        = isSearching || isReplacing;
  const canReplace    = !isBusy && results.length > 0;
  const canReplaceInFile = !isBusy && !!activeFile;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'var(--font-ui)',
    }}>

      {/* Header: Search + Replace inputs */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-default)' }}>

        {/* Row 1: toggle chevron + search box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setShowReplace((s) => !s)}
            title={showReplace ? 'Hide Replace' : 'Show Replace'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 2, display: 'flex', color: 'var(--text-muted)', flexShrink: 0,
            }}
          >
            {showReplace ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg-emphasis)', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)', padding: '4px 8px',
          }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Search in files\u2026"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: 'var(--font-size-md)',
                fontFamily: 'var(--font-ui)',
              }}
            />
            {query && (
              <button
                onClick={clearSearch}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
              >
                <X size={12} color="var(--text-muted)" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: replace input (collapsible) */}
        {showReplace && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            {/* Spacer matching chevron width */}
            <div style={{ width: 18, flexShrink: 0 }} />

            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-emphasis)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)', padding: '4px 8px',
            }}>
              <Replace size={14} color="var(--text-muted)" />
              <input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canReplaceInFile) handleReplaceInFile(); }}
                placeholder="Replace\u2026"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 'var(--font-size-md)',
                  fontFamily: 'var(--font-ui)',
                }}
              />
              {replaceText && (
                <button
                  onClick={() => setReplaceText('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  <X size={12} color="var(--text-muted)" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Row 3: option toggles + action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
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

          <div style={{ flex: 1 }} />

          {showReplace && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={handleReplaceInFile}
                disabled={!canReplaceInFile}
                title="Replace in File"
                style={{
                  ...actionBtnStyle,
                  opacity: canReplaceInFile ? 1 : 0.4,
                  cursor: canReplaceInFile ? 'pointer' : 'not-allowed',
                }}
              >
                <Replace size={13} />
                <span>In File</span>
              </button>

              <button
                onClick={handleReplaceAll}
                disabled={!canReplace}
                title="Replace All"
                style={{
                  ...actionBtnStyle,
                  opacity: canReplace ? 1 : 0.4,
                  cursor: canReplace ? 'pointer' : 'not-allowed',
                }}
              >
                <ReplaceAll size={13} />
                <span>All</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Replace result banner (auto-hides) */}
      {replaceMessage && (
        <div style={{
          padding: '6px 12px',
          background: 'var(--bg-emphasis)',
          borderBottom: '1px solid var(--border-default)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{replaceMessage}</span>
          <button
            onClick={() => setReplaceMessage('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <X size={11} color="var(--text-muted)" />
          </button>
        </div>
      )}

      {/* Busy indicator */}
      {isBusy && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)',
        }}>
          <Loader2 size={12} className="spin" />
          {isReplacing ? 'Replacing\u2026' : 'Searching\u2026'}
        </div>
      )}

      {/* Match count summary */}
      {!isBusy && totalMatches > 0 && (
        <div style={{
          padding: '6px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-default)',
        }}>
          {totalMatches} result{totalMatches !== 1 ? 's' : ''} in{' '}
          {results.length} file{results.length !== 1 ? 's' : ''}
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
              {expandedFiles.has(fileResult.fileId)
                ? <ChevronDown size={12} />
                : <ChevronRight size={12} />}
              <FileCode2 size={12} color="var(--text-muted)" />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fileResult.fileName}
              </span>
              <span style={{ color: 'var(--text-disabled)', fontSize: 'var(--font-size-xs)' }}>
                {fileResult.matches.length}
              </span>
            </button>

            {/* Match lines */}
            {expandedFiles.has(fileResult.fileId) && fileResult.matches.map((match, i) => (
              <button
                key={i}
                onClick={() => handleMatchClick(fileResult.fileId, fileResult.fileName, match.lineNumber)}
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
                  <span style={{
                    background: 'var(--highlight-match, rgba(31,111,235,0.3))',
                    color: 'var(--info)',
                    borderRadius: 2,
                  }}>
                    {match.lineText.substring(match.matchStart, match.matchEnd)}
                  </span>
                  {match.lineText.substring(match.matchEnd)}
                </span>
              </button>
            ))}
          </div>
        ))}

        {/* No results */}
        {!isBusy && results.length === 0 && query && (
          <div style={{
            padding: '24px 16px', textAlign: 'center',
            color: 'var(--text-disabled)', fontSize: 'var(--font-size-sm)',
          }}>
            No results found
          </div>
        )}

        {/* Prompt */}
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

// ---------------------------------------------------------------------------
// Shared micro-styles (defined after component to avoid hoisting issues)
// ---------------------------------------------------------------------------

const optionBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 24, border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: 0,
};

const actionBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '3px 8px', border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-emphasis)',
  color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)',
  fontFamily: 'var(--font-ui)',
};

export default SearchPanel;
