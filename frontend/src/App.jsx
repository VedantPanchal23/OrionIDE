import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthSuccess from './pages/AuthSuccess';
import ProjectPicker from './pages/ProjectPicker';
import IdePage from './pages/IdePage';
import BillingPage from './pages/BillingPage';
import { Spinner } from './components/ui/primitives';

function Protected({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="login-page">
        <Spinner size={28} />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="login-page">
        <Spinner size={28} />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/projects" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={(
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        )}
      />
      <Route path="/auth/success" element={<AuthSuccess />} />
      <Route
        path="/projects"
        element={(
          <Protected>
            <ProjectPicker />
          </Protected>
        )}
      />
      <Route
        path="/ide/:projectId"
        element={(
          <Protected>
            <IdePage />
          </Protected>
        )}
      />
      <Route
        path="/billing"
        element={(
          <Protected>
            <BillingPage />
          </Protected>
        )}
      />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
