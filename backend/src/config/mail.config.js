/**
 * Mail (SMTP) configuration module.
 *
 * Reads and validates the SMTP transport settings used to send verification
 * and confirmation emails. Every value is validated at import time so the
 * process fails fast on boot if any mail credential is missing or malformed,
 * rather than failing later when an email needs to be sent.
 */

const MAIL_HOST = process.env.MAIL_HOST;
if (!MAIL_HOST) {
  throw new Error('MAIL_HOST doit etre defini dans les variables d\'environnement');
}

const MAIL_PORT_RAW = process.env.MAIL_PORT;
const MAIL_PORT = Number.parseInt(MAIL_PORT_RAW, 10);
if (!MAIL_PORT_RAW || !Number.isInteger(MAIL_PORT) || MAIL_PORT <= 0) {
  throw new Error('MAIL_PORT doit etre un entier positif dans les variables d\'environnement');
}

const MAIL_SECURE_RAW = process.env.MAIL_SECURE;
if (MAIL_SECURE_RAW === undefined) {
  throw new Error('MAIL_SECURE doit etre defini dans les variables d\'environnement');
}

const normalizedMailSecure = String(MAIL_SECURE_RAW).trim().toLowerCase();
if (normalizedMailSecure !== 'true' && normalizedMailSecure !== 'false') {
  throw new Error('MAIL_SECURE doit etre defini a true ou false dans les variables d\'environnement');
}

const MAIL_SECURE = normalizedMailSecure === 'true';

const MAIL_USER = process.env.MAIL_USER;
if (!MAIL_USER) {
  throw new Error('MAIL_USER doit etre defini dans les variables d\'environnement');
}

const MAIL_PASS = process.env.MAIL_PASS;
if (!MAIL_PASS) {
  throw new Error('MAIL_PASS doit etre defini dans les variables d\'environnement');
}

module.exports = {
  MAIL_HOST,
  MAIL_PORT,
  MAIL_SECURE,
  MAIL_USER,
  MAIL_PASS
};
