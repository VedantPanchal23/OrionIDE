/**
 * Orion IDE — Search panel
 *
 * There is no backend full-text search endpoint, so this walks the Drive
 * folder tree (breadth-first, capped) matching file/folder names — a
 * genuinely working "search by name" rather than a stub.
 */

import { useCallback, useRef, useState } from 'react';
import { Search as SearchIcon, FileCode, Folder } from 'lucide-react';
import * as driveService from '../../services/driveService';
import { useEditor } from '../../context/EditorContext';
import { useToast } from '../../context/ToastContext';
import {
  PanelHeader, Input, Spinner, EmptyState,
} from '../ui/primitives';

const MAX_FOLDERS = 400;

async function walk(rootId, query, results, counter) {
  if (counter.count >= MAX_FOLDERS) return;
  counter.count += 1;
  let items;
  try {
    const res = await driveService.listFiles(rootId);
    items = res.data?.data?.files || [];
  } catch {
    return;
  }
  const subfolders = [];
  for (const item of items) {
    const isFolder = Boolean(item.isFolder);
    if (item.name.toLowerCase().includes(query)) {
      results.push({
        id: item.id, name: item.name, parentId: rootId, isFolder,
      });
    }
    if (isFolder) subfolders.push(item.id);
  }
  for (const id of subfolders) {
    if (counter.count >= MAX_FOLDERS) break;
    await walk(id, query, results, counter);
  }
}

export default function SearchPanel({ projectId }) {
  const { openFile } = useEditor();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef(null);
  const requestSeq = useRef(0);

  const runSearch = useCallback(async (q) => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setSearched(true);
    const found = [];
    await walk(projectId, trimmed, found, { count: 0 });
    if (requestSeq.current === seq) {
      setResults(found);
      setLoading(false);
    }
  }, [projectId]);

  const onChange = (value) => {
    setQuery(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(value), 380);
  };

  const openResult = (r) => {
    if (r.isFolder) return;
    openFile({ id: r.id, name: r.name, parentId: r.parentId }).catch((err) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to open file');
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelHeader title="Search" />
      <div className="search-box">
        <Input
          placeholder="Search files by name…"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
        ) : !searched ? (
          <EmptyState
            icon={<SearchIcon size={26} color="var(--text-muted)" />}
            title="Search this project"
            hint="Finds files and folders by name."
          />
        ) : results.length === 0 ? (
          <EmptyState title="No matches" hint={`Nothing found for "${query}"`} />
        ) : (
          <div className="search-results">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="search-result-row"
                onClick={() => openResult(r)}
                disabled={r.isFolder}
              >
                {r.isFolder ? <Folder size={13} color="var(--accent)" /> : <FileCode size={13} />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
