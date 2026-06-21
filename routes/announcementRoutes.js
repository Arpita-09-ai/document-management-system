const express = require('express');
const router = express.Router();

const prisma = require('../utils/prisma');

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { title, content } = req.body;

      const announcement =
        await prisma.announcement.create({
          data: {
            title,
            content,
          },
        });

      res.status(201).json({
        message:
          'Announcement created successfully',
        announcement,
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
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const announcements =
        await prisma.announcement.findMany({
          orderBy: {
            createdAt: 'desc',
          },
        });

      res.json(announcements);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);

router.delete(
  '/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      await prisma.announcement.delete({
        where: {
          id: Number(req.params.id),
        },
      });

      res.json({
        message:
          'Announcement deleted successfully',
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);

module.exports = router;