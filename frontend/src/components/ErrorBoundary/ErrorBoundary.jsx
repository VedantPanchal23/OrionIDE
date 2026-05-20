/**
 * Orion IDE — Error Boundary
 *
 * Catches unhandled React errors and shows a recovery UI
 * instead of a blank white screen.
 */

import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[Orion IDE] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100vw', height: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'var(--bg-canvas)', fontFamily: 'var(--font-ui)',
        }}>
          <div style={{
            maxWidth: 480, padding: '48px 40px', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-default)', border: '1px solid var(--border-default)',
            textAlign: 'center', boxShadow: 'var(--shadow-xl)',
          }}>
            <div style={{
              width: 64, height: 64, margin: '0 auto 24px', borderRadius: 'var(--radius-lg)',
              background: 'rgba(248, 81, 73, 0.1)', display: 'flex', alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AlertTriangle size={32} color="var(--error)" />
            </div>

            <h1 style={{
              fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--text-primary)',
              margin: '0 0 8px', letterSpacing: '-0.5px',
            }}>
              Something went wrong
            </h1>

            <p style={{
              fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)',
              margin: '0 0 24px', lineHeight: 1.5,
            }}>
              Orion IDE encountered an unexpected error. You can try again or reload the page.
            </p>

            {this.state.error && (
              <pre style={{
                padding: 16, background: 'var(--bg-canvas)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)',
                color: 'var(--accent-red-emphasis)', fontFamily: 'var(--font-mono)',
                textAlign: 'left', overflow: 'auto', maxHeight: 120, marginBottom: 24,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {this.state.error.toString()}
              </pre>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px', fontSize: 'var(--font-size-base)', fontWeight: 600,
                  color: 'var(--text-primary)', background: 'var(--bg-emphasis)',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'var(--font-ui)', transition: 'background var(--transition-normal)',
                }}
              >
                <RotateCcw size={16} />
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px', fontSize: 'var(--font-size-base)', fontWeight: 600,
                  color: '#fff', background: 'var(--accent-blue)',
                  border: '1px solid var(--accent-blue)', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'var(--font-ui)', transition: 'background var(--transition-normal)',
                }}
              >
                <RefreshCw size={16} />
                Reload IDE
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
