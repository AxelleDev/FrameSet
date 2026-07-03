import React from 'react';
import PropTypes from 'prop-types';

// User-facing fallback text shown when a render error is caught.
const FALLBACK_MESSAGE = 'Something went wrong. Please reload the page.';

// Error boundary: catches render-time errors in its subtree and shows a fallback alert
// instead of crashing. Optional `onError(error, errorInfo)` is invoked for logging/reporting.
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
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-2xl bg-surface px-6 py-8 text-center text-primary "
        >
          {FALLBACK_MESSAGE}
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
  onError: PropTypes.func,
};

export { FALLBACK_MESSAGE };