/**
 * Route proxy du catalogue Google Fonts, afin de garder la clé API côté serveur
 * (jamais dans le bundle client). Réservée aux utilisateurs authentifiés,
 * puisqu'elle n'est consommée que par l'éditeur de normes typographiques.
 */

const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const fontsController = require('../controllers/fonts.controller');

const router = express.Router();

router.get('/', authenticateToken, fontsController.getFonts);

module.exports = router;
