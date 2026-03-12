const LEVEL_PRIORITY = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
});

const DEFAULT_LOG_LEVEL = 'info';

const normalizeLogLevel = (value) => {
  const level = String(value || '').toLowerCase();
  return LEVEL_PRIORITY[level] ? level : DEFAULT_LOG_LEVEL;
};

const activeLogLevel = normalizeLogLevel(process.env.LOG_LEVEL);

const shouldLog = (level) => LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[activeLogLevel];

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