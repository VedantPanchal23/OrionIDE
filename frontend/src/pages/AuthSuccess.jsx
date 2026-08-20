import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BrandMark, Spinner } from '../components/ui/primitives';

/** Dedupe one-time code / token bootstraps across StrictMode double-effects */
const loginLocks = new Map();

export default function AuthSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { completeLogin, completeLoginWithToken } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const code = params.get('code');
    const token = params.get('token') || params.get('accessToken');

    if (!code && !token) {
      setError('Missing auth code');
      return undefined;
    }

    const lockKey = code ? `code:${code}` : `token:${token.slice(0, 24)}`;
    let cancelled = false;

    (async () => {
      try {
        let promise = loginLocks.get(lockKey);
        if (!promise) {
          promise = (token
            ? completeLoginWithToken(token)
            : completeLogin(code)
          ).finally(() => {
            setTimeout(() => loginLocks.delete(lockKey), 60_000);
          });
          loginLocks.set(lockKey, promise);
        }
        await promise;
        if (!cancelled) navigate('/projects', { replace: true });
      } catch (err) {
        if (cancelled) return;
        const message = err?.response?.data?.error?.message || err.message || 'Login failed';
        setError(message);
      }
    })();

    return () => { cancelled = true; };
  }, [params, completeLogin, completeLoginWithToken, navigate]);

  if (error) {
    return (
      <div className="login-page">
        <div className="login-content">
          <BrandMark size={36} />
          <h1 className="login-brand">
            Orion
            <span>.</span>
          </h1>
          <p className="login-tag auth-error">{error}</p>
          <p className="login-footer">
            The one-time login code may have already been used. Sign in again, or paste an access token on the login page.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-content auth-loading">
        <BrandMark size={36} />
        <h1 className="login-brand">
          Orion
          <span>.</span>
        </h1>
        <div className="auth-loading-row">
          <Spinner />
          <span className="muted">Signing you in...</span>
        </div>
      </div>
    </div>
  );
}
