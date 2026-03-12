const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

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

const sendMail = async ({ to, subject, text, html }) => {
  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to,
    subject,
    text,
    html
  });
};

module.exports = {
  sendMail,
  buildTemplate
};
