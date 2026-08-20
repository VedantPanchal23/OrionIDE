import { motion } from 'framer-motion';
import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startGoogleLogin } from '../services/authService';
import { useAuth } from '../context/AuthContext';

const OrionScene = lazy(() => import('../components/brand/OrionScene'));

export default function LoginPage() {
  const navigate = useNavigate();
  const { completeLoginWithToken } = useAuth();
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [googleBusy, setGoogleBusy] = useState(false);

  const onGoogle = () => {
    setGoogleBusy(true);
    setError(null);
    try {
      startGoogleLogin();
    } catch (err) {
      setGoogleBusy(false);
      setError(err?.message || 'Could not start Google login');
    }
  };

  const submitToken = async (e) => {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await completeLoginWithToken(trimmed);
      navigate('/projects', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error?.message || err.message || 'Invalid token');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <Suspense fallback={null}>
        <OrionScene variant="login" className="login-scene" />
      </Suspense>

      <motion.div
        className="login-content"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="login-brand">
          Orion
          <span>.</span>
        </h1>
        <p className="login-tag">
          A modern open-source IDE for your Drive — bring your own models, run code, ship faster.
        </p>
        <button type="button" className="btn btn-google" onClick={onGoogle} disabled={googleBusy || busy}>
          {googleBusy ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <button
          type="button"
          className="login-token-toggle"
          onClick={() => setShowToken((v) => !v)}
        >
          {showToken ? 'Hide token login' : 'Use access token'}
        </button>

        {showToken && (
          <form className="login-token-form" onSubmit={submitToken}>
            <textarea
              className="login-token-input"
              rows={3}
              placeholder="Paste JWT access token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              spellCheck={false}
            />
            {error && <p className="login-token-error">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy || !token.trim()}>
              {busy ? 'Signing in…' : 'Continue with token'}
            </button>
          </form>
        )}

        <p className="login-footer">Free forever. Your keys, your models.</p>
      </motion.div>
    </div>
  );
}
