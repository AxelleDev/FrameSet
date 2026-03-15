import React from 'react';

const FALLBACK_MESSAGE = 'Erreur inattendue, rechargez la page.';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

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
          className="rounded-2xl border border-pink/30 bg-white/90 px-6 py-8 text-center text-primary shadow-sm"
        >
          {FALLBACK_MESSAGE}
        </div>
      );
    }

    return this.props.children;
  }
}

export { FALLBACK_MESSAGE };