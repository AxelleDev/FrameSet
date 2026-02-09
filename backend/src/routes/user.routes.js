const express = require('express');
const userController = require('../controllers/user.controller');

const router = express.Router();

router.get('/count', userController.getUserCount);
router.put('/', userController.updateUser);
router.post('/password', userController.changePassword);
router.post('/email/verify', userController.verifyPendingEmail);
router.post('/email/resend', userController.resendPendingEmail);

module.exports = router;
