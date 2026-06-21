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
      const { name } = req.body;

      const documentType =
        await prisma.documentType.create({
          data: {
            name,
          },
        });

      res.status(201).json({
        message:
          'Document type created successfully',
        documentType,
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
      const documentTypes =
        await prisma.documentType.findMany({
          orderBy: {
            name: 'asc',
          },
        });

      res.json(documentTypes);
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
      await prisma.documentType.delete({
        where: {
          id: Number(req.params.id),
        },
      });

      res.json({
        message:
          'Document type deleted successfully',
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