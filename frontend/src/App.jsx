/**
 * Orion IDE — App root
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { Spinner } from './components/ui/primitives';
import LoginPage from './pages/LoginPage';
import AuthSuccess from './pages/AuthSuccess';
import IDEPage from './pages/IDEPage';

function BootScreen({ label = 'Loading Orion…' }) {
  return (
    <div className="boot-screen">
      <Spinner />
      <p>{label}</p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/success" element={<AuthSuccess />} />
                <Route
                  path="/ide"
                  element={(
                    <ProtectedRoute>
                      <IDEPage />
                    </ProtectedRoute>
                  )}
                />
                <Route path="/" element={<Navigate to="/ide" replace />} />
                <Route path="/auth/callback" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/ide" replace />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
