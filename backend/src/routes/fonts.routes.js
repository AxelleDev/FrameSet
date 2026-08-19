const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const fontsController = require('../controllers/fonts.controller');

const router = express.Router();

router.get('/', authenticateToken, fontsController.getFonts);
router.get('/files', authenticateToken, fontsController.getFontFiles);

module.exports = router;
