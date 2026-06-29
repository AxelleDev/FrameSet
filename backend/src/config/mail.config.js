/**
 * Mail (SMTP) configuration module.
 *
 * In PRODUCTION a complete SMTP configuration is mandatory and validated at
 * import time (fail fast). In DEVELOPMENT/TEST it is optional: when it is absent,
 * the mail service transparently falls back to an auto-created Ethereal test
 * account (see mail.service.js), so the app runs with zero email setup — handy
 * for first-time contributors who just clone and `npm run dev`.
 */

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

const MAIL_HOST = process.env.MAIL_HOST || '';
const MAIL_PORT_RAW = process.env.MAIL_PORT;
const MAIL_SECURE_RAW = process.env.MAIL_SECURE;
const MAIL_USER = process.env.MAIL_USER || '';
const MAIL_PASS = process.env.MAIL_PASS || '';

// True only when every SMTP setting is present.
const hasSmtpConfig = Boolean(
  MAIL_HOST && MAIL_PORT_RAW && MAIL_SECURE_RAW !== undefined && MAIL_USER && MAIL_PASS
);

// A real SMTP is non-negotiable in production: fail fast on boot.
if (isProduction && !hasSmtpConfig) {
  throw new Error(
    'La configuration SMTP (MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_USER, MAIL_PASS) est obligatoire en production.'
  );
}

let MAIL_PORT = null;
let MAIL_SECURE = false;

// When a configuration is provided, validate the individual values so a typo
// surfaces immediately on boot rather than later when an email is sent.
if (hasSmtpConfig) {
  MAIL_PORT = Number.parseInt(MAIL_PORT_RAW, 10);
  if (!Number.isInteger(MAIL_PORT) || MAIL_PORT <= 0) {
    throw new Error('MAIL_PORT doit etre un entier positif dans les variables d\'environnement');
  }

  const normalizedMailSecure = String(MAIL_SECURE_RAW).trim().toLowerCase();
  if (normalizedMailSecure !== 'true' && normalizedMailSecure !== 'false') {
    throw new Error('MAIL_SECURE doit etre defini a true ou false dans les variables d\'environnement');
  }
  MAIL_SECURE = normalizedMailSecure === 'true';
}

module.exports = {
  hasSmtpConfig,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_SECURE,
  MAIL_USER,
  MAIL_PASS
};
