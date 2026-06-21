const express = require('express');
const router = express.Router();

const prisma = require('../utils/prisma');

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.get(
  '/users',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          employeeId: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      res.json(users);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);

router.get(
  '/documents',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const documents =
        await prisma.document.findMany({
          include: {
            uploadedBy: {
              select: {
                employeeId: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

      res.json(documents);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);

router.get(
  '/audit-logs',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const logs = await prisma.auditLog.findMany({
        include: {
          user: {
            select: {
              employeeId: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json(logs);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);

module.exports = router;