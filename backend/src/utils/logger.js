/**
 * Structured JSON logger.
 *
 * Provides a small, dependency-free logging facility that emits one JSON object
 * per line (suitable for ingestion by log aggregators). It supports level
 * filtering via the LOG_LEVEL env var, safe serialization of Error objects and
 * other non-JSON-friendly values, and child loggers that carry contextual
 * metadata (e.g. a component name) into every log entry.
 */

// Numeric severities used to compare and filter levels. Higher means more severe.
const LEVEL_PRIORITY = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
});

const DEFAULT_LOG_LEVEL = 'info';

/**
 * Coerces an arbitrary configured value into a known log level, defaulting to
 * "info" when the value is unset or unrecognized.
 * @param {*} value Raw level (typically from the environment).
 * @returns {string} A valid level key.
 */
const normalizeLogLevel = (value) => {
  const level = String(value || '').toLowerCase();
  return LEVEL_PRIORITY[level] ? level : DEFAULT_LOG_LEVEL;
};

const activeLogLevel = normalizeLogLevel(process.env.LOG_LEVEL);

/**
 * Determines whether a message at the given level should be emitted under the
 * currently active log level.
 * @param {string} level Level of the candidate message.
 * @returns {boolean}
 */
const shouldLog = (level) => LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[activeLogLevel];

/**
 * Converts an Error into a plain, serializable object. The stack trace is only
 * included outside production to avoid leaking internal paths/details into
 * production logs.
 * @param {*} error Value that may or may not be an Error.
 * @returns {*} A serializable representation, or the original value untouched.
 */
const serializeError = (error) => {
  if (!(error instanceof Error)) {
    return error;
  }

  const serialized = {
    name: error.name,
    message: error.message
  };

  if (error.code) {
    serialized.code = error.code;
  }

  if (process.env.NODE_ENV !== 'production' && error.stack) {
    serialized.stack = error.stack;
  }

  return serialized;
};

/**
 * Normalizes a metadata object so it can be safely JSON-stringified: drops
 * undefined values and functions, serializes Errors, and converts BigInt to a
 * string (JSON.stringify throws on BigInt).
 * @param {Object} meta Arbitrary contextual metadata.
 * @returns {Object} A sanitized, JSON-safe copy.
 */
const sanitizeMeta = (meta) => {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return {};
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || typeof value === 'function') {
      continue;
    }

    if (value instanceof Error) {
      sanitized[key] = serializeError(value);
      continue;
    }

    if (typeof value === 'bigint') {
      sanitized[key] = value.toString();
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
};

/**
 * Core sink. Builds the structured payload and writes a single JSON line to the
 * appropriate console stream (stderr for errors/warnings, stdout otherwise),
 * respecting the active log level.
 * @param {string} level Severity level.
 * @param {string} message Stable, machine-friendly event name.
 * @param {Object} [meta] Contextual metadata.
 */
const write = (level, message, meta = {}) => {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizeMeta(meta)
  };

  const output = JSON.stringify(payload);

  if (level === 'error') {
    console.error(output);
    return;
  }

  if (level === 'warn') {
    console.warn(output);
    return;
  }

  console.log(output);
};

/**
 * Builds a logger bound to a fixed context. Every log call merges the bound
 * context with per-call metadata, and child() derives a new logger that extends
 * the context (e.g. tagging all migration logs with a component name).
 * @param {Object} [context] Metadata merged into every entry from this logger.
 * @returns {{debug:Function, info:Function, warn:Function, error:Function, child:Function}}
 */
const createLogger = (context = {}) => ({
  debug: (message, meta = {}) => write('debug', message, { ...context, ...meta }),
  info: (message, meta = {}) => write('info', message, { ...context, ...meta }),
  warn: (message, meta = {}) => write('warn', message, { ...context, ...meta }),
  error: (message, meta = {}) => write('error', message, { ...context, ...meta }),
  child: (nextContext = {}) => createLogger({ ...context, ...nextContext })
});

const logger = createLogger();

module.exports = {
  logger,
  createLogger,
  activeLogLevel
};