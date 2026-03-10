const express = require('express');
const userController = require('../controllers/user.controller');

const router = express.Router();

const authenticateToken = require('../middleware/authenticateToken');

router.get('/count', userController.getUserCount);
router.put('/', authenticateToken, userController.updateUser);
router.post('/password', authenticateToken, userController.changePassword);
router.post('/email/verify', authenticateToken, userController.verifyPendingEmail);
router.post('/email/resend', authenticateToken, userController.resendPendingEmail);

module.exports = router;
