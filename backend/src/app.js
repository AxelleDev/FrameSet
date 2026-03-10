const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const projectsRoutes = require('./routes/projects.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
	next();
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user', userRoutes);
app.use('/api/projects', projectsRoutes);

app.use((req, res, next) => {
	res.status(404).json({
		error: 'Non trouvé',
		message: "La ressource demandée n'existe pas."
	});
});

app.use((err, req, res, next) => {
	console.error('Erreur serveur:', err);
	res.status(500).json({
		error: 'Erreur interne du serveur',
		message: "Une erreur inattendue est survenue."
	});
});

module.exports = app;
