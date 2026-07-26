/**
 * Mail config. Two delivery paths are supported:
 *   1. Brevo HTTP API (BREVO_API_KEY) — sends over HTTPS (443), so it works on
 *      hosts that block outbound SMTP ports (Railway, many PaaS). Preferred in
 *      production. Needs a validated sender address (MAIL_FROM_ADDRESS).
 *   2. SMTP (MAIL_HOST/PORT/SECURE/USER/PASS) — for hosts where SMTP is open.
 * In production at least one of the two must be fully configured (validated at
 * import time, fail fast). In dev/test both may be absent: mail.service.js then
 * falls back to an Ethereal test account.
 */

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

const MAIL_HOST = process.env.MAIL_HOST || '';
const MAIL_PORT_RAW = process.env.MAIL_PORT;
const MAIL_SECURE_RAW = process.env.MAIL_SECURE;
const MAIL_USER = process.env.MAIL_USER || '';
const MAIL_PASS = process.env.MAIL_PASS || '';

// Brevo transactional-email HTTP API. When set, it is used instead of SMTP, so
// email still sends where outbound SMTP is blocked (e.g. Railway).
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const useBrevoApi = Boolean(BREVO_API_KEY);

// The visible "from" address. Over the HTTP API this MUST be a sender validated
// in the Brevo account (the smtp-brevo.com SMTP login is not a valid sender);
// falls back to MAIL_USER for the SMTP path.
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || MAIL_USER || '';

// True only when every SMTP setting is present.
const hasSmtpConfig = Boolean(
  MAIL_HOST && MAIL_PORT_RAW && MAIL_SECURE_RAW !== undefined && MAIL_USER && MAIL_PASS,
);

// A working mail path is non-negotiable in production: fail fast on boot when
// neither the Brevo API nor a full SMTP setup is configured.
if (isProduction && !useBrevoApi && !hasSmtpConfig) {
  throw new Error(
    'Email delivery is not configured: set BREVO_API_KEY (recommended, works where SMTP is blocked) ' +
      'or the full SMTP configuration (MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_USER, MAIL_PASS).',
  );
}

// The Brevo API path needs a validated sender address to send from.
if (isProduction && useBrevoApi && !MAIL_FROM_ADDRESS) {
  throw new Error(
    'MAIL_FROM_ADDRESS is required with BREVO_API_KEY: set it to an email validated as a sender in Brevo.',
  );
}

let MAIL_PORT = null;
let MAIL_SECURE = false;

// When an SMTP configuration is provided, validate the individual values so a
// typo surfaces immediately on boot rather than later when an email is sent.
if (hasSmtpConfig) {
  MAIL_PORT = Number.parseInt(MAIL_PORT_RAW, 10);
  if (!Number.isInteger(MAIL_PORT) || MAIL_PORT <= 0) {
    throw new Error('MAIL_PORT must be a positive integer in the environment variables');
  }

  const normalizedMailSecure = String(MAIL_SECURE_RAW).trim().toLowerCase();
  if (normalizedMailSecure !== 'true' && normalizedMailSecure !== 'false') {
    throw new Error('MAIL_SECURE must be set to true or false in the environment variables');
  }
  MAIL_SECURE = normalizedMailSecure === 'true';
}

module.exports = {
  hasSmtpConfig,
  useBrevoApi,
  BREVO_API_KEY,
  MAIL_FROM_ADDRESS,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_SECURE,
  MAIL_USER,
  MAIL_PASS,
};
