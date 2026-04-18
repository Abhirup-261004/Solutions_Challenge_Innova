import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Something went wrong while rendering this page.'
    };
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary caught an error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel" style={{ maxWidth: '760px', margin: '4rem auto', padding: '2.4rem', textAlign: 'center' }}>
          <h2 className="text-gradient">Something Went Wrong</h2>
          <p className="text-muted" style={{ marginTop: '0.8rem' }}>
            {this.state.message}
          </p>
          <p className="text-muted" style={{ marginTop: '0.55rem', fontSize: '0.9rem' }}>
            The app recovered safely instead of showing a blank screen. Reload to continue.
          </p>
          <button type="button" className="btn-primary" onClick={this.handleReload} style={{ marginTop: '1.4rem' }}>
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
