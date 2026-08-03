/**
 * Orion IDE — OAuth handoff landing page
 *
 * Backend redirects here with a one-time ?code=. We exchange it for an
 * access JWT exactly once (survives React Strict Mode double-invoke via
 * exchangeAuthCodeOnce's internal cache) then hard-navigate into the app
 * so AuthContext re-bootstraps cleanly from the freshly stored token.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { exchangeAuthCodeOnce } from '../services/authService';
import { Spinner, BrandMark, Button } from '../components/ui/primitives';

export default function AuthSuccess() {
  const [params] = useSearchParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    const code = params.get('code');
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- surface a validation error on mount
      setError('Missing authorization code.');
      return;
    }
    exchangeAuthCodeOnce(code)
      .then(() => {
        window.location.replace('/ide');
      })
      .catch((err) => {
        setError(err.message || 'Sign-in failed.');
      });
  }, [params]);

  return (
    <div className="auth-screen">
      <div className="auth-atmosphere" />
      <div className="auth-center">
        <div className="auth-brand" style={{ marginBottom: 24 }}>
          <BrandMark size={44} />
        </div>
        {error ? (
          <>
            <p style={{ color: 'var(--danger)', marginBottom: 20, maxWidth: 380 }}>{error}</p>
            <Link to="/login"><Button variant="primary">Back to sign-in</Button></Link>
          </>
        ) : (
          <>
            <Spinner size={28} />
            <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Finishing sign-in…</p>
          </>
        )}
      </div>
    </div>
  );
}
