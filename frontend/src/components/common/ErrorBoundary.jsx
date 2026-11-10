import { Component } from 'react';

/**
 * Last line of defence: an unexpected render error shows a recovery screen instead of a blank page.
 * Sits outside the router and providers (so it also catches their errors) and therefore uses plain links.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unexpected UI error', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="card max-w-md p-6 text-center" role="alert">
          <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600">
            The page hit an unexpected error. Reloading usually fixes it.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>Reload page</button>
            <a href="/" className="btn-secondary">Go home</a>
          </div>
        </div>
      </div>
    );
  }
}
