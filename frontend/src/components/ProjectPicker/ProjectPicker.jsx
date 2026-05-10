/**
 * Orion IDE — Project Picker
 * Shows after login: list existing projects or create new one.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { listProjects } from '../../services/driveService';

const ProjectPicker = ({ onSelectProject, onCreateProject }) => {
  const [projects, setProjects] = useState([]);
  const [rootFolderId, setRootFolderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProjects();
      const data = res.data?.data || {};
      setProjects(data.projects || []);
      setRootFolderId(data.rootFolderId || null);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreateProject(rootFolderId, newName.trim());
    } catch {
      setError('Failed to create project');
    }
    setCreating(false);
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0d1117', fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: 520, maxHeight: '80vh', borderRadius: 16,
        background: 'linear-gradient(145deg, #161b22 0%, #0d1117 100%)',
        border: '1px solid #21262d', overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '32px 32px 16px', textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 16px', borderRadius: 12,
            background: 'linear-gradient(135deg, #58a6ff, #388bfd)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(88,166,255,0.3)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', margin: 0 }}>Your Projects</h2>
          <p style={{ fontSize: 13, color: '#7d8590', margin: '6px 0 0' }}>Select a project or create a new one</p>
        </div>

        {/* Create new */}
        <div style={{ padding: '0 32px 16px', display: 'flex', gap: 8 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="New project name..."
            style={{
              flex: 1, padding: '10px 14px', fontSize: 14, background: '#0d1117',
              border: '1px solid #30363d', borderRadius: 8, color: '#e6edf3',
              outline: 'none', fontFamily: "'Inter', sans-serif",
            }}
            onFocus={(e) => e.target.style.borderColor = '#58a6ff'}
            onBlur={(e) => e.target.style.borderColor = '#30363d'}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            style={{
              padding: '10px 20px', fontSize: 14, fontWeight: 600, borderRadius: 8,
              background: newName.trim() ? 'linear-gradient(135deg, #238636, #2ea043)' : '#21262d',
              border: 'none', color: newName.trim() ? '#fff' : '#484f58',
              cursor: newName.trim() ? 'pointer' : 'default', fontFamily: "'Inter', sans-serif",
              transition: 'all 0.2s',
            }}
          >
            {creating ? '...' : 'Create'}
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#21262d', margin: '0 32px' }} />

        {/* Project list */}
        <div style={{ padding: '12px 24px 24px', maxHeight: 320, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: 24, textAlign: 'center', color: '#7d8590', fontSize: 14 }}>
              Loading projects...
            </div>
          )}
          {error && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ color: '#f85149', fontSize: 13, marginBottom: 8 }}>{error}</div>
              <button onClick={load} style={{
                background: 'none', border: '1px solid #30363d', color: '#7d8590',
                padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
              }}>Retry</button>
            </div>
          )}
          {!loading && !error && projects.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#484f58', fontSize: 14 }}>
              No projects yet. Create your first one above!
            </div>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectProject(p.id, p.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s',
                margin: '2px 0',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#21262d'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: '#0d1117',
                border: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="#58a6ff">
                  <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#e6edf3' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#484f58', marginTop: 2 }}>
                  {p.modifiedTime ? new Date(p.modifiedTime).toLocaleDateString() : 'Google Drive'}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="#484f58">
                <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectPicker;
