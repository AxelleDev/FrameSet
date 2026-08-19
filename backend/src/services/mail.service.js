const path = require('path');
const nodemailer = require('nodemailer');
const {
  hasSmtpConfig,
  useBrevoApi,
  BREVO_API_KEY,
  MAIL_FROM_ADDRESS,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_SECURE,
  MAIL_USER,
  MAIL_PASS,
} = require('../config/mail.config');
const { logger } = require('../utils/logger');
const { isE2ETestMode } = require('../utils/testMode');

// E2E test mode only: the last email sent to each recipient, kept in memory so
// a Playwright run can read a verification code without a real inbox (see the
// /_test/last-email route, only mounted under the same flag). Never touched
// outside test mode.
const capturedEmailsByRecipient = new Map();
const getLastEmail = (to) => capturedEmailsByRecipient.get(to) || null;

// The brand logo is embedded inline via a CID attachment on the SMTP path (see
// sendViaSmtp), which renders reliably across clients. On the HTTP API path
// (which has no CID inlining) the same cid reference is swapped for a public
// URL served by the frontend.
const LOGO_CID = 'frameset-logo';
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'frameset-logo.png');
// Public logo URL for the HTTP API path: the frontend serves the logo at its
// root, so reuse the configured frontend origin. Empty when unset (the image
// simply doesn't render; the code and text still do).
const LOGO_URL = process.env.FRONTEND_ORIGIN
  ? `${process.env.FRONTEND_ORIGIN.replace(/\/$/, '')}/FrameSet_Logo.png`
  : '';

// Fail an unreachable SMTP server in a few seconds instead of hanging on
// nodemailer's ~2-minute default (which would stall the whole request).
const SMTP_TIMEOUTS = {
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
};

// Bound the Brevo HTTP API call the same way, so a slow/hung API can't stall a request.
const BREVO_API_TIMEOUT_MS = 15000;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// When SMTP is configured, build the transport eagerly from the env settings.
// Otherwise (development with no email setup) it is created lazily from an
// auto-generated Ethereal test account on the first send — see getTransporter().
let transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: MAIL_HOST,
      port: MAIL_PORT,
      secure: MAIL_SECURE,
      auth: { user: MAIL_USER, pass: MAIL_PASS },
      ...SMTP_TIMEOUTS,
    })
  : null;

// "From" address: the configured sender, or the Ethereal test user once created.
let mailFrom = MAIL_FROM_ADDRESS || (hasSmtpConfig ? MAIL_USER : null);

// Display name shown in recipients' inboxes, for a consistent sender identity.
const MAIL_FROM_NAME = 'FrameSet';

/** Formats the "from" header with the brand display name (e.g. "FrameSet <addr>"). */
const formatFromAddress = (address) => (address ? `${MAIL_FROM_NAME} <${address}>` : address);

let transporterPromise = null;

// Returns the SMTP transport. With no SMTP configured (dev), an Ethereal test
// account is created on the first call so the app can send without email setup.
// In E2E test mode, a jsonTransport is used instead: no network call at all,
// nothing sent anywhere — sendMail() captures the content itself (see below).
const getTransporter = async () => {
  if (isE2ETestMode) {
    if (!transporter || !transporter.options?.jsonTransport) {
      mailFrom = mailFrom || 'e2e@frameset.test';
      transporter = nodemailer.createTransport({ jsonTransport: true });
    }
    return transporter;
  }
  if (transporter) {
    return transporter;
  }
  if (!transporterPromise) {
    transporterPromise = nodemailer.createTestAccount().then((account) => {
      logger.info('mail.dev_account.created', {
        message: 'No SMTP configured: an Ethereal test account was created for development.',
        user: account.user,
      });
      mailFrom = account.user;
      transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
        ...SMTP_TIMEOUTS,
      });
      return transporter;
    });
  }
  return transporterPromise;
};

// Builds the branded HTML email body. The code block renders only when `code` is
// supplied; `footer` defaults to the expiry note.
const buildTemplate = ({ title, message, code, footer }) => {
  const fontStack =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
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
          ${
            code
              ? `
          <tr>
            <td style="padding:20px 32px 4px;font-family:${fontStack};">
              <div style="background:#F2F3FF;border:1px solid #D9DEFA;border-radius:14px;padding:20px;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#3C3D48;">
                ${code}
              </div>
            </td>
          </tr>`
              : ''
          }
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

// Sends through the SMTP transport (or Ethereal in dev), inlining the logo via a CID attachment.
const sendViaSmtp = async ({ to, subject, text, html }) => {
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: formatFromAddress(mailFrom),
    to,
    subject,
    text,
    html,
    attachments: [{ filename: 'frameset-logo.png', path: LOGO_PATH, cid: LOGO_CID }],
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

// Sends through the Brevo HTTP API (HTTPS), so delivery works where outbound
// SMTP is blocked. The CID logo reference is swapped for the public logo URL,
// since the API has no CID inlining. Throws on a non-2xx response or timeout.
const sendViaBrevoApi = async ({ to, subject, text, html }) => {
  const htmlContent = LOGO_URL ? html.split(`cid:${LOGO_CID}`).join(LOGO_URL) : html;

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: MAIL_FROM_NAME, email: mailFrom },
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent: text,
    }),
    signal: AbortSignal.timeout(BREVO_API_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Brevo API responded with ${response.status}: ${detail.slice(0, 300)}`);
  }
};

// Sends an email through the configured delivery path. Rejects on failure so
// callers can log it; nothing is retried here.
const sendMail = async ({ to, subject, text, html }) => {
  if (isE2ETestMode) {
    // No network call at all: capture the content so a Playwright run can read it.
    capturedEmailsByRecipient.set(to, { subject, text, html });
    return;
  }

  if (useBrevoApi) {
    await sendViaBrevoApi({ to, subject, text, html });
    return;
  }

  await sendViaSmtp({ to, subject, text, html });
};

module.exports = {
  sendMail,
  buildTemplate,
  getLastEmail,
};
