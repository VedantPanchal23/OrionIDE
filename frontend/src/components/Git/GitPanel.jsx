/**
 * Orion IDE — Git Source Control Panel
 *
 * Shows git status (staged, unstaged, untracked files) by calling
 * the git status API through the drive service.
 * Provides: Refresh, Stage All, Unstage All, Commit with message.
 *
 * Backend note: requires git-service or git routes on drive-service.
 * If unavailable, shows a graceful "Git not available" state.
 */

import React, { useState, useCallback } from 'react';
import {
  GitBranch, RefreshCw, Plus, Minus, Check, FileCode2,
  FilePlus, FileX, FileDiff, ChevronDown, ChevronRight,
  AlertCircle, Loader2,
} from 'lucide-react';
import api from '../../services/api';

const FILE_STATUS_ICONS = {
  M: { icon: FileDiff,  color: 'var(--accent-yellow)', label: 'Modified' },
  A: { icon: FilePlus,  color: 'var(--success)',       label: 'Added' },
  D: { icon: FileX,     color: 'var(--error)',         label: 'Deleted' },
  R: { icon: FileDiff,  color: 'var(--info)',          label: 'Renamed' },
  '?': { icon: FileCode2, color: 'var(--text-muted)', label: 'Untracked' },
};

const FileStatusRow = ({ file, onStage, onUnstage, staged }) => {
  const status = file.status || '?';
  const meta = FILE_STATUS_ICONS[status] || FILE_STATUS_ICONS['?'];
  const Icon = meta.icon;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 12px',
        cursor: 'default',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={13} color={meta.color} style={{ flexShrink: 0 }} />
      <span style={{
        flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontFamily: 'var(--font-mono)',
      }}>
        {file.path}
      </span>
      <span style={{
        fontSize: 10, fontWeight: 700, color: meta.color,
        padding: '1px 4px', background: `${meta.color}18`,
        borderRadius: 3, flexShrink: 0,
      }}>
        {status}
      </span>
      <button
        onClick={() => staged ? onUnstage(file.path) : onStage(file.path)}
        title={staged ? 'Unstage' : 'Stage'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          color: staged ? 'var(--accent-red-emphasis)' : 'var(--success)',
          display: 'flex', borderRadius: 3, flexShrink: 0,
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
      >
        {staged ? <Minus size={12} /> : <Plus size={12} />}
      </button>
    </div>
  );
};

const Section = ({ title, count, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, width: '100%',
          padding: '6px 8px', background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--text-muted)',
          fontSize: 'var(--font-size-xs)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
        <span style={{
          marginLeft: 4, fontSize: 10, padding: '1px 5px',
          background: 'var(--bg-emphasis)', borderRadius: 8,
          color: 'var(--text-secondary)',
        }}>
          {count}
        </span>
      </button>
      {open && children}
    </div>
  );
};

