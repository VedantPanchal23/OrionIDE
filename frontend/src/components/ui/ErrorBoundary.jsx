import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Orion UI crash', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p className="muted">{this.state.error.message || 'Unexpected UI error'}</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
