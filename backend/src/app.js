/**
 * Express app setup: middleware stack + API routers. Ordering is
 * security-significant (see per-middleware notes). HTTP server starts in server.js.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const { randomUUID } = require('crypto');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const projectsRoutes = require('./routes/projects.routes');
const fontsRoutes = require('./routes/fonts.routes');
const shareRoutes = require('./routes/share.routes');
const db = require('./database');
const openapiSpec = require('./docs/openapi');
const { ensureCsrfCookie, csrfProtection } = require('./middleware/csrfProtection');
const { healthCheckLimiter } = require('./middleware/projectCreateLimiter');
const { logger } = require('./utils/logger');
const { captureException } = require('./utils/monitoring');
const { isE2ETestMode } = require('./utils/testMode');

const app = express();
// Trust the proxy hops in front of the app so req.ip is the real client IP
// from X-Forwarded-For and per-IP rate limiting stays per-client instead of
// collapsing to a proxy's single IP. Defaults to 1 hop (Render/Railway/nginx);
// set TRUST_PROXY_HOPS when the chain is deeper — e.g. 2 when the frontend
// host proxies /api to the platform edge in front of this app.
const parsedTrustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS, 10);
app.set(
  'trust proxy',
  Number.isInteger(parsedTrustProxyHops) && parsedTrustProxyHops > 0 ? parsedTrustProxyHops : 1,
);
const isDevelopment = process.env.NODE_ENV !== 'production';
// Fail fast in production if the frontend origin isn't set, rather than silently
// falling back to localhost (which would leave CORS/cookies broken but undetected).
if (!isDevelopment && !process.env.FRONTEND_ORIGIN) {
  throw new Error('FRONTEND_ORIGIN must be defined in production');
}
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
// API docs: served by default in development, but opt-in in production
// (ENABLE_API_DOCS=true) so a deployment never exposes its API surface by accident.
const apiDocsEnabled = isDevelopment
  ? process.env.ENABLE_API_DOCS !== 'false'
  : process.env.ENABLE_API_DOCS === 'true';
// Accepted shape for a client-supplied x-request-id: bounded and restricted to safe
// characters, so an arbitrary/oversized value can't pollute logs or the echoed header.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Interactive API documentation (Swagger UI) + the raw OpenAPI spec. Mounted
// before the global strict CSP with its own relaxed policy so the bundled UI's
// inline script/styles run; every other route keeps the hardened CSP below. The
// path is /api-docs (not under /api), so it never reaches the CSRF middleware.
if (apiDocsEnabled) {
  app.get('/api-docs.json', (req, res) => res.json(openapiSpec));
  app.use(
    '/api-docs',
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, { customSiteTitle: 'FrameSet API — Docs' }),
  );
  logger.info('api_docs.enabled', { path: '/api-docs' });
}

// Helmet sets hardening response headers. The CSP locks content to same-origin
// by default, forbids plugins/object embedding and framing (clickjacking), and
// only upgrades to HTTPS outside development.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // 'unsafe-inline' is required for React's dynamic inline styles (e.g. color
        // swatches). Google Fonts is allowed so the typography preview can load
        // arbitrary user-picked font families (impossible to self-host up front).
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", FRONTEND_ORIGIN, 'https://www.googleapis.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isDevelopment ? null : [],
      },
    },
    // Force HTTPS for a year (with preload) in production; disabled in development
    // so localhost isn't pinned to https during local work.
    strictTransportSecurity: isDevelopment
      ? false
      : {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
  }),
);
// Restrict cross-origin requests to the known frontend origin and allow
// credentials so the browser sends/stores the httpOnly auth cookies.
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    // Retry-After isn't on the CORS-safelisted response header list, so without
    // this the browser silently hides it from JS on cross-origin responses (the
    // frontend runs on a different port in dev) even though it's on the wire —
    // the frontend needs it to show a real countdown instead of a static message.
    exposedHeaders: ['Retry-After'],
  }),
);
// Cap JSON body size to limit the impact of oversized/malicious payloads.
app.use(express.json({ limit: '10kb' }));

// Request correlation + access logging: assign/honor an x-request-id, echo it
// back, and log each completed request with timing at a status-derived severity.
app.use((req, res, next) => {
  const requestStartedAt = process.hrtime.bigint();
  const incomingRequestId = req.headers['x-request-id'];
  const candidateRequestId = Array.isArray(incomingRequestId)
    ? incomingRequestId[0]
    : incomingRequestId;
  // Honor a client-supplied id only when it matches the safe pattern; otherwise mint one.
  const requestId =
    typeof candidateRequestId === 'string' && REQUEST_ID_PATTERN.test(candidateRequestId)
      ? candidateRequestId
      : randomUUID();

  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - requestStartedAt) / 1e6;
    const userId = Number(req?.user?.id);
    const logMeta = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Number(elapsedMs.toFixed(2)),
    };

    if (Number.isInteger(userId) && userId > 0) {
      logMeta.userId = userId;
    }

    if (res.statusCode >= 500) {
      logger.error('http.request.completed', logMeta);
      return;
    }

    if (res.statusCode >= 400) {
      logger.warn('http.request.completed', logMeta);
      return;
    }

    logger.info('http.request.completed', logMeta);
  });

  next();
});

// Reject requests with an unexpected Content-Type to reduce the attack surface
// from body-parser misinterpretation (e.g. JSON smuggled as text/plain or
// application/x-www-form-urlencoded). GET/HEAD/OPTIONS are exempt; DELETE and
// PATCH without a body are also allowed since they legitimately carry no payload
// and browsers do not set a Content-Type in that case.
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // A body-less request carries no payload to misinterpret, so exempt it regardless
  // of method (e.g. POST /auth/refresh and /auth/logout act on cookies, not a body).
  // "Body-less" = no/zero content-length and no chunked transfer-encoding.
  const contentLength = req.headers['content-length'];
  const hasBody = (contentLength && contentLength !== '0') || req.headers['transfer-encoding'];
  if (!hasBody) {
    return next();
  }

  const contentType = req.headers['content-type'] || '';

  if (!contentType.includes('application/json')) {
    logger.warn('content_type.rejected', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      contentType: contentType || 'missing',
    });

    return res.status(415).json({
      error: 'Unsupported Media Type.',
      message: 'Content-Type must be application/json.',
    });
  }

  next();
});

// Liveness/readiness probe: reports process uptime and verifies DB reachability,
// returning 503 when the database cannot be pinged. Rate limited since it is
// public and each call pings the database.
app.get('/health', healthCheckLimiter, async (req, res) => {
  const uptime = Number(process.uptime().toFixed(2));

  try {
    await db.ping();
    return res.status(200).json({
      status: 'ok',
      db: 'reachable',
      uptime,
    });
  } catch (error) {
    logger.error('health.check.failed', {
      requestId: req.id,
      error,
    });

    return res.status(503).json({
      status: 'error',
      db: 'unreachable',
      uptime,
    });
  }
});

// CSRF guard for the whole API: first guarantee the CSRF cookie exists, then
// enforce the double-submit check on state-changing requests before any router.
app.use('/api', ensureCsrfCookie);
app.use('/api', csrfProtection);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/fonts', fontsRoutes);
// Public read-only share links (GET only, so the CSRF guard's safe-method
// exemption applies; rate limited inside the router).
app.use('/api/share', shareRoutes);

// E2E test mode only: lets a Playwright run read a verification code without
// a real inbox. Never mounted otherwise — see utils/testMode.js.
if (isE2ETestMode) {
  app.use('/api/_test', require('./routes/testE2E.routes'));
}

// 404 handler.
app.use((req, res, _next) => {
  logger.warn('http.route.not_found', {
    requestId: req.id,
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    error: 'Not found.',
    message: 'The requested resource does not exist.',
  });
});

// Centralized error handler. Client errors (4xx) are logged at warn level and
// their message is surfaced; everything else is treated as a 5xx and returns a
// generic message so internal error details are never leaked to the client.
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode;

  if (status && status >= 400 && status < 500) {
    logger.warn('http.client_error', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status,
      type: err.type,
    });
    return res.status(status).json({
      error: err.message || 'Client error',
    });
  }

  logger.error('http.unhandled_error', {
    requestId: req.id,
    method: req.method,
    path: req.path,
    error: err,
  });

  // Forward server errors to the (optional) error monitoring backend with just
  // enough context to correlate with the logs — no body, no user input.
  captureException(err, {
    requestId: req.id,
    method: req.method,
    path: req.path,
  });

  res.status(500).json({
    error: 'Internal server error.',
    message: 'An unexpected error occurred.',
  });
});

module.exports = app;
