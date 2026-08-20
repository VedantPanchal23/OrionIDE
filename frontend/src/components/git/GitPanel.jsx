import { useCallback, useEffect, useState } from 'react';
import {
  Check, Eye, GitBranch, GitCommitHorizontal, RefreshCw, Upload, Download, Link2, Sparkles,
} from 'lucide-react';
import * as gitService from '../../services/gitService';
import * as agentService from '../../services/agentService';
import { useModelSettings } from '../../context/ModelSettingsContext';
import { useToast } from '../../context/ToastContext';
import { useEditor } from '../../context/EditorContext';
import { useFileTreeContext } from '../../context/FileTreeContext';
import { IconButton, Spinner } from '../ui/primitives';
import PromptModal from '../ui/PromptModal';
import DiffModal from './DiffModal';
import { FileIcon, gitStatusGlyph } from '../../utils/fileIcons';
import * as termSession from '../../lib/terminalSession';
import { formatApiError } from '../../utils/apiError';

function statusClass(st) {
  const s = String(st || '').toUpperCase();
  if (s === '??' || s === 'U' || s === '!') return 'git-st-u';
  if (s.includes('A')) return 'git-st-a';
  if (s.includes('D')) return 'git-st-d';
  if (s.includes('M') || s.includes('R') || s.includes('C')) return 'git-st-m';
  return '';
}

