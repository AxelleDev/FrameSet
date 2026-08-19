import logger from './logger';

let sentryClient = null;

export const initMonitoring = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        // Errors only: tracing and session replay stay off so monitoring adds
        // no runtime overhead and never records user content.
        tracesSampleRate: 0,
        sendDefaultPii: false,
      });
      sentryClient = Sentry;
    })
    .catch((error) => {
      // Monitoring must never take the app down with it (e.g. SDK blocked by
      // an ad blocker); log locally and move on.
      logger.warn('monitoring.init_failed', error);
    });
};

// Reports a caught error (e.g. from an ErrorBoundary) with optional context.
// Safe to call unconditionally: no-ops until monitoring is initialized.
export const captureException = (error, context) => {
  if (!sentryClient) {
    return;
  }

  try {
    sentryClient.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* never let the reporter itself throw into app code */
  }
};
