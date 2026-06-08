/**
 * Orion IDE — Root App Component
 *
 * Routes:
 *   /login         → Login page (public)
 *   /auth/success  → OAuth callback handler (extracts token, redirects to /ide)
 *   /ide           → Project picker → IDE layout (protected)
 *   /              → Redirects to /ide
 */

import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EditorProvider } from './context/EditorContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast/Toast';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import LoginPage from './components/Auth/LoginPage';
import AuthSuccess from './pages/AuthSuccess';
import ProjectPicker from './components/ProjectPicker/ProjectPicker';
import IDELayout from './components/Layout/IDELayout';
import { createFolder } from './services/driveService';

/**
 * ProtectedRoute — redirects to /login if user is not authenticated.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-default)', color: 'var(--text-primary)',
        fontFamily: 'var(--font-ui)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid var(--bg-emphasis)', borderTopColor: 'var(--info)',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ fontSize: 'var(--font-size-base)' }}>Loading Orion IDE...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * IDEPage — manages project selection state.
 * Shows ProjectPicker first, then IDELayout once a project is selected.
 */
function IDEPage() {
  const [project, setProject] = useState(null); // { id, name }

  const handleSelectProject = useCallback((projectId, projectName) => {
    setProject({ id: projectId, name: projectName });
  }, []);

  const handleCreateProject = useCallback(async (parentFolderId, name) => {
    const res = await createFolder(parentFolderId, name);
    const created = res.data?.data;
    if (created) {
      setProject({ id: created.id, name: created.name || name });
    }
  }, []);

  const handleBackToProjects = useCallback(() => {
    setProject(null);
  }, []);

  if (!project) {
    return (
      <ProjectPicker
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
      />
    );
  }

  return (
    <EditorProvider>
      <IDELayout
        projectId={project.id}
        projectName={project.name}
        onBackToProjects={handleBackToProjects}
      />
    </EditorProvider>
  );
}

/**
 * App — root component with routing.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/success" element={<AuthSuccess />} />
                <Route path="/ide" element={<ProtectedRoute><IDEPage /></ProtectedRoute>} />
                <Route path="/" element={<Navigate to="/ide" replace />} />
                <Route path="/auth/callback" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/ide" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
