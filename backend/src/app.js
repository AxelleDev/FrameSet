const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { randomUUID } = require('crypto');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const projectsRoutes = require('./routes/projects.routes');
const { logger } = require('./utils/logger');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

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

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectsRoutes);

app.use((req, res, next) => {
	logger.warn('http.route.not_found', {
		requestId: req.id,
		method: req.method,
		path: req.path
	});

	res.status(404).json({
		error: 'Non trouvé',
		message: "La ressource demandée n'existe pas."
	});
});

app.use((err, req, res, next) => {
	logger.error('http.unhandled_error', {
		requestId: req.id,
		method: req.method,
		path: req.path,
		error: err
	});

	res.status(500).json({
		error: 'Erreur interne du serveur',
		message: "Une erreur inattendue est survenue."
	});
});

module.exports = app;
