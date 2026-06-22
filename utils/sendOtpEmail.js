const nodemailer = require('nodemailer');

const transporter =
  nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  });

const sendOtpEmail = async (email, otp) => {
  try {
    const info =
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject:
          'IOCL Verification Code',
        html: `
          <h2>IOCL Document Retrieval System</h2>
          <h1>${otp}</h1>
        `,
      });

    console.log(
      'EMAIL SENT:',
      info.messageId
    );
  } catch (error) {
    console.error(
      'EMAIL ERROR:',
      error
    );
    throw error;
  }
};

module.exports = sendOtpEmail;