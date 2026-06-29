/**
 * Mail service.
 *
 * Wraps a single nodemailer SMTP transport and provides a reusable branded HTML
 * template. Used to deliver email verification and confirmation codes during
 * registration, email-change and code-resend flows.
 */

const nodemailer = require('nodemailer');
const {
  hasSmtpConfig,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_SECURE,
  MAIL_USER,
  MAIL_PASS
} = require('../config/mail.config');
const { logger } = require('../utils/logger');

// When SMTP is configured, build the transport eagerly from the env settings.
// Otherwise (development with no email setup) it is created lazily from an
// auto-generated Ethereal test account on the first send — see getTransporter().
let transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: MAIL_HOST,
      port: MAIL_PORT,
      secure: MAIL_SECURE,
      auth: { user: MAIL_USER, pass: MAIL_PASS }
    })
  : null;

// "From" address: the configured user, or the Ethereal test user once created.
let mailFrom = hasSmtpConfig ? MAIL_USER : null;

let transporterPromise = null;

/**
 * Returns the SMTP transport. When no SMTP is configured (dev convenience), an
 * Ethereal test account is created on the first call so the app can send without
 * any email setup; each send then logs a preview URL to read the message.
 * @returns {Promise<object>} A nodemailer transport.
 */
const getTransporter = async () => {
  if (transporter) {
    return transporter;
  }
  if (!transporterPromise) {
    transporterPromise = nodemailer.createTestAccount().then((account) => {
      logger.info('mail.dev_account.created', {
        message: 'Aucun SMTP configuré : compte Ethereal de test créé pour le développement.',
        user: account.user
      });
      mailFrom = account.user;
      transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass }
      });
      return transporter;
    });
  }
  return transporterPromise;
};

/**
 * Builds the branded HTML body for a transactional email. The code block is
 * rendered only when a code is supplied.
 * @param {Object} params
 * @param {string} params.title Heading shown in the email header.
 * @param {string} params.message Body message.
 * @param {string} [params.code] Optional verification code to highlight.
 * @param {string} [params.footer] Optional footer note (defaults to expiry text).
 * @returns {string} HTML markup.
 */
const buildTemplate = ({ title, message, code, footer }) => {
  return `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f6f7fb; padding:24px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #AFAFAF;overflow:hidden;">
      <div style="padding:24px 28px;background:linear-gradient(135deg,#8994DF,#FF9292);color:#ffffff;">
        <h1 style="margin:0;font-size:20px;font-weight:600;">${title}</h1>
        <p style="margin:6px 0 0;font-size:13px;opacity:.85;">FrameSet</p>
      </div>
      <div style="padding:28px; color:#3C3D48;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${message}</p>
        ${code ? `
        <div style="display:inline-block;background:#eef0ff;border:1px solid #8994DF;color:#3C3D48;padding:10px 16px;border-radius:12px;font-size:20px;font-weight:700;letter-spacing:2px;">
          ${code}
        </div>` : ''}
        <p style="margin:16px 0 0;font-size:12px;color:#AFAFAF;">${footer || 'Ce code expire dans 10 minutes.'}</p>
      </div>
      <div style="padding:18px 28px;border-top:1px solid #AFAFAF;font-size:12px;color:#AFAFAF;">
        Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email.
      </div>
    </div>
  </div>
  `;
};

/**
 * Sends an email through the configured SMTP transport.
 * @param {Object} params
 * @param {string} params.to Recipient address.
 * @param {string} params.subject Subject line.
 * @param {string} params.text Plain-text fallback body.
 * @param {string} params.html HTML body.
 * @returns {Promise<void>}
 */
const sendMail = async ({ to, subject, text, html }) => {
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: mailFrom,
    to,
    subject,
    text,
    html
  });

  // In non-production, surface the Ethereal preview URL so the email (and the
  // code it contains) can be read straight from the server console — no need to
  // open a real inbox during local development.
  if (process.env.NODE_ENV !== 'production' && typeof nodemailer.getTestMessageUrl === 'function') {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      logger.info('mail.preview', { to, subject, previewUrl });
    }
  }
};

module.exports = {
  sendMail,
  buildTemplate
};
