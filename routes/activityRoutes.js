const express = require('express');
const router = express.Router();

const prisma = require('../utils/prisma');

const authMiddleware = require('../middleware/authMiddleware');

router.get(
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const activities =
        await prisma.auditLog.findMany({
          where: {
            userId: req.user.id,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        });

      res.json(activities);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);

module.exports = router;