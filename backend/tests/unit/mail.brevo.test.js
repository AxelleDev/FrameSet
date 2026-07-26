/**
 * Covers the Brevo HTTP API delivery path (used in production where outbound
 * SMTP is blocked, e.g. Railway). Isolated from mail.service.test.js because the
 * delivery path is chosen from env at import time.
 */
process.env.BREVO_API_KEY = 'test-brevo-key';
process.env.MAIL_FROM_ADDRESS = 'hello@frameset.app';
process.env.FRONTEND_ORIGIN = 'https://frameset.example';
// Ensure no SMTP path is configured, so the Brevo path is chosen.
delete process.env.MAIL_HOST;
delete process.env.MAIL_PORT;
delete process.env.MAIL_SECURE;
delete process.env.MAIL_USER;
delete process.env.MAIL_PASS;

jest.mock('nodemailer', () => ({ createTransport: jest.fn(), createTestAccount: jest.fn() }));

const mailService = require('../../src/services/mail.service');

describe('mail service — Brevo HTTP API path', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it('POSTs to the Brevo API with the sender, recipient and content', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' });
    global.fetch = fetchMock;

    const html = mailService.buildTemplate({ title: 'Confirm', message: 'Hi', code: '135790' });
    await mailService.sendMail({
      to: 'user@example.com',
      subject: 'Confirm your registration',
      text: 'Your code is 135790',
      html,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options.method).toBe('POST');
    expect(options.headers['api-key']).toBe('test-brevo-key');

    const body = JSON.parse(options.body);
    expect(body.sender).toEqual({ name: 'FrameSet', email: 'hello@frameset.app' });
    expect(body.to).toEqual([{ email: 'user@example.com' }]);
    expect(body.subject).toBe('Confirm your registration');
    expect(body.textContent).toBe('Your code is 135790');
    // The CID logo reference is swapped for the public frontend URL (no CID inlining over the API).
    expect(body.htmlContent).not.toContain('cid:frameset-logo');
    expect(body.htmlContent).toContain('https://frameset.example/FrameSet_Logo.png');
    expect(body.htmlContent).toContain('135790');
  });

  it('throws on a non-2xx Brevo API response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });

    await expect(
      mailService.sendMail({ to: 'x@example.com', subject: 's', text: 't', html: '<p>h</p>' }),
    ).rejects.toThrow(/Brevo API responded with 401/);
  });
});
