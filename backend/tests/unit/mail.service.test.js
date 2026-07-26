process.env.MAIL_HOST = process.env.MAIL_HOST || 'smtp.test.local';
process.env.MAIL_PORT = process.env.MAIL_PORT || '465';
process.env.MAIL_SECURE = process.env.MAIL_SECURE || 'true';
process.env.MAIL_USER = process.env.MAIL_USER || 'mail@test.local';
process.env.MAIL_PASS = process.env.MAIL_PASS || 'test_mail_password';

const nodemailer = require('nodemailer');
const mockSendMail = jest.fn().mockResolvedValue(true);
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));
const mailService = require('../../src/services/mail.service');

describe('mail service', () => {
  it('configures the SMTP transport from environment variables, with fail-fast timeouts', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: process.env.MAIL_HOST,
      port: Number.parseInt(process.env.MAIL_PORT, 10),
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      // Bounded so an unreachable SMTP fails in seconds instead of hanging ~2 min.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  });

  it('builds the email template', () => {
    const html = mailService.buildTemplate({ title: 'Test', message: 'Hello', code: '123456' });
    expect(html).toContain('Test');
    expect(html).toContain('123456');
  });

  it('sends an email', async () => {
    mockSendMail.mockClear();
    mockSendMail.mockResolvedValueOnce(true);
    await mailService.sendMail({
      to: 'axelle@example.com',
      subject: 'Test',
      text: 'Hello',
      html: '<div>Test</div>',
    });
    expect(mockSendMail).toHaveBeenCalled();
  });
});
