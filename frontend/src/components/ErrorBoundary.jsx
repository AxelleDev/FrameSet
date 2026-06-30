import React from 'react';

// User-facing fallback text shown when a render error is caught.
const FALLBACK_MESSAGE = 'Erreur inattendue, rechargez la page.';

/**
 * React error boundary. Catches render-time errors in its subtree and shows a
 * fallback alert instead of crashing the app. An optional `onError` prop is
 * invoked for logging/reporting.
 *
 * @param {object} props
 * @param {Function} [props.onError] - Callback receiving (error, errorInfo) when an error is caught.
 * @param {React.ReactNode} props.children - Subtree to protect.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  // Flip into the error state so the next render shows the fallback.
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  // Side-effect hook for forwarding the error to an optional reporter.
  componentDidCatch(error, errorInfo) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    // Render the accessible fallback UI when an error has been caught.
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-2xl bg-white px-6 py-8 text-center text-primary "
        >
          {FALLBACK_MESSAGE}
        </div>
      );
    }

    return this.props.children;
  }
}

export { FALLBACK_MESSAGE };