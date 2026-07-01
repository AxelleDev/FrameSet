/**
 * Express application setup.
 *
 * Wires together the global middleware stack and mounts the API routers. The
 * ordering is security-significant: Helmet (incl. a strict Content-Security
 * Policy) and CORS run first, the JSON body is size-limited to blunt payload
 * abuse, every request is assigned a correlation id and access-logged, and the
 * CSRF cookie/verification middleware guards all /api routes before the feature
 * routers. A 404 handler and a centralized error handler terminate the chain.
 * Exports the configured app (the HTTP server is started in server.js).
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { randomUUID } = require('crypto');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const projectsRoutes = require('./routes/projects.routes');
const db = require('./database');
const { ensureCsrfCookie, csrfProtection } = require('./middleware/csrfProtection');
const { logger } = require('./utils/logger');

const app = express();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const isDevelopment = process.env.NODE_ENV !== 'production';

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

// Liveness/readiness probe: reports process uptime and verifies DB reachability,
// returning 503 when the database cannot be pinged.
app.get('/health', async (req, res) => {
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
