
const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message:
      'Too many OTP requests. Please try again after 15 minutes.',
  },
});

module.exports = {
  otpLimiter,
};