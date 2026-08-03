/**
 * Orion IDE — authenticated app root: project state + editor session + shell
 */

import { useCallback, useState } from 'react';
import { EditorProvider } from '../context/EditorContext';
import IDEShell from '../components/ide/IDEShell';
import ProjectPicker from './ProjectPicker';

export default function IDEPage() {
  const [project, setProject] = useState(null);

  const handleSelectProject = useCallback((id, name) => {
    setProject({ id, name });
  }, []);

  const handleBackToProjects = useCallback(() => {
    setProject(null);
  }, []);

  if (!project) {
    return <ProjectPicker onSelectProject={handleSelectProject} />;
  }

  return (
    <EditorProvider key={project.id} projectId={project.id}>
      <IDEShell
        projectId={project.id}
        projectName={project.name}
        onSwitchProject={handleSelectProject}
        onBackToProjects={handleBackToProjects}
      />
    </EditorProvider>
  );
}
