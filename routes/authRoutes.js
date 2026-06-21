const {
  otpLimiter,
} = require('../middleware/rateLimitMiddleware');
const sendOtpEmail = require('../utils/sendOtpEmail');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const router = express.Router();
const svgCaptcha =
  require('svg-captcha');
  
router.post(
  '/register/send-otp',
  otpLimiter,
  async (req, res) => {
    try {
      const {
        employeeId,
        email,
        name,
        password,
        region,
        location,
        department,
      } = req.body;
      if (
  !employeeId?.trim() ||
  !name?.trim() ||
  !email?.trim() ||
  !password?.trim() ||
  !region?.trim() ||
  !location?.trim() ||
  !department?.trim()
) {
  return res.status(400).json({
    message: 'All fields are required',
  });
}
      const normalizedEmployeeId =
        employeeId.trim().toUpperCase();

      const normalizedEmail =
        email.trim().toLowerCase();

      const normalizedName =
        name.trim();

      const allowed =
        normalizedEmail.endsWith(
          '@indianoil.in'
        ) ||
        normalizedEmail ===
          'arpitamajumder605@gmail.com' ||
        normalizedEmail ===
          'arpitamajumder644@gmail.com';

      if (!allowed) {
        return res.status(400).json({
          message:
            'Only Indian Oil employees allowed',
        });
      }

      const existingEmployee =
        await prisma.user.findUnique({
          where: {
            employeeId:
              normalizedEmployeeId,
          },
        });

      if (existingEmployee) {
        return res.status(400).json({
          message:
            'Employee ID already exists',
        });
      }

      const existingEmail =
        await prisma.user.findUnique({
          where: {
            email: normalizedEmail,
          },
        });

      if (existingEmail) {
        return res.status(400).json({
          message:
            'Email already exists',
        });
      }
      const passwordRegex =
/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

if (!passwordRegex.test(password)) {
  return res.status(400).json({
    message:
      'Password must be at least 8 characters and contain uppercase, lowercase, number and special character',
  });
}
      const otp = Math.floor(
        100000 +
          Math.random() * 900000
      ).toString();

      const expiresAt = new Date(
        Date.now() + 5 * 60 * 1000
      );

      await prisma.registrationOTP.deleteMany({
        where: {
          email: normalizedEmail,
        },
      });
const tempHash =
  await bcrypt.hash(
    password,
    10
  );
      await prisma.registrationOTP.create({
        data: {
          email: normalizedEmail,
          code: otp,

          employeeId:
            normalizedEmployeeId,

          name: normalizedName,

          papassword: tempHash,

          region,
          location,
          department,

          expiresAt,
        },
      });

      await sendOtpEmail(
        normalizedEmail,
        otp
      );

      res.json({
        message:
          'OTP sent to your email',
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);
router.post(
  '/register/verify-otp',
  async (req, res) => {
    try {
      const { email, otp } = req.body;

      const normalizedEmail =
        email.trim().toLowerCase();

      const otpRecord =
        await prisma.registrationOTP.findFirst({
          where: {
            email: normalizedEmail,
            code: otp,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

      if (!otpRecord) {
        return res.status(400).json({
          message: 'Invalid OTP',
        });
      }

      if (
        new Date() >
        otpRecord.expiresAt
      ) {
        return res.status(400).json({
          message: 'OTP expired',
        });
      }

      const passwordHash =
  otpRecord.password;

      const regionName =
        otpRecord.region
          .trim()
          .toUpperCase();

      const locationName =
        otpRecord.location
          .trim()
          .toUpperCase();

      const departmentName =
        otpRecord.department
          .trim()
          .toUpperCase();

      let regionRecord =
        await prisma.region.findUnique({
          where: {
            name: regionName,
          },
        });

      if (!regionRecord) {
        regionRecord =
          await prisma.region.create({
            data: {
              name: regionName,
            },
          });
      }

      let locationRecord =
        await prisma.location.findFirst({
          where: {
            name: locationName,
            regionId:
              regionRecord.id,
          },
        });

      if (!locationRecord) {
        locationRecord =
          await prisma.location.create({
            data: {
              name: locationName,
              regionId:
                regionRecord.id,
            },
          });
      }

      let departmentRecord =
        await prisma.department.findFirst({
          where: {
            name: departmentName,
            locationId:
              locationRecord.id,
          },
        });

      if (!departmentRecord) {
        departmentRecord =
          await prisma.department.create({
            data: {
              name: departmentName,
              locationId:
                locationRecord.id,
            },
          });
      }
      const existingUser =
  await prisma.user.findUnique({
    where: {
      email: otpRecord.email,
    },
  });

if (existingUser) {
  return res.status(400).json({
    message: 'User already exists',
  });
}
      const user =
        await prisma.user.create({
          data: {
            employeeId:
              otpRecord.employeeId,
            email:
              otpRecord.email,
            name:
              otpRecord.name,
            passwordHash,
            departmentId:
              departmentRecord.id,
          },
        });

      await prisma.registrationOTP.delete({
        where: {
          id: otpRecord.id,
        },
      });
      await prisma.auditLog.create({
  data: {
    action: 'REGISTER',
    details: 'User registered',
    userId: user.id,
  },
});
      res.status(201).json({
        message:
          'Registration successful',
        user: {
          id: user.id,
          employeeId:
            user.employeeId,
          email: user.email,
          name: user.name,
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);
router.get(
  '/captcha',
  async (req, res) => {
    try {
      await prisma.captcha.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      const captcha =
        svgCaptcha.create({
          size: 6,
          noise: 3,
          color: true,
        });

      const captchaRecord =
        await prisma.captcha.create({
          data: {
            code: captcha.text,
            expiresAt: new Date(
              Date.now() +
                5 * 60 * 1000
            ),
          },
        });

      res.json({
        captchaId:
          captchaRecord.id,
        image: captcha.data,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);
router.post('/login', async (req, res) => {
  try {
    const {
  email,
  password,
  captcha,
  captchaId,
} = req.body;
    const captchaRecord =
  await prisma.captcha.findUnique({
    where: {
      id: Number(captchaId),
    },
  });

if (!captchaRecord) {
  return res.status(400).json({
    message:
      'Captcha expired',
  });
}

if (
  new Date() >
  captchaRecord.expiresAt
) {
  await prisma.captcha.delete({
    where: {
      id: captchaRecord.id,
    },
  });

  return res.status(400).json({
    message:
      'Captcha expired',
  });
}

if (
  captcha.toUpperCase() !==
  captchaRecord.code.toUpperCase()
) {
  
  await prisma.captcha.delete({
    where: {
      id: captchaRecord.id,
    },
  });

  return res.status(400).json({
    message:
      'Invalid captcha',
  });
}

await prisma.captcha.delete({
  where: {
    id: captchaRecord.id,
  },
});
    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid credentials',
      });
    }

    const isPasswordValid =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!isPasswordValid) {
      return res.status(400).json({
        message: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        employeeId: user.employeeId,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d',
      }
    );
    await prisma.auditLog.create({
  data: {
    action: 'LOGIN',
    details: 'User logged in',
    userId: user.id,
  },
});
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Server error',
    });
  }
});

router.get(
  '/me',
  authMiddleware,
  async (req, res) => {
    try {
      const user =
  await prisma.user.findUnique({
    where: {
      id: req.user.id,
    },
    select: {
      employeeId: true,
      name: true,
      role: true,

      department: {
        select: {
          name: true,
        },
      },
    },
  });

      res.json(user);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);
router.get(
  '/admin-test',
  authMiddleware,
  adminMiddleware,
  (req, res) => {
    res.json({
      message: 'Admin access granted',
    });
  }
);
module.exports = router;