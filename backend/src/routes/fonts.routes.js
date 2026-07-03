/**
 * Proxy route for the Google Fonts catalog, to keep the API key server-side
 * (never in the client bundle). Restricted to authenticated users, since it is
 * only consumed by the typography norms editor.
 */

const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const fontsController = require('../controllers/fonts.controller');

const router = express.Router();

router.get('/', authenticateToken, fontsController.getFonts);

module.exports = router;
