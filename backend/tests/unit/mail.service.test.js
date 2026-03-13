const nodemailer = require('nodemailer');
const mockSendMail = jest.fn().mockResolvedValue(true);
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail
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
    mockSendMail.mockClear();
    mockSendMail.mockResolvedValueOnce(true);
    await mailService.sendMail({ to: 'axelle@example.com', subject: 'Test', text: 'Hello', html: '<div>Test</div>' });
    expect(mockSendMail).toHaveBeenCalled();
  });
});
