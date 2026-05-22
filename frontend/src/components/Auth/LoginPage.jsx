/**
 * Orion IDE — Login Page
 *
 * Premium full-screen login with animated background,
 * feature highlights, and Google OAuth.
 */

import React, { useState } from 'react';
import { Code2, ArrowRight, Zap, Shield, Cloud, Terminal } from 'lucide-react';

const FEATURES = [
  { icon: Zap, label: 'AI-Powered', desc: 'Intelligent code completion & agents' },
  { icon: Terminal, label: 'Full Terminal', desc: 'Interactive shell with PTY support' },
  { icon: Cloud, label: 'Cloud Native', desc: 'Google Drive sync, zero local setup' },
  { icon: Shield, label: 'Secure', desc: 'OAuth 2.0, sandboxed execution' },
];

const LoginPage = () => {
  const [hovering, setHovering] = useState(false);

  const handleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex',
      background: 'var(--bg-canvas)', fontFamily: 'var(--font-ui)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* ── Animated background grid ────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(31,111,235,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(31,111,235,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '64px 64px',
      }} />
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: '60vw', height: '60vw',
        background: 'radial-gradient(circle, rgba(31,111,235,0.08) 0%, transparent 60%)',
        zIndex: 0, pointerEvents: 'none', animation: 'pulse 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', right: '-15%',
        width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(63,185,80,0.06) 0%, transparent 60%)',
        zIndex: 0, pointerEvents: 'none',
      }} />

      {/* ── Left panel — branding ───────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '80px 80px', zIndex: 1, position: 'relative',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-green) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(31, 111, 235, 0.3)',
          }}>
            <Code2 size={32} color="white" strokeWidth={2} />
          </div>
          <div>
            <span style={{
              fontSize: 'var(--font-size-xl)', fontWeight: 700,
              color: 'var(--text-primary)', letterSpacing: '-0.5px',
            }}>
              Orion IDE
            </span>
            <span style={{
              fontSize: 'var(--font-size-xs)', fontWeight: 600,
              color: 'var(--accent-blue)', marginLeft: 8,
              padding: '2px 8px', background: 'rgba(31,111,235,0.1)',
              borderRadius: 'var(--radius-sm)', verticalAlign: 'super',
            }}>
              BETA
            </span>
          </div>
        </div>

        <h1 style={{
          fontSize: 48, fontWeight: 800, color: 'var(--text-primary)',
          margin: '0 0 16px', lineHeight: 1.1, letterSpacing: '-2px',
          maxWidth: 500,
        }}>
          Code anywhere.{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-green-emphasis))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Ship faster.
          </span>
        </h1>

        <p style={{
          fontSize: 'var(--font-size-lg)', color: 'var(--text-secondary)',
          margin: '0 0 48px', lineHeight: 1.7, maxWidth: 440,
        }}>
          The cloud-native IDE with AI agents, interactive terminals,
          and Google Drive integration. No setup required.
        </p>

        {/* Feature grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 460,
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '14px 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-default)', border: '1px solid var(--border-default)',
            }}>
              <f.icon size={18} color="var(--accent-blue)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{
                  fontSize: 'var(--font-size-md)', fontWeight: 600,
                  color: 'var(--text-primary)', marginBottom: 2,
                }}>
                  {f.label}
                </div>
                <div style={{
                  fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', lineHeight: 1.4,
                }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — login card ────────────────────────────── */}
      <div style={{
        width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderLeft: '1px solid var(--border-default)', zIndex: 1,
        background: 'var(--bg-default)',
      }}>
        <div style={{ width: 340, padding: '0 24px' }}>
          <h2 style={{
            fontSize: 'var(--font-size-2xl)', fontWeight: 700,
            color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.5px',
          }}>
            Get started
          </h2>
          <p style={{
            fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)',
            margin: '0 0 32px', lineHeight: 1.6,
          }}>
            Sign in with Google to sync your projects via Drive.
          </p>

          {/* Google Sign In Button */}
          <button
            onClick={handleLogin}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            style={{
              width: '100%', padding: '14px 24px', fontSize: 'var(--font-size-base)',
              fontWeight: 600, color: 'var(--text-primary)',
              background: hovering ? 'var(--bg-emphasis)' : 'var(--bg-subtle)',
              border: `1px solid ${hovering ? 'var(--accent-blue)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              fontFamily: 'var(--font-ui)',
              transform: hovering ? 'translateY(-2px)' : 'none',
              boxShadow: hovering ? '0 8px 24px rgba(31,111,235,0.15)' : 'none',
            }}
          >
            {/* Google icon */}
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
            <ArrowRight size={16} style={{ marginLeft: 'auto', opacity: hovering ? 1 : 0.5, transition: 'opacity 0.2s' }} />
          </button>

          <div style={{
            marginTop: 24, padding: '16px 0', borderTop: '1px solid var(--border-default)',
          }}>
            <p style={{
              fontSize: 'var(--font-size-xs)', color: 'var(--text-disabled)',
              margin: 0, lineHeight: 1.6, textAlign: 'center',
            }}>
              Files are stored in your Google Drive under{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>OrionIDE</span>.
              We only access that folder.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
