import { useEffect, useMemo, useState } from 'react';
import { Replace, Search as SearchIcon } from 'lucide-react';
import { useFileTreeContext } from '../../context/FileTreeContext';
import { useEditor } from '../../context/EditorContext';
import { useToast } from '../../context/ToastContext';
import { FileIcon } from '../../utils/fileIcons';
import { replaceAllInText } from '../../utils/searchReplace';
import { Spinner } from '../ui/primitives';
import * as driveService from '../../services/driveService';
import { buildProjectIndex, searchIndex } from '../../lib/projectIndex';
import { collectIndexFiles } from '../../lib/projectIndexCache';

function highlightMatch(text, query) {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-mark">{text.slice(idx, idx + q.length)}</mark>
    </>
  );
}

export default function SearchPanel() {
  const tree = useFileTreeContext();
  const { openFile, openFiles, updateContent, getLiveContent } = useEditor();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [driveHits, setDriveHits] = useState([]);
  const [truncated, setTruncated] = useState(false);

  const fileHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tree.listFilesFlat()
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 80);
  }, [query, tree, tree.nodesById]);

  const openEditorHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const hits = [];
    openFiles.forEach((f) => {
      const content = getLiveContent?.(f.id) ?? f.content ?? '';
      const lines = String(content).split('\n');
      lines.forEach((line, i) => {
        if (line.toLowerCase().includes(q)) {
          hits.push({
            id: `${f.id}:${i}`,
            name: f.name,
            line: i + 1,
            preview: line.trim().slice(0, 120),
            node: f,
          });
        }
      });
    });
    return hits.slice(0, 100);
  }, [query, openFiles, getLiveContent]);

  const symbolHits = useMemo(() => {
    const q = query.trim();
    if (!q || q.length < 2) return [];
    const files = collectIndexFiles(openFiles, getLiveContent);
    const index = buildProjectIndex(files);
    const { symbols } = searchIndex(index, q, 40);
    return symbols.map((s) => ({
      ...s,
      node: openFiles.find((f) => f.id === s.fileId) || {
        id: s.fileId,
        name: s.fileName,
        isFolder: false,
      },
    }));
  }, [query, openFiles, getLiveContent]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !tree.projectId) {
      setDriveHits([]);
      setTruncated(false);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await driveService.searchProject(tree.projectId, q);
        if (cancelled) return;
        setDriveHits(res.data?.data?.files || []);
        setTruncated(Boolean(res.data?.data?.truncated));
      } catch {
        if (!cancelled) setDriveHits([]);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, tree.projectId]);

  const replaceInOpenEditors = () => {
    const q = query.trim();
    if (!q) return;
    let total = 0;
    let filesTouched = 0;
    openFiles.forEach((f) => {
      const content = getLiveContent?.(f.id) ?? f.content ?? '';
      const { text, count } = replaceAllInText(content, q, replaceWith);
      if (count > 0) {
        updateContent(f.id, text);
        total += count;
        filesTouched += 1;
      }
    });
    if (total === 0) toast.info('No matches in open editors');
    else toast.success(`Replaced ${total} in ${filesTouched} file${filesTouched === 1 ? '' : 's'}`);
  };

  const replaceInProject = async () => {
    const q = query.trim();
    if (!q || !tree.projectId) return;
    const targets = driveHits.filter((f) => f?.id && !f.isFolder);
    if (!targets.length) {
      toast.info('No Drive file hits to replace — search first');
      return;
    }
    if (!window.confirm(`Replace all "${q}" in ${targets.length} Drive file(s)?`)) return;
    setReplacing(true);
    let filesTouched = 0;
    let total = 0;
    let skipped = 0;
    let failed = 0;
    try {
      for (const f of targets.slice(0, 80)) {
        try {
          const res = await driveService.readFile(f.id);
          const content = res.data?.data?.content ?? res.data?.content ?? '';
          if (typeof content !== 'string') {
            skipped += 1;
            continue;
          }
          const { text, count } = replaceAllInText(content, q, replaceWith);
          if (count <= 0) {
            skipped += 1;
            continue;
          }
          await driveService.updateFile(f.id, text);
          const open = openFiles.find((o) => o.id === f.id);
          if (open) updateContent(f.id, text);
          filesTouched += 1;
          total += count;
        } catch {
          failed += 1;
        }
      }
      if (total === 0) {
        toast.info(
          failed
            ? `No replacements (${failed} file error${failed === 1 ? '' : 's'})`
            : 'No content matches in Drive hits (name-only hits are skipped)',
        );
      } else {
        const extra = [
          skipped ? `${skipped} skipped` : null,
          failed ? `${failed} failed` : null,
        ].filter(Boolean).join(', ');
        toast.success(
          `Replaced ${total} across ${filesTouched} file${filesTouched === 1 ? '' : 's'}${extra ? ` (${extra})` : ''}`,
        );
      }
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="side-panel">
      <div className="ide-sidebar-title">
        <span>Search</span>
        <span className="title-actions">
          <button
            type="button"
            className={`icon-btn ${showReplace ? 'active' : ''}`}
            title="Toggle replace"
            onClick={() => setShowReplace((v) => !v)}
          >
            <Replace size={14} />
          </button>
        </span>
      </div>
      <div className="side-panel-body">
        <div className="search-box">
          <SearchIcon size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Drive files & contents"
            autoFocus
          />
          {busy && <Spinner size={12} />}
        </div>

        {showReplace && (
          <div className="search-replace">
            <div className="search-box">
              <Replace size={14} />
              <input
                value={replaceWith}
                onChange={(e) => setReplaceWith(e.target.value)}
                placeholder="Replace in open editors"
              />
            </div>
            <div className="search-replace-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!query.trim() || openEditorHits.length === 0 || replacing}
                onClick={() => replaceInOpenEditors()}
              >
                Replace in open editors
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!query.trim() || driveHits.filter((f) => !f.isFolder).length === 0 || replacing}
                onClick={() => replaceInProject()}
              >
                {replacing ? <Spinner size={12} /> : null}
                Replace in project
              </button>
            </div>
            <p className="settings-hint">
              Open-editor replace updates buffers (save to Drive). Project replace writes matching Drive files after confirm.
            </p>
          </div>
        )}

        <div className="search-section-label">
          Drive
          {truncated ? <span className="count">truncated</span> : null}
        </div>
        {driveHits.length === 0 ? (
          <div className="side-empty polished">
            <p className="side-empty-title">
              {query.length >= 2 ? (busy ? 'Searching…' : 'No Drive matches') : 'Search Drive'}
            </p>
            <p>{query.length >= 2 ? 'Try another query' : 'Type 2+ characters to search'}</p>
          </div>
        ) : (
          <ul className="search-results">
            {driveHits.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="search-hit stacked"
                  onClick={() => {
                    if (!f.isFolder) {
                      openFile({
                        id: f.id,
                        name: f.name,
                        parentId: f.parentId || tree.projectId,
                        isFolder: false,
                      });
                    }
                  }}
                >
                  <span className="search-hit-top">
                    <FileIcon name={f.name} size={14} />
                    <span>{highlightMatch(f.name, query)}</span>
                  </span>
                  {(f.path || f.mimeType) && (
                    <span className="search-preview muted">{f.path || (f.isFolder ? 'folder' : 'file')}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="search-section-label">Loaded tree</div>
        {!query.trim() ? (
          <div className="side-empty polished">
            <p className="side-empty-title">Filter the tree</p>
            <p>Matches loaded file names as you type</p>
          </div>
        ) : fileHits.length === 0 ? (
          <div className="side-empty polished">
            <p className="side-empty-title">No tree matches</p>
            <p>Try another name or expand more folders</p>
          </div>
        ) : (
          <ul className="search-results">
            {fileHits.map((f) => (
              <li key={f.id}>
                <button type="button" className="search-hit" onClick={() => openFile(f)}>
                  <FileIcon name={f.name} size={14} />
                  <span>{highlightMatch(f.name, query)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="search-section-label">
          Symbols
          {symbolHits.length > 0 && <span className="count">{symbolHits.length}</span>}
        </div>
        {query.trim().length < 2 ? (
          <div className="side-empty polished">
            <p className="side-empty-title">Go to symbol</p>
            <p>Indexes defs in open + recently viewed files</p>
          </div>
        ) : symbolHits.length === 0 ? (
          <div className="side-empty polished">
            <p className="side-empty-title">No symbols</p>
            <p>Open files with functions/classes or try another query</p>
          </div>
        ) : (
          <ul className="search-results">
            {symbolHits.map((h) => (
              <li key={`${h.fileId}:${h.line}:${h.name}`}>
                <button
                  type="button"
                  className="search-hit stacked"
                  onClick={() => openFile(h.node, { line: h.line })}
                >
                  <span className="search-hit-top">
                    <FileIcon name={h.fileName || h.node.name} size={13} />
                    <span>{h.name}</span>
                    <span className="muted">
                      {h.fileName}
                      :
                      {h.line}
                    </span>
                  </span>
                  <span className="search-preview">{highlightMatch(h.preview, query)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="search-section-label">
          Open editors
          {openEditorHits.length > 0 && <span className="count">{openEditorHits.length}</span>}
        </div>
        {query.trim().length < 2 ? (
          <div className="side-empty polished">
            <p className="side-empty-title">Search open files</p>
            <p>Type 2+ characters to scan editor buffers</p>
          </div>
        ) : openEditorHits.length === 0 ? (
          <div className="side-empty polished">
            <p className="side-empty-title">No matches in open files</p>
            <p>Open more files or try another query</p>
          </div>
        ) : (
          <ul className="search-results">
            {openEditorHits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="search-hit stacked"
                  onClick={() => openFile(h.node, { line: h.line })}
                >
                  <span className="search-hit-top">
                    <FileIcon name={h.name} size={13} />
                    <span>{h.name}</span>
                    <span className="muted">:{h.line}</span>
                  </span>
                  <span className="search-preview">{highlightMatch(h.preview, query)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