const GitPanel = () => {
  const [status, setStatus] = useState(null); // { staged: [], unstaged: [], untracked: [] }
  const [commitMsg, setCommitMsg] = useState('');
  const [branch, setBranch] = useState('main');
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);
  const [staged, setStaged] = useState(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/git/status');
      setStatus(res.data?.data || { staged: [], unstaged: [], untracked: [] });
      setBranch(res.data?.data?.branch || 'main');
    } catch (err) {
      // Git endpoint may not exist — show graceful state
      setError(err.response?.status === 404
        ? 'Git service not available in this deployment.'
        : err.message || 'Failed to fetch git status');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStage = useCallback((path) => {
    setStaged(prev => { const s = new Set(prev); s.add(path); return s; });
  }, []);

  const handleUnstage = useCallback((path) => {
    setStaged(prev => { const s = new Set(prev); s.delete(path); return s; });
  }, []);

  const handleStageAll = useCallback(() => {
    const all = [
      ...(status?.unstaged || []),
      ...(status?.untracked || []),
    ].map(f => f.path);
    setStaged(new Set(all));
  }, [status]);

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim() || staged.size === 0) return;
    setCommitting(true);
    try {
      await api.post('/git/commit', { message: commitMsg, files: [...staged] });
      setCommitMsg('');
      setStaged(new Set());
      await refresh();
    } catch (err) {
      setError(err.message || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  }, [commitMsg, staged, refresh]);

  const allFiles = [
    ...(status?.unstaged || []),
    ...(status?.untracked || []),
  ];
  const stagedFiles = allFiles.filter(f => staged.has(f.path));
  const unstagedFiles = allFiles.filter(f => !staged.has(f.path));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Branch + Refresh header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderBottom: '1px solid var(--border-default)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GitBranch size={14} color="var(--accent-blue)" />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
            {branch}
          </span>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh"
          style={{
            background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
            color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4,
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          margin: 10, padding: '10px 12px', background: 'rgba(248,81,73,0.06)',
          border: '1px solid var(--accent-red)', borderRadius: 'var(--radius-sm)',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <AlertCircle size={13} color="var(--error)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {error}
          </span>
        </div>
      )}

      {/* Not yet loaded */}
      {!status && !loading && !error && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
        }}>
          <GitBranch size={36} color="var(--text-disabled)" strokeWidth={1.5} />
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Source Control
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-disabled)', lineHeight: 1.5 }}>
            Click refresh to check the git status of your project.
          </div>
          <button
            onClick={refresh}
            style={{
              padding: '7px 16px', background: 'var(--accent-blue)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-ui)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={12} /> Check Status
          </button>
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Loader2 size={20} color="var(--text-muted)" className="spin" />
        </div>
      )}

      {/* File lists */}
      {status && !loading && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Staged */}
          <Section title="Staged Changes" count={stagedFiles.length}>
            {stagedFiles.length === 0 ? (
              <div style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)', color: 'var(--text-disabled)' }}>
                No staged files
              </div>
            ) : stagedFiles.map(f => (
              <FileStatusRow key={f.path} file={f} staged onUnstage={handleUnstage} onStage={handleStage} />
            ))}
          </Section>

          {/* Unstaged */}
          <Section title="Changes" count={unstagedFiles.length}>
            {unstagedFiles.length === 0 ? (
              <div style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)', color: 'var(--text-disabled)' }}>
                No changes
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 8px' }}>
                  <button
                    onClick={handleStageAll}
                    style={{
                      background: 'none', border: '1px solid var(--border-default)', borderRadius: 3,
                      color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 8px',
                      fontSize: 10, fontFamily: 'var(--font-ui)', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Plus size={10} /> Stage All
                  </button>
                </div>
                {unstagedFiles.map(f => (
                  <FileStatusRow key={f.path} file={f} staged={false} onStage={handleStage} onUnstage={handleUnstage} />
                ))}
              </>
            )}
          </Section>
        </div>
      )}

      {/* Commit box */}
      {status && (
        <div style={{
          borderTop: '1px solid var(--border-default)', padding: 10, flexShrink: 0,
        }}>
          <textarea
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            placeholder="Commit message (required)"
            rows={2}
            style={{
              width: '100%', background: 'var(--bg-emphasis)', color: 'var(--text-primary)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
              padding: '6px 8px', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-ui)',
              resize: 'none', outline: 'none', boxSizing: 'border-box',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent-blue)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }}
          />
          <button
            onClick={handleCommit}
            disabled={!commitMsg.trim() || staged.size === 0 || committing}
            style={{
              width: '100%', marginTop: 6, padding: '7px 0',
              background: (!commitMsg.trim() || staged.size === 0) ? 'var(--bg-emphasis)' : 'var(--accent-blue)',
              color: (!commitMsg.trim() || staged.size === 0) ? 'var(--text-disabled)' : '#fff',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-ui)', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background var(--transition-fast)',
            }}
          >
            {committing
              ? <><Loader2 size={12} className="spin" /> Committing…</>
              : <><Check size={12} /> Commit ({staged.size} file{staged.size !== 1 ? 's' : ''})</>
            }
          </button>
        </div>
      )}
    </div>
  );
};

export default GitPanel;
