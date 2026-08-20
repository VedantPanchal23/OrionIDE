import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, LogOut, Moon, Plus, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import * as driveService from '../services/driveService';
import { formatApiError } from '../utils/apiError';
import { IconButton, Spinner } from '../components/ui/primitives';
import { PROJECT_TEMPLATES } from '../templates/projectTemplates';

export default function ProjectPicker() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('blank');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await driveService.listProjects();
      setProjects(res.data?.data?.projects || res.data?.data || []);
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to load projects'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await driveService.createProject(trimmed, { template });
      const project = res.data?.data;
      const tpl = PROJECT_TEMPLATES.find((t) => t.id === template);
      const hints = {
        'vite-react': 'React project created — Terminal: npm install, then vite dev chip',
        flask: 'Flask project created — Terminal: venv → pip install → flask run / python3 app.py',
        express: 'Express project created — Terminal: npm install && npm start',
        cpp: 'C++ project created — Terminal: g++ run chip or ▶ Run',
        python: 'Python project created — ▶ Run or python3 hello.py',
      };
      toast.success(hints[tpl?.id] || 'Project created');
      setName('');
      if (project?.id) {
        navigate(`/ide/${project.id}`, {
          state: { projectName: project.name, template },
        });
      } else await load();
    } catch (err) {
      toast.error(formatApiError(err, 'Create failed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="picker-page">
      <header className="picker-top">
        <h1>
          Orion
          {' '}
          <span style={{ color: 'var(--accent)' }}>projects</span>
        </h1>
        <div className="picker-top-actions">
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.email || user?.name}</span>
          <IconButton title="Theme" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
          <IconButton title="Log out" onClick={() => logout().then(() => navigate('/login'))}>
            <LogOut size={16} />
          </IconButton>
        </div>
      </header>

      <div className="picker-body">
        <form className="create-row create-row-templates" onSubmit={create}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name"
            aria-label="New project name"
          />
          <select
            className="picker-template"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            aria-label="Project template"
            title="Project template"
          >
            {PROJECT_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary" disabled={creating || !name.trim()}>
            {creating ? <Spinner /> : <Plus size={16} />}
            Create
          </button>
        </form>
        <p className="picker-template-hint muted">
          {PROJECT_TEMPLATES.find((t) => t.id === template)?.description}
        </p>

        {loading ? (
          <div className="picker-empty"><Spinner /></div>
        ) : projects.length === 0 ? (
          <div className="picker-empty">
            <FolderKanban size={36} style={{ opacity: 0.5, marginBottom: 8 }} />
            <p>No projects yet. Create one to open the IDE.</p>
          </div>
        ) : (
          <ul className="project-grid">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="project-card"
                  onClick={() => navigate(`/ide/${p.id}`, { state: { projectName: p.name } })}
                >
                  <h3>{p.name}</h3>
                  <p>{p.modifiedTime ? new Date(p.modifiedTime).toLocaleString() : 'Open workspace'}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
