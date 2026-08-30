import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * A Dexie failure must not leave a white page. React has no hook form of this;
 * an error boundary has to be a class component.
 */
export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The board failed to render.', error, info);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="boundary">
          <h1>The board could not open.</h1>
          <p>Your cards are still in the database. Nothing was deleted.</p>
          <p className="notice error">{this.state.error.message}</p>
          <p>Reload the tab. If it fails again, open DevTools and read the console.</p>
        </div>
      );
    }
    return this.props.children;
  }
}