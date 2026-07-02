/**
 * Express application setup.
 *
 * Wires together the global middleware stack and mounts the API routers. The
 * ordering is security-significant: Helmet (incl. a strict Content-Security
 * Policy + HSTS) and CORS run first, the JSON body is size-limited to blunt
 * payload abuse, every request is assigned a correlation id and access-logged,
 * non-JSON content types are rejected, and the CSRF cookie/verification
 * middleware guards all /api routes before the feature routers. A 404 handler
 * and a centralized error handler terminate the chain. Swagger UI (/api-docs)
 * is served before the strict CSP so its bundled assets load.
 * Exports the configured app (the HTTP server is started in server.js).
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const { randomUUID } = require('crypto');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const projectsRoutes = require('./routes/projects.routes');
const db = require('./database');
const openapiSpec = require('./docs/openapi');
const { ensureCsrfCookie, csrfProtection } = require('./middleware/csrfProtection');
const { healthCheckLimiter } = require('./middleware/projectCreateLimiter');
const { logger } = require('./utils/logger');

const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const isDevelopment = process.env.NODE_ENV !== 'production';
// API docs are served unless explicitly disabled (ENABLE_API_DOCS=false), so a
// deployment can hide its API surface with a single env var and no code change.
const apiDocsEnabled = process.env.ENABLE_API_DOCS !== 'false';

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
		swaggerUi.setup(openapiSpec, { customSiteTitle: 'FrameSet API — Docs' })
	);
	logger.info('api_docs.enabled', { path: '/api-docs' });
}

// Helmet sets hardening response headers. The CSP locks content to same-origin
// by default, forbids plugins/object embedding and framing (clickjacking), and
// only upgrades to HTTPS outside development.
app.use(helmet({
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
			upgradeInsecureRequests: isDevelopment ? null : []
		}
	},
	// Force HTTPS for a year (with preload) in production; disabled in development
	// so localhost isn't pinned to https during local work.
	strictTransportSecurity: isDevelopment ? false : {
		maxAge: 31536000,
		includeSubDomains: true,
		preload: true
	}
}));
// Restrict cross-origin requests to the known frontend origin and allow
// credentials so the browser sends/stores the httpOnly auth cookies.
app.use(cors({
	origin: FRONTEND_ORIGIN,
  credentials: true
}));
// Cap JSON body size to limit the impact of oversized/malicious payloads.
app.use(express.json({ limit: '10kb' }));

// Request correlation + access logging. Assigns (or honors) an x-request-id,
// echoes it back on the response, and logs each completed request with timing
// at a severity derived from the status (error >= 500, warn >= 400, else info).
app.use((req, res, next) => {
	const requestStartedAt = process.hrtime.bigint();
	const incomingRequestId = req.headers['x-request-id'];
	const requestId = Array.isArray(incomingRequestId)
		? incomingRequestId[0]
		: incomingRequestId || randomUUID();

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
			durationMs: Number(elapsedMs.toFixed(2))
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

	if ((req.method === 'DELETE' || req.method === 'PATCH') && !req.headers['content-length']) {
		return next();
	}

	const contentType = req.headers['content-type'] || '';

	if (!contentType.includes('application/json')) {
		logger.warn('content_type.rejected', {
			requestId: req.id,
			method: req.method,
			path: req.path,
			contentType: contentType || 'missing'
		});

		return res.status(415).json({
			error: 'Unsupported Media Type.',
			message: 'Content-Type must be application/json.'
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
			uptime
		});
	} catch (error) {
		logger.error('health.check.failed', {
			requestId: req.id,
			error
		});

		return res.status(503).json({
			status: 'error',
			db: 'unreachable',
			uptime
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

// 404 handler: reached when no route matched.
app.use((req, res, _next) => {
	logger.warn('http.route.not_found', {
		requestId: req.id,
		method: req.method,
		path: req.path
	});

	res.status(404).json({
		error: 'Not found.',
		message: "The requested resource does not exist."
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
			type: err.type
		});
		return res.status(status).json({
			error: err.message || 'Client error'
		});
	}

	logger.error('http.unhandled_error', {
		requestId: req.id,
		method: req.method,
		path: req.path,
		error: err
	});

	res.status(500).json({
		error: 'Internal server error.',
		message: "An unexpected error occurred."
	});
});

module.exports = app;
