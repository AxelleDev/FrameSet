/**
 * Mail service: wraps a nodemailer SMTP transport and a reusable branded HTML template.
 * Delivers verification/confirmation codes for registration, email-change and resend flows.
 */

const path = require('path');
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

// The brand logo is embedded inline via a CID attachment (see sendMail), which
// renders reliably across email clients without needing a public image host.
const LOGO_CID = 'frameset-logo';
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'frameset-logo.png');

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

// Display name shown in recipients' inboxes, for a consistent sender identity.
const MAIL_FROM_NAME = 'FrameSet';

/** Formats the "from" header with the brand display name (e.g. "FrameSet <addr>"). */
const formatFromAddress = (address) => (address ? `${MAIL_FROM_NAME} <${address}>` : address);

let transporterPromise = null;

// Returns the SMTP transport. With no SMTP configured (dev), an Ethereal test
// account is created on the first call so the app can send without email setup.
const getTransporter = async () => {
  if (transporter) {
    return transporter;
  }
  if (!transporterPromise) {
    transporterPromise = nodemailer.createTestAccount().then((account) => {
      logger.info('mail.dev_account.created', {
        message: 'No SMTP configured: an Ethereal test account was created for development.',
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

// Builds the branded HTML email body. The code block renders only when `code` is
// supplied; `footer` defaults to the expiry note.
const buildTemplate = ({ title, message, code, footer }) => {
  const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  return `
  <!-- FrameSet transactional email -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F3FF;margin:0;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E7E9F6;border-radius:20px;overflow:hidden;">
          <!-- Header / logo -->
          <tr>
            <td style="padding:28px 32px 4px;font-family:${fontStack};">
              <img src="cid:${LOGO_CID}" alt="FrameSet" width="100" height="51" style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:20px 32px 8px;font-family:${fontStack};">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;line-height:1.3;color:#3C3D48;">${title}</h1>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#6B6B6B;">${message}</p>
            </td>
          </tr>
          ${code ? `
          <tr>
            <td style="padding:20px 32px 4px;font-family:${fontStack};">
              <div style="background:#F2F3FF;border:1px solid #D9DEFA;border-radius:14px;padding:20px;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#3C3D48;">
                ${code}
              </div>
            </td>
          </tr>` : ''}
          <tr>
            <td style="padding:16px 32px 28px;font-family:${fontStack};">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#9AA0AC;">${footer || 'This code expires in 10 minutes.'}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px;border-top:1px solid #EFF0F8;font-family:${fontStack};">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9AA0AC;">
                You received this email from FrameSet. If you didn't request it, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;
};

// Sends an email through the configured SMTP transport.
const sendMail = async ({ to, subject, text, html }) => {
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: formatFromAddress(mailFrom),
    to,
    subject,
    text,
    html,
    // Embed the brand logo inline (referenced as cid:frameset-logo in the HTML).
    attachments: [{ filename: 'frameset-logo.png', path: LOGO_PATH, cid: LOGO_CID }]
  });

  // In non-production, log the Ethereal preview URL so the email can be read
  // from the server console without a real inbox.
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
