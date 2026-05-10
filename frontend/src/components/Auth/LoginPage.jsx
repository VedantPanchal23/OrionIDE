/**
 * Orion IDE -- Login Page
 *
 * Full-screen login page with Google OAuth button.
 * Shown when user is not authenticated.
 */

import React from 'react';

const LoginPage = () => {
  const handleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0d1117', fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: 420, padding: '48px 40px', borderRadius: 16,
        background: 'linear-gradient(145deg, #161b22 0%, #0d1117 100%)',
        border: '1px solid #21262d', textAlign: 'center',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Logo */}
        <div style={{
          width: 64, height: 64, margin: '0 auto 24px', borderRadius: 16,
          background: 'linear-gradient(135deg, #58a6ff 0%, #388bfd 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(88, 166, 255, 0.3)',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                  stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>

        <h1 style={{
          fontSize: 28, fontWeight: 700, color: '#e6edf3', margin: '0 0 8px',
          letterSpacing: '-0.5px',
        }}>
          Orion IDE
        </h1>

        <p style={{
          fontSize: 14, color: '#7d8590', margin: '0 0 36px', lineHeight: 1.5,
        }}>
          AI-powered cloud IDE with 18 languages,<br />
          Google Drive integration, and real-time execution.
        </p>

        {/* Google Sign In Button */}
        <button
          onClick={handleLogin}
          style={{
            width: '100%', padding: '14px 24px', fontSize: 15, fontWeight: 600,
            color: '#e6edf3', background: '#21262d', border: '1px solid #30363d',
            borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 12, transition: 'all 0.2s',
            fontFamily: "'Inter', sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#30363d';
            e.currentTarget.style.borderColor = '#58a6ff';
            e.currentTarget.style.boxShadow = '0 0 0 1px #58a6ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#21262d';
            e.currentTarget.style.borderColor = '#30363d';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Google "G" Icon */}
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google
        </button>

        <p style={{
          fontSize: 12, color: '#484f58', marginTop: 24, lineHeight: 1.5,
        }}>
          Your projects are stored securely in Google Drive.<br />
          We only access files inside the OrionIDE/ folder.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
