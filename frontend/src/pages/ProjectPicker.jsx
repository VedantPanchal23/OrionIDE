/**
 * Orion IDE — Project picker
 */

import { useCallback, useEffect, useState } from 'react';
import { FolderKanban, Plus, LogOut, Clock } from 'lucide-react';
import * as driveService from '../services/driveService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Button, IconButton, Input, Spinner, EmptyState, BrandMark,
} from '../components/ui/primitives';

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ProjectPicker({ onSelectProject }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [rootFolderId, setRootFolderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await driveService.listProjects();
      const data = res.data?.data || {};
      setProjects(data.projects || []);
      setRootFolderId(data.rootFolderId || null);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch project list on mount
  useEffect(() => { load(); }, [load]);

  const submitCreate = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !rootFolderId || busy) return;
    const clash = projects.some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (clash) {
      toast.error(`A project named "${name}" already exists`);
      return;
    }
    setBusy(true);
    try {
      const res = await driveService.createFolder(rootFolderId, name);
      const created = res.data?.data;
      toast.success(`Created "${name}"`);
      setCreating(false);
      setNewName('');
      if (created) onSelectProject(created.id, created.name || name);
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.error(err.response.data?.error?.message || 'A project with that name already exists');
      } else {
        toast.error(err?.response?.data?.error?.message || 'Failed to create project');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="picker-screen">
      <div className="picker-top">
        <div className="picker-brand">
          <BrandMark size={24} />
          <span>Orion IDE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.name || user.email}</span>
          )}
          <IconButton title="Sign out" onClick={logout}><LogOut size={16} /></IconButton>
        </div>
      </div>

      <div className="picker-body">
        <div className="picker-heading">
          <div>
            <h1>Your projects</h1>
            <p>Folders inside your Drive’s OrionIDE workspace.</p>
          </div>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New project
          </Button>
        </div>

        {creating && (
          <form onSubmit={submitCreate} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Input
              autoFocus
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
              disabled={busy}
            />
            <Button variant="primary" type="submit" disabled={busy || !newName.trim()}>
              {busy ? <Spinner size={14} /> : 'Create'}
            </Button>
            <Button variant="ghost" type="button" onClick={() => { setCreating(false); setNewName(''); }}>
              Cancel
            </Button>
          </form>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={32} color="var(--text-muted)" />}
            title="No projects yet"
            hint="Create your first project to start coding."
          >
            <Button variant="primary" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>
              <Plus size={16} /> New project
            </Button>
          </EmptyState>
        ) : (
          <div className="picker-list">
            {projects
              .slice()
              .sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="picker-row"
                  onClick={() => onSelectProject(p.id, p.name)}
                >
                  <span className="picker-row-icon"><FolderKanban size={16} /></span>
                  <span className="picker-row-meta">
                    <div className="picker-row-name">{p.name}</div>
                    <div className="picker-row-sub">
                      <Clock size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                      {timeAgo(p.modifiedTime)}
                    </div>
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
