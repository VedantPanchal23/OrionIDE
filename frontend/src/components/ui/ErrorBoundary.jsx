/**
 * Orion IDE — top-level error boundary
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './primitives';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Orion IDE crashed:', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="boot-screen" style={{ gap: 18 }}>
          <AlertTriangle size={40} color="var(--danger)" />
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8, color: 'var(--text)' }}>
              Something broke
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <Button variant="primary" onClick={this.handleReload}>Reload Orion</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
