/**
 * Orion IDE — Git panel
 *
 * Backed by the terminal-service's on-disk workspace clone of the Drive
 * project. That workspace only exists once a terminal has synced it, so a
 * missing-workspace 404 shows a friendly nudge instead of a raw error.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  GitBranch, RefreshCw, Plus, Minus, GitCommit, TerminalSquare,
} from 'lucide-react';
import * as gitService from '../../services/gitService';
import { useToast } from '../../context/ToastContext';
import {
  PanelHeader, IconButton, Button, Textarea, Spinner, EmptyState,
} from '../ui/primitives';

function FileRow({ path, status, action, actionIcon, actionTitle }) {
  const letter = (status || '?')[0].toUpperCase();
  return (
    <div className="git-file-row">
      <span className={`git-status-badge git-status-${status}`}>{letter}</span>
      <span className="path" title={path}>{path}</span>
      {action && (
        <IconButton title={actionTitle} onClick={action}>{actionIcon}</IconButton>
      )}
    </div>
  );
}

export default function GitPanel({ projectId, onOpenTerminal }) {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notInitialized, setNotInitialized] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotInitialized(false);
    try {
      const data = await gitService.gitStatus(projectId);
      setStatus(data);
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotInitialized(true);
      } else {
        toast.error(err?.response?.data?.error?.message || 'Failed to load git status');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch status on mount / project change
  useEffect(() => { load(); }, [load]);

  const stageAll = async () => {
    setBusy(true);
    try { setStatus(await gitService.gitStage(projectId, [])); } catch (err) { toast.error(err?.response?.data?.error?.message || 'Stage failed'); }
    finally { setBusy(false); }
  };
  const unstageAll = async () => {
    setBusy(true);
    try { setStatus(await gitService.gitUnstage(projectId, [])); } catch (err) { toast.error(err?.response?.data?.error?.message || 'Unstage failed'); }
    finally { setBusy(false); }
  };
  const stageOne = async (path) => {
    try { setStatus(await gitService.gitStage(projectId, [path])); } catch (err) { toast.error(err?.response?.data?.error?.message || 'Stage failed'); }
  };
  const unstageOne = async (path) => {
    try { setStatus(await gitService.gitUnstage(projectId, [path])); } catch (err) { toast.error(err?.response?.data?.error?.message || 'Unstage failed'); }
  };

  const commit = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await gitService.gitCommit(projectId, message.trim());
      toast.success('Committed');
      setMessage('');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Commit failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <PanelHeader title="Source Control" />
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
      </div>
    );
  }

  if (notInitialized) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <PanelHeader title="Source Control" />
        <EmptyState
          icon={<GitBranch size={28} color="var(--text-muted)" />}
          title="No workspace yet"
          hint="Open a terminal on this project to sync it locally before using Git."
        >
          <Button variant="primary" style={{ marginTop: 12 }} onClick={onOpenTerminal}>
            <TerminalSquare size={14} /> Open terminal
          </Button>
        </EmptyState>
      </div>
    );
  }

  const staged = status?.staged || [];
  const unstaged = status?.unstaged || [];
  const untracked = status?.untracked || [];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelHeader title="Source Control">
        <IconButton title="Refresh" onClick={load}><RefreshCw size={13} /></IconButton>
      </PanelHeader>
      <div className="git-branch-chip">
        <GitBranch size={13} /> {status?.branch || 'main'}
      </div>
      <div className="git-commit-box">
        <Textarea
          placeholder="Commit message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
        />
        <Button variant="primary" block disabled={busy || !message.trim()} onClick={commit}>
          <GitCommit size={14} /> Commit all changes
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {staged.length === 0 && unstaged.length === 0 && untracked.length === 0 ? (
          <EmptyState title="No changes" hint="Working tree is clean." />
        ) : (
          <>
            {staged.length > 0 && (
              <>
                <div className="git-section-label">
                  Staged ({staged.length})
                  <IconButton title="Unstage all" onClick={unstageAll}><Minus size={12} /></IconButton>
                </div>
                {staged.map((f) => (
                  <FileRow key={f.path} path={f.path} status={f.status} action={() => unstageOne(f.path)} actionIcon={<Minus size={12} />} actionTitle="Unstage" />
                ))}
              </>
            )}
            {(unstaged.length > 0 || untracked.length > 0) && (
              <>
                <div className="git-section-label">
                  Changes ({unstaged.length + untracked.length})
                  <IconButton title="Stage all" onClick={stageAll}><Plus size={12} /></IconButton>
                </div>
                {unstaged.map((f) => (
                  <FileRow key={f.path} path={f.path} status={f.status} action={() => stageOne(f.path)} actionIcon={<Plus size={12} />} actionTitle="Stage" />
                ))}
                {untracked.map((f) => (
                  <FileRow key={f.path} path={f.path} status="untracked" action={() => stageOne(f.path)} actionIcon={<Plus size={12} />} actionTitle="Stage" />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
