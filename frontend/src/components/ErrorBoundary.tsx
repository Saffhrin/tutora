import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { message: string };

/**
 * Keeps one broken page — or a payload that is not Tutora's — from blanking the app.
 * A blank screen is the worst outcome when another project owns the API port, because
 * it hides the real cause.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { message: '' };

  static getDerivedStateFromError(error: unknown): State {
    // `throw ''` and `new Error('')` are legal: the message must still be non-empty,
    // otherwise the boundary would render the broken child again and loop.
    const message = String(error instanceof Error ? error.message : error).trim();
    return { message: message || 'the page raised an error without a message' };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Tutora: page failed to render', error, info.componentStack);
  }

  render() {
    if (this.state.message) {
      return (
        <div className="page">
          <div className="banner warn">
            This page could not be rendered: {this.state.message}. If another project is using the
            API port, start Tutora with <code>./scripts/dev.sh</code> — it picks free ports for the
            API and the UI and tells the UI which port the API is on.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
