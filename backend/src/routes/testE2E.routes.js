/**
 * E2E test mode only: exposes the last captured email for a recipient, so a
 * Playwright run can read a verification code without a real inbox. Mounted
 * in app.js only when isE2ETestMode is true — never reachable otherwise, and
 * isE2ETestMode itself is inert whenever NODE_ENV === 'production'.
 */
const express = require('express');
const mailService = require('../services/mail.service');

const router = express.Router();

router.get('/last-email', (req, res) => {
  const to = typeof req.query.to === 'string' ? req.query.to : '';
  const email = to ? mailService.getLastEmail(to) : null;

  if (!email) {
    return res.status(404).json({ error: 'No email captured for this recipient yet.' });
  }

  res.json(email);
});

module.exports = router;
