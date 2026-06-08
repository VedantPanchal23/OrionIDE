/**
 * Orion IDE — Auth Success Page
 *
 * Handles the OAuth redirect callback from the auth service.
 * Extracts the access token from URL params, stores it via AuthContext,
 * and waits for user data to load before redirecting.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthSuccess() {
  const [searchParams] = useSearchParams();
  const { setToken, user } = useAuth();
  const navigate = useNavigate();
  const [tokenSet, setTokenSet] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error || !token) {
      navigate('/login?error=' + (error || 'no_token'), { replace: true });
      return;
    }

    // setToken is async — it fetches user info from /api/auth/me.
    // We wait for the user state to update before navigating.
    setToken(token).then(() => setTokenSet(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate once user data is loaded
  useEffect(() => {
    if (tokenSet && user) {
      navigate('/ide', { replace: true });
    }
  }, [tokenSet, user, navigate]);

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
        <p style={{ fontSize: 'var(--font-size-base)' }}>Signing you in...</p>
      </div>
    </div>
  );
}
