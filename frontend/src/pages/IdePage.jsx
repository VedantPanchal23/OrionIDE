import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { EditorProvider } from '../context/EditorContext';
import { FileTreeProvider } from '../context/FileTreeContext';
import IDEShell from '../components/ide/IDEShell';
import * as driveService from '../services/driveService';

const NAME_CACHE_KEY = 'orion_project_names';

function readCachedName(projectId) {
  try {
    const map = JSON.parse(localStorage.getItem(NAME_CACHE_KEY) || '{}');
    return map[projectId] || '';
  } catch {
    return '';
  }
}

function cacheName(projectId, name) {
  if (!projectId || !name) return;
  try {
    const map = JSON.parse(localStorage.getItem(NAME_CACHE_KEY) || '{}');
    map[projectId] = name;
    localStorage.setItem(NAME_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export default function IdePage() {
  const { projectId } = useParams();
  const location = useLocation();
  const fromState = location.state?.projectName || '';
  const [projectName, setProjectName] = useState(
    () => fromState || readCachedName(projectId) || 'Project',
  );

  useEffect(() => {
    // Warm Monaco so the first file open isn't a multi-second blank.
    import('../components/editor/MonacoEditor').catch(() => {});
  }, []);

  useEffect(() => {
    if (fromState) {
      setProjectName(fromState);
      cacheName(projectId, fromState);
      return undefined;
    }
    const cached = readCachedName(projectId);
    if (cached) setProjectName(cached);

    let cancelled = false;
    (async () => {
      try {
        const res = await driveService.listProjects();
        const projects = res?.data?.data?.projects
          || res?.data?.data?.folders
          || res?.data?.data
          || [];
        const list = Array.isArray(projects) ? projects : [];
        const hit = list.find((p) => p.id === projectId || p.folderId === projectId);
        const name = hit?.name || hit?.title;
        if (!cancelled && name) {
          setProjectName(name);
          cacheName(projectId, name);
        }
      } catch {
        /* keep cached / fallback */
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, fromState]);

  return (
    <EditorProvider key={projectId}>
      <FileTreeProvider projectId={projectId} projectName={projectName}>
        <IDEShell projectId={projectId} projectName={projectName} />
      </FileTreeProvider>
    </EditorProvider>
  );
}
