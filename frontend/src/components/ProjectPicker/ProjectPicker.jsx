/**
 * Orion IDE — Project Picker
 * Shows after login: list existing projects or create new one.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { listProjects } from '../../services/driveService';
import { Folder, ChevronRight, Code2, Plus, Search, Clock } from 'lucide-react';

const ProjectPicker = ({ onSelectProject, onCreateProject }) => {
  const [projects, setProjects] = useState([]);
  const [rootFolderId, setRootFolderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#010409', fontFamily: "'Inter', sans-serif",
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Background accent glow */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-10%',
        width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(31,111,235,0.06) 0%, rgba(1,4,9,0) 70%)',
        zIndex: 0, pointerEvents: 'none'
      }} />

      <div style={{
        width: 600, maxHeight: '85vh', borderRadius: 20,
        background: '#0d1117',
        border: '1px solid #30363d', overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset',
        zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '32px 32px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #1f6feb, #3fb950)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(31, 111, 235, 0.25)',
            flexShrink: 0
          }}>
            <Code2 size={28} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#e6edf3', margin: 0, letterSpacing: '-0.5px' }}>Welcome back</h2>
            <p style={{ fontSize: 14, color: '#8b949e', margin: '4px 0 0' }}>Select a recent project or start a new one</p>
          </div>
        </div>

        {/* Create new */}
        <div style={{ padding: '0 32px 24px', display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#7d8590' }}>
              <Plus size={18} />
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Create new project..."
              style={{
                width: '100%', padding: '12px 14px 12px 42px', fontSize: 14, background: '#161b22',
                border: '1px solid #30363d', borderRadius: 10, color: '#e6edf3',
                outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#1f6feb';
                e.target.style.boxShadow = '0 0 0 1px #1f6feb';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#30363d';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            style={{
              padding: '0 24px', fontSize: 14, fontWeight: 600, borderRadius: 10,
              background: newName.trim() ? '#238636' : '#21262d',
              border: '1px solid',
              borderColor: newName.trim() ? '#2ea043' : '#30363d',
              color: newName.trim() ? '#fff' : '#484f58',
              cursor: newName.trim() ? 'pointer' : 'default', fontFamily: "'Inter', sans-serif",
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>

        {/* Search & List Header */}
        <div style={{ padding: '0 32px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#7d8590', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Recent Projects
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#7d8590' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              style={{
                background: 'transparent', border: 'none', borderBottom: '1px solid #30363d',
                color: '#c9d1d9', fontSize: 13, padding: '4px 4px 4px 28px', width: 140,
                outline: 'none', fontFamily: "'Inter', sans-serif", transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderBottomColor = '#58a6ff'}
              onBlur={(e) => e.target.style.borderBottomColor = '#30363d'}
            />
          </div>
        </div>

        {/* Project list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px', minHeight: 200 }}>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: '#7d8590', fontSize: 14 }}>
              Loading your workspace...
            </div>
          )}
          {error && (
            <div style={{ padding: 24, textAlign: 'center', background: '#21262d', borderRadius: 12, margin: '0 12px' }}>
              <div style={{ color: '#f85149', fontSize: 14, marginBottom: 12 }}>{error}</div>
              <button onClick={load} style={{
                background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9',
                padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500
              }}>Try Again</button>
            </div>
          )}
          {!loading && !error && projects.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: '#8b949e', fontSize: 15 }}>
              No projects found. Create your first workspace above!
            </div>
          )}
          {!loading && !error && projects.length > 0 && filteredProjects.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#7d8590', fontSize: 14 }}>
              No projects match "{searchQuery}"
            </div>
          )}
          
          <div style={{ display: 'grid', gap: 6 }}>
            {filteredProjects.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectProject(p.id, p.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
                  borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s ease',
                  border: '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#161b22';
                  e.currentTarget.style.borderColor = '#30363d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: '#21262d',
                  border: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Folder size={20} color="#58a6ff" strokeWidth={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#7d8590', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={12} />
                    {p.modifiedTime ? new Date(p.modifiedTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Google Drive'}
                  </div>
                </div>
                <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#21262d' }}>
                  <ChevronRight size={16} color="#8b949e" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectPicker;