function fileNameFromPath(path) {
  const p = String(path || '');
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

function findNodeForGitPath(tree, gitPath) {
  const norm = String(gitPath || '').replace(/\\/g, '/');
  const base = fileNameFromPath(norm);
  const files = tree.listFilesFlat();
  const byRel = files.find((f) => {
    const parts = (tree.getPath(f.id) || []).map((n) => n.name);
    const rel = parts.slice(1).join('/');
    return rel === norm || parts.join('/') === norm || f.name === norm;
  });
  if (byRel) return byRel;
  const matches = files.filter((f) => f.name === base);
  return matches[0] || null;
}

export default function GitPanel({ projectId, onBranchChange }) {
  const toast = useToast();
  const models = useModelSettings();
  const tree = useFileTreeContext();
  const { openFile } = useEditor();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [commits, setCommits] = useState([]);
  const [branches, setBranches] = useState([]);
  const [remotes, setRemotes] = useState([]);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteName, setRemoteName] = useState('origin');
  const [cloneUrl, setCloneUrl] = useState('');
  const [branchPrompt, setBranchPrompt] = useState(false);
  const [diff, setDiff] = useState(null);
  const [showRemotes, setShowRemotes] = useState(false);
  const [prs, setPrs] = useState([]);
  const [prHint, setPrHint] = useState(null);
  const [prLoading, setPrLoading] = useState(false);

  const refreshPrs = useCallback(async () => {
    if (!projectId) return;
    setPrLoading(true);
    try {
      const res = await gitService.listPullRequests(projectId);
      const data = res.data?.data || {};
      setPrs(data.pullRequests || []);
      setPrHint(data.available === false ? (data.error || 'gh unavailable') : null);
    } catch (err) {
      setPrs([]);
      setPrHint(formatApiError(err, 'Could not list PRs'));
    } finally {
      setPrLoading(false);
    }
  }, [projectId]);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      try {
        await termSession.ensureSession(projectId);
        // Pull Drive → disk so git status sees real files (quiet if already synced)
        try { await termSession.syncWithDrive('pull'); } catch { /* may already be synced */ }
      } catch { /* status may still work if already synced */ }
      const [statusRes, logRes, branchRes, remoteRes] = await Promise.all([
        gitService.getStatus(projectId),
        gitService.getLog(projectId, 12).catch(() => null),
        gitService.getBranches(projectId).catch(() => null),
        gitService.listRemotes(projectId).catch(() => null),
      ]);
      const st = statusRes.data?.data || null;
      setStatus(st);
      if (st?.branch) onBranchChange?.(st.branch);
      setCommits(logRes?.data?.data?.commits || []);
      setBranches(branchRes?.data?.data?.branches || []);
      const list = remoteRes?.data?.data?.remotes || [];
      setRemotes(list);
      const origin = list.find((r) => r.name === 'origin') || list[0];
      if (origin?.fetch) {
        setRemoteUrl((prev) => prev || origin.fetch);
        if (origin.name) setRemoteName((prev) => (prev === 'origin' ? origin.name : prev));
      }
      refreshPrs();
    } catch (err) {
      setStatus(null);
      toast.error(err?.response?.data?.error?.message || 'Git status unavailable — sync project first');
    } finally {
      setLoading(false);
    }
  }, [projectId, toast, onBranchChange, refreshPrs]);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      await refresh();
    } catch (err) {
      toast.error(formatApiError(err, err?.response?.data?.error?.message || err.message));
    } finally {
      setBusy(false);
    }
  };

  const staged = status?.staged || [];
  const unstaged = status?.unstaged || [];
  const untracked = status?.untracked || [];
  const unmerged = status?.unmerged || [];
  const stageable = [
    ...unstaged.map((it) => (typeof it === 'string' ? it : it.path)),
    ...untracked.map((it) => (typeof it === 'string' ? it : it.path)),
  ].filter(Boolean);

  const generateMessage = async () => {
    setAiBusy(true);
    try {
      const lines = [
        ...staged.map((it) => `staged ${(typeof it === 'string' ? it : `${it.status} ${it.path}`)}`),
        ...unstaged.map((it) => `modified ${(typeof it === 'string' ? it : `${it.status} ${it.path}`)}`),
        ...untracked.map((it) => `untracked ${(typeof it === 'string' ? it : it.path)}`),
      ].slice(0, 40);
      if (!lines.length) {
        toast.info('Nothing to summarize — stage or change files first');
        return;
      }
      let diff = '';
      const samplePath = (staged[0] || unstaged[0]);
      const p = typeof samplePath === 'string' ? samplePath : samplePath?.path;
      if (p) {
        try {
          const res = await gitService.getDiff(projectId, p);
          const data = res.data?.data || {};
          diff = `--- ${p}\n${String(data.original || '').slice(0, 2000)}\n+++\n${String(data.modified || '').slice(0, 2000)}`;
        } catch { /* optional */ }
      }
      const llm = models.configured
        ? {
          provider: models.provider,
          model: models.model,
          apiKey: models.apiKey,
          baseUrl: models.baseUrl,
        }
        : null;
      const data = await agentService.generateCommitMessage({
        summary: lines.join('\n'),
        diff,
        llm,
      });
      if (data?.message) setMessage(data.message);
      else toast.info('No message returned');
    } catch (err) {
      toast.error(formatApiError(err, 'Could not generate commit message'));
    } finally {
      setAiBusy(false);
    }
  };

  const openGitPath = async (gitPath) => {
    const node = findNodeForGitPath(tree, gitPath);
    if (node) {
      try {
        await openFile(node);
      } catch (err) {
        toast.error(formatApiError(err, 'Could not open file'));
      }
      return;
    }
    toast.info('File not in loaded tree — expand Explorer folders, or view Diff');
  };

  const openDiff = async (gitPath) => {
    setBusy(true);
    try {
      const res = await gitService.getDiff(projectId, gitPath);
      const data = res.data?.data || {};
      setDiff({
        path: data.path || gitPath,
        original: data.original ?? '',
        modified: data.modified ?? '',
      });
    } catch (err) {
      toast.error(formatApiError(err, 'Diff unavailable'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="side-panel">
      <div className="ide-sidebar-title">
        <span>Source Control</span>
        <span className="title-actions">
          <IconButton title="Refresh" onClick={refresh} disabled={loading || busy}>
            {loading ? <Spinner size={12} /> : <RefreshCw size={13} />}
          </IconButton>
          <IconButton title="Pull" onClick={() => run(() => gitService.pull(projectId), 'Pulled')} disabled={busy}>
            <Download size={13} />
          </IconButton>
          <IconButton title="Push" onClick={() => run(() => gitService.push(projectId), 'Pushed')} disabled={busy}>
            <Upload size={13} />
          </IconButton>
          <IconButton
            title="Create GitHub PR (gh pr create)"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('orion-term-input', {
                detail: { text: 'gh pr create --fill\n' },
              }));
              toast.info('Sent to Terminal — run gh auth login first if needed');
            }}
            disabled={busy}
          >
            <Link2 size={13} />
          </IconButton>
        </span>
      </div>

      <div className="side-panel-body">
        <div className="git-branch">
          <GitBranch size={13} />
          <select
            className="git-branch-select"
            value={status?.branch || ''}
            disabled={busy || branches.length === 0}
            onChange={(e) => {
              const branch = e.target.value;
              if (!branch || branch === status?.branch) return;
              run(() => gitService.checkout(projectId, branch), `Checked out ${branch}`);
            }}
          >
            {(branches.length ? branches : [{ name: status?.branch || '—', current: true }]).map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
                {b.current ? ' *' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="git-action"
            disabled={busy}
            onClick={() => setBranchPrompt(true)}
          >
            +
          </button>
        </div>

        <div className="git-commit-box">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message"
            rows={3}
          />
          <div className="git-commit-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy || aiBusy}
              title="Generate commit message with AI"
              onClick={generateMessage}
            >
              {aiBusy ? <Spinner size={12} /> : <Sparkles size={14} />}
              AI message
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy || stageable.length === 0}
              onClick={() => run(() => gitService.stageAll(projectId, stageable), 'Staged all')}
            >
              Stage all
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || !message.trim() || staged.length === 0 || unmerged.length > 0}
              onClick={() => run(async () => {
                await gitService.commit(projectId, message.trim());
                setMessage('');
              }, 'Committed')}
            >
              <GitCommitHorizontal size={14} />
              Commit
            </button>
          </div>
        </div>

        <div className="git-section">
          <div className="search-section-label">
            Pull requests
            <span className="title-actions">
              <IconButton title="Refresh PRs" onClick={refreshPrs} disabled={prLoading || busy}>
                {prLoading ? <Spinner size={12} /> : <RefreshCw size={12} />}
              </IconButton>
            </span>
          </div>
          {prHint && <p className="settings-hint">{prHint}</p>}
          {prs.length === 0 && !prHint ? (
            <p className="settings-hint">No open PRs (or not connected). Create via toolbar Link / Terminal.</p>
          ) : (
            <ul className="git-list">
              {prs.map((pr) => (
                <li key={pr.number} className="git-row git-pr-row">
                  <span className="git-status">#{pr.number}</span>
                  <span className="git-path" title={pr.title}>{pr.title}</span>
                  <button
                    type="button"
                    className="git-action"
                    disabled={busy}
                    title="Checkout PR branch"
                    onClick={() => run(
                      () => gitService.checkoutPullRequest(projectId, pr.number),
                      `Checked out PR #${pr.number}`,
                    )}
                  >
                    Checkout
                  </button>
                  {pr.url && (
                    <a className="git-action" href={pr.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {unmerged.length > 0 && (
          <div className="git-section git-conflicts">
            <div className="search-section-label">
              Merge conflicts
              <span className="count">{unmerged.length}</span>
            </div>
            <p className="settings-hint">Accept Current (ours), Incoming (theirs), or Both, then commit.</p>
            <ul className="git-list">
              {unmerged.map((it) => {
                const path = typeof it === 'string' ? it : it.path;
                return (
                  <li key={path} className="git-row git-conflict-row">
                    <span className="git-status git-st-u">!</span>
                    <FileIcon name={fileNameFromPath(path)} size={14} />
                    <button type="button" className="git-path" title={path} onClick={() => openGitPath(path)}>
                      {path}
                    </button>
                    <button
                      type="button"
                      className="git-action"
                      disabled={busy}
                      onClick={() => run(() => gitService.resolveConflict(projectId, path, 'ours'), 'Kept ours')}
                    >
                      Ours
                    </button>
                    <button
                      type="button"
                      className="git-action"
                      disabled={busy}
                      onClick={() => run(() => gitService.resolveConflict(projectId, path, 'theirs'), 'Took theirs')}
                    >
                      Theirs
                    </button>
                    <button
                      type="button"
                      className="git-action"
                      disabled={busy}
                      onClick={() => run(() => gitService.resolveConflict(projectId, path, 'both'), 'Kept both')}
                    >
                      Both
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => run(() => gitService.abortMerge(projectId), 'Merge aborted')}
            >
              Abort merge
            </button>
          </div>
        )}

        <Section
          title="Staged"
          count={staged.length}
          items={staged}
          actionLabel="Unstage"
          onAction={(path) => run(() => gitService.unstage(projectId, [path]))}
          onOpen={openGitPath}
          onDiff={openDiff}
        />
        <Section
          title="Changes"
          count={unstaged.length}
          items={unstaged}
          actionLabel="Stage"
          onAction={(path) => run(() => gitService.stage(projectId, [path]))}
          onOpen={openGitPath}
          onDiff={openDiff}
        />
        <Section
          title="Untracked"
          count={untracked.length}
          items={untracked}
          actionLabel="Stage"
          onAction={(path) => run(() => gitService.stage(projectId, [path]))}
          onOpen={openGitPath}
        />

        <div className="search-section-label">
          History
          <span className="count">{commits.length}</span>
        </div>
        {commits.length === 0 ? (
          <div className="side-empty">No commits yet</div>
        ) : (
          <ul className="git-log">
            {commits.map((c) => (
              <li key={c.hash}>
                <span className="git-hash">{(c.hash || '').slice(0, 7)}</span>
                <span className="git-msg" title={c.message}>{c.message}</span>
                <span className="muted">{c.author}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="search-section-label git-more-toggle"
          onClick={() => setShowRemotes((v) => !v)}
        >
          <Link2 size={12} />
          <span>{showRemotes ? 'Hide remotes & clone' : 'Remotes & clone'}</span>
          <span className="count">{remotes.length || 0}</span>
        </button>
        {showRemotes && (
          <>
            {remotes.length > 0 && (
              <ul className="git-list git-remotes">
                {remotes.map((r) => (
                  <li key={r.name} className="git-row">
                    <span className="git-status">{r.name}</span>
                    <span className="git-path" title={r.fetch || r.push}>{r.fetch || r.push}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="git-remote-form">
              <input
                value={remoteName}
                onChange={(e) => setRemoteName(e.target.value)}
                placeholder="origin"
                aria-label="Remote name"
              />
              <input
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="https://github.com/org/repo.git"
                aria-label="Remote URL"
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy || !remoteUrl.trim()}
                onClick={() => run(
                  () => gitService.setRemote(projectId, { name: remoteName.trim() || 'origin', url: remoteUrl.trim() }),
                  'Remote saved',
                )}
              >
                Set remote
              </button>
            </div>
            <div className="git-remote-form">
              <input
                value={cloneUrl}
                onChange={(e) => setCloneUrl(e.target.value)}
                placeholder="Clone into workspace (empty folder)"
                aria-label="Clone URL"
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy || !cloneUrl.trim()}
                onClick={() => run(
                  () => gitService.cloneRemote(projectId, { url: cloneUrl.trim() }),
                  'Cloned',
                )}
              >
                Clone
              </button>
            </div>
          </>
        )}

        {!status && !loading && (
          <div className="side-empty polished">
            <p className="side-empty-title">No git status yet</p>
            <p>Open Terminal and sync the project, then refresh Source Control.</p>
          </div>
        )}
      </div>

      <PromptModal
        open={branchPrompt}
        title="New Branch"
        label="Branch name"
        initialValue=""
        placeholder="feature/my-branch"
        confirmLabel="Create"
        onCancel={() => setBranchPrompt(false)}
        onSubmit={(name) => {
          setBranchPrompt(false);
          const trimmed = String(name || '').trim();
          if (!trimmed) return;
          run(
            () => gitService.checkout(projectId, trimmed, true),
            `Created ${trimmed}`,
          );
        }}
      />

      <DiffModal
        open={Boolean(diff)}
        path={diff?.path}
        title={diff?.path}
        original={diff?.original}
        modified={diff?.modified}
        onClose={() => setDiff(null)}
      />
    </div>
  );
}

function Section({ title, count, items, actionLabel, onAction, onOpen, onDiff }) {
  if (!items?.length) return null;
  return (
    <div className="git-section">
      <div className="search-section-label">
        {title}
        <span className="count">{count}</span>
      </div>
      <ul className="git-list">
        {items.map((it) => {
          const path = typeof it === 'string' ? it : it.path;
          const st = gitStatusGlyph(
            typeof it === 'string' ? '' : it.status,
            title,
          );
          return (
            <li key={path} className="git-row">
              <span className={`git-status ${statusClass(st)}`} title={typeof it === 'object' ? it.status : title}>
                {st}
              </span>
              <FileIcon name={fileNameFromPath(path)} size={14} />
              <button
                type="button"
                className="git-path"
                title={path}
                onClick={() => onOpen?.(path)}
              >
                {path}
              </button>
              {onDiff && (
                <button type="button" className="git-action" title="View diff" onClick={() => onDiff(path)}>
                  <Eye size={12} />
                  Diff
                </button>
              )}
              <button type="button" className="git-action" onClick={() => onAction(path)}>
                <Check size={12} />
                {actionLabel}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
