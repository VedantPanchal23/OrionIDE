/**
 * Orion IDE -- Login Page
 *
 * Full-screen login page with Google OAuth button.
 * Shown when user is not authenticated.
 */

import React from 'react';
import { Code2, ArrowRight } from 'lucide-react';

const LoginPage = () => {
  const handleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#010409', fontFamily: "'Inter', sans-serif",
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Background accent glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(31,111,235,0.05) 0%, rgba(1,4,9,0) 70%)',
        zIndex: 0, pointerEvents: 'none'
      }} />

      <div style={{
        width: 440, padding: '48px 48px', borderRadius: 24,
        background: '#0d1117',
        border: '1px solid #30363d', textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.05) inset',
        zIndex: 1, position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        {/* Logo */}
        <div style={{
          width: 72, height: 72, margin: '0 auto 32px', borderRadius: 20,
          background: 'linear-gradient(135deg, #1f6feb 0%, #3fb950 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(31, 111, 235, 0.3)',
        }}>
          <Code2 size={40} color="white" strokeWidth={2} />
        </div>

        <h1 style={{
          fontSize: 32, fontWeight: 700, color: '#e6edf3', margin: '0 0 12px',
          letterSpacing: '-1px',
        }}>
          Orion IDE
        </h1>

        <p style={{
          fontSize: 15, color: '#8b949e', margin: '0 0 40px', lineHeight: 1.6,
        }}>
          The intelligent, cloud-native development environment. Built for speed and collaboration.
        </p>

        {/* Google Sign In Button */}
        <button
          onClick={handleLogin}
          style={{
            width: '100%', padding: '16px 24px', fontSize: 16, fontWeight: 600,
            color: '#e6edf3', background: '#21262d', border: '1px solid #30363d',
            borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 12, transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: "'Inter', sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#30363d';
            e.currentTarget.style.borderColor = '#1f6feb';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(31,111,235,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#21262d';
            e.currentTarget.style.borderColor = '#30363d';
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.98)';
          }}
        >
          {/* Google "G" Icon */}
          <svg width="22" height="22" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
          <ArrowRight size={18} style={{ marginLeft: 'auto', color: '#7d8590' }} />
        </button>

        <p style={{
          fontSize: 13, color: '#484f58', marginTop: 32, lineHeight: 1.6,
        }}>
          Securely integrated with Google Drive. <br/>
          Files are only accessed within the <strong>OrionIDE</strong> folder.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
