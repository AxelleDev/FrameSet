const nodemailer = require('nodemailer');
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue(true)
  }))
}));
const mailService = require('../../src/services/mail.service');

describe('service de mail', () => {

  it('devrait construire le template d’email', () => {
    const html = mailService.buildTemplate({ title: 'Test', message: 'Hello', code: '123456' });
    expect(html).toContain('Test');
    expect(html).toContain('123456');
  });

  it('devrait envoyer un mail', async () => {
    const mockTransport = { sendMail: jest.fn().mockResolvedValue(true) };
    nodemailer.createTransport.mockReturnValue(mockTransport);
    await mailService.sendMail({ to: 'a@b.com', subject: 'Test', text: 'Hello', html: '<div>Test</div>' });
    expect(mockTransport.sendMail).toHaveBeenCalled();
  });
});
