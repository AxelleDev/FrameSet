const isDev = import.meta.env.DEV;

// Forwards to the matching console method, but only in development.
const write = (method, ...args) => {
  if (!isDev) {
    return;
  }

  const target = console[method] || console.log;
  target(...args);
};

const logger = {
  debug: (...args) => write('debug', ...args),
  info: (...args) => write('info', ...args),
  warn: (...args) => write('warn', ...args),
  error: (...args) => write('error', ...args),
};

export default logger;
