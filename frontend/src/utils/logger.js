/**
 * Lightweight console logger that is silenced outside development.
 *
 * Wraps console.debug/info/warn/error so logging calls can be left in the code
 * without leaking to the browser console in production builds.
 */
const isDev = import.meta.env.DEV;

/**
 * Forwards to the matching console method, but only in development.
 * @param {('debug'|'info'|'warn'|'error')} method Console method name.
 * @param {...*} args Arguments passed through to console.
 */
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
  error: (...args) => write('error', ...args)
};

export default logger;