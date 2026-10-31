import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { failed: boolean; }

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('A page failed to render:', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return <main className="page-error" role="alert">
        <h1>This page could not be opened</h1>
        <p>Reload EVO to try again. Your saved information is unchanged.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
      </main>;
    }
    return this.props.children;
  }
}
