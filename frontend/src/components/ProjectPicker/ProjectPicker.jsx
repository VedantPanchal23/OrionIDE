/**
 * Orion IDE — Project Picker
 *
 * Premium project selection screen with search, create,
 * and recent project cards.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { listProjects } from '../../services/driveService';
import { useAuth } from '../../context/AuthContext';
import {
  Folder, FolderOpen, ChevronRight, Code2, Plus,
  Search, Clock, Loader2, AlertCircle, LogOut
} from 'lucide-react';

const ProjectPicker = ({ onSelectProject, onCreateProject }) => {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [rootFolderId, setRootFolderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

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
    if (!newName.trim() || !rootFolderId) return;
    setCreating(true);
    try {
      await onCreateProject(rootFolderId, newName.trim());
      setNewName(''); // Clear input on success
    } catch {
      setError('Failed to create project');
    }
    setCreating(false);
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Google Drive';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH < 1) return 'Just now';
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-canvas)', fontFamily: 'var(--font-ui)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%',
        width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(31,111,235,0.05) 0%, transparent 60%)',
        zIndex: 0, pointerEvents: 'none',
      }} />

      {/* User badge — top right */}
      {user && (
        <div style={{
          position: 'absolute', top: 20, right: 24, zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            background: 'var(--bg-default)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
          }}>
            {user.picture ? (
              <img src={user.picture} alt="" style={{
                width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border-default)',
              }} />
            ) : (
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-blue)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
              }}>
                {(user.name || '?')[0].toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {user.name || user.email}
            </span>
          </div>
          <button onClick={logout} title="Sign out" style={{
            background: 'var(--bg-default)', border: '1px solid var(--border-default)',
            color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)',
            padding: '6px 8px', cursor: 'pointer', display: 'flex',
          }}>
            <LogOut size={14} />
          </button>
        </div>
      )}

      <div style={{
        width: 640, maxHeight: '85vh', borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-default)', border: '1px solid var(--border-default)',
        overflow: 'hidden', boxShadow: 'var(--shadow-xl)',
        zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '32px 32px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-green))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(31,111,235,0.25)', flexShrink: 0,
          }}>
            <Code2 size={26} color="white" />
          </div>
          <div>
            <h2 style={{
              fontSize: 'var(--font-size-2xl)', fontWeight: 700,
              color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px',
            }}>
              Your Workspace
            </h2>
            <p style={{
              fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', margin: '4px 0 0',
            }}>
              Open a project or create a new one
            </p>
          </div>
        </div>

        {/* Create new project */}
        <div style={{ padding: '0 32px 20px', display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Plus size={16} style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="New project name..."
              style={{
                width: '100%', padding: '11px 14px 11px 40px',
                fontSize: 'var(--font-size-base)', background: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-ui)',
                boxSizing: 'border-box', transition: 'border-color var(--transition-normal)',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent-blue)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            style={{
              padding: '0 20px', fontSize: 'var(--font-size-base)', fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              background: newName.trim() ? 'var(--accent-green)' : 'var(--bg-emphasis)',
              border: 'none',
              color: newName.trim() ? '#fff' : 'var(--text-disabled)',
              cursor: newName.trim() ? 'pointer' : 'default', fontFamily: 'var(--font-ui)',
              transition: 'all var(--transition-normal)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {creating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>

        {/* Search & list header */}
        <div style={{
          padding: '0 32px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Recent Projects ({filteredProjects.length})
          </span>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{
              position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              style={{
                background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)',
                padding: '5px 10px 5px 26px', width: 140, borderRadius: 'var(--radius-sm)',
                outline: 'none', fontFamily: 'var(--font-ui)',
                transition: 'border-color var(--transition-normal)',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent-blue)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
            />
          </div>
        </div>

        {/* Project list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px', minHeight: 200 }}>
          {loading && (
            <div style={{
              padding: 48, textAlign: 'center', color: 'var(--text-muted)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}>
              <Loader2 size={24} className="spin" />
              <span style={{ fontSize: 'var(--font-size-base)' }}>Loading workspace...</span>
            </div>
          )}
          {error && (
            <div style={{
              padding: 24, textAlign: 'center', background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)', margin: '0 8px',
              border: '1px solid var(--border-default)',
            }}>
              <AlertCircle size={20} color="var(--error)" style={{ marginBottom: 8 }} />
              <div style={{ color: 'var(--error)', fontSize: 'var(--font-size-base)', marginBottom: 12 }}>{error}</div>
              <button onClick={load} style={{
                background: 'var(--bg-emphasis)', border: '1px solid var(--border-default)',
                color: 'var(--text-primary)', padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 600,
              }}>Try Again</button>
            </div>
          )}
          {!loading && !error && projects.length === 0 && (
            <div style={{
              padding: 48, textAlign: 'center', color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-base)',
            }}>
              <Folder size={40} color="var(--text-disabled)" style={{ margin: '0 auto 16px', display: 'block' }} />
              No projects yet. Create your first one above!
            </div>
          )}
          {!loading && !error && projects.length > 0 && filteredProjects.length === 0 && (
            <div style={{
              padding: 32, textAlign: 'center', color: 'var(--text-muted)',
              fontSize: 'var(--font-size-base)',
            }}>
              No projects match "{searchQuery}"
            </div>
          )}

          <div style={{ display: 'grid', gap: 4 }}>
            {filteredProjects.map((p) => {
              const isHovered = hoveredId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectProject(p.id, p.name)}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    transition: 'all var(--transition-normal)',
                    background: isHovered ? 'var(--bg-subtle)' : 'transparent',
                    border: `1px solid ${isHovered ? 'var(--border-default)' : 'transparent'}`,
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-md)',
                    background: isHovered ? 'rgba(31,111,235,0.1)' : 'var(--bg-emphasis)',
                    border: `1px solid ${isHovered ? 'rgba(31,111,235,0.2)' : 'var(--border-default)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all var(--transition-normal)',
                  }}>
                    {isHovered
                      ? <FolderOpen size={20} color="var(--accent-blue)" />
                      : <Folder size={20} color="var(--text-muted)" />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--font-size-base)', fontWeight: 600,
                      color: 'var(--text-primary)', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.name}
                    </div>
                    <div style={{
                      fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
                      marginTop: 3, display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Clock size={11} />
                      {formatDate(p.modifiedTime)}
                    </div>
                  </div>
                  <ChevronRight size={16} color={isHovered ? 'var(--accent-blue)' : 'var(--text-disabled)'}
                    style={{ transition: 'color var(--transition-normal)', flexShrink: 0 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectPicker;
