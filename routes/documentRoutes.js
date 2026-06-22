
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pdf = require('pdf-parse');
const Tesseract = require('tesseract.js');
const express = require('express');


const prisma = require('../utils/prisma');


const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';

const key = Buffer.from(
  process.env.FILE_ENCRYPTION_KEY,
  'hex'
);
router.post(
  '/upload',
  authMiddleware,
  upload.single('document'),
  async (req, res) => {
    
    try {
      const {
  title,
  documentType,
  tags,
  folderId,
} = req.body;

      if (!req.file) {
        return res.status(400).json({
          message: 'No file uploaded',
        });
      }

      
       let ocrText = null;

if (
  req.file.mimetype.startsWith('image/')
) {
  const result =
    await Tesseract.recognize(
      req.file.buffer,
      'eng'
    );

  ocrText = result.data.text;
  
}
else if (
  req.file.mimetype === 'application/pdf'
) {
  const pdfData = await pdf(
    req.file.buffer
  );

  ocrText = pdfData.text;
}
else if (
  req.file.mimetype ===
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
) {
  const result =
    await mammoth.extractRawText({
      buffer: req.file.buffer,
    });

  ocrText = result.value;
}
else if (
  req.file.mimetype ===
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
) {
  const workbook =
    XLSX.read(
      req.file.buffer,
      { type: 'buffer' }
    );

  let text = '';

  workbook.SheetNames.forEach(
    (sheetName) => {
      const sheet =
        workbook.Sheets[sheetName];

      text +=
        XLSX.utils.sheet_to_csv(
          sheet
        );
    }
  );

  ocrText = text;
}
const iv =
  crypto.randomBytes(16);

const cipher =
  crypto.createCipheriv(
    algorithm,
    key,
    iv
  );

const encrypted =
  Buffer.concat([
    cipher.update(req.file.buffer),
    cipher.final(),
  ]);

const encryptedFile =
  Buffer.concat([
    iv,
    encrypted,
  ]);
const storageDir = path.join(
  __dirname,
  '..',
  'storage'
);

if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, {
    recursive: true,
  });
}

const fileName =
  `${uuidv4()}.enc`;

const filePath = path.join(
  storageDir,
  fileName
);

fs.writeFileSync(
  filePath,
  encryptedFile
);
const fileHash =
  crypto
    .createHash('sha256')
    .update(req.file.buffer)
    .digest('hex');
      const document = await prisma.document.create({
  data: {
    title,
    documentType,
    tags,
    originalFileName: req.file.originalname,
    filePath,
folderId:
  folderId
    ? Number(folderId)
    : null,
mimeType:
  req.file.mimetype,

fileHash,
    ocrText,
    uploadedById: req.user.id,
    folderId: folderId
  ? Number(folderId)
  : null,
  },
});
await prisma.auditLog.create({
  data: {
    action: 'UPLOAD',
    details: `Uploaded document: ${title}`,
    userId: req.user.id,
  },
});
     res.status(201).json({
  message: 'Document uploaded successfully',
  document: {
    id: document.id,
    title: document.title,
    originalFileName:
      document.originalFileName,
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
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const documents =
  await prisma.document.findMany({
    select: {
      id: true,
      title: true,
      originalFileName: true,
      documentType: true,
      tags: true,
      createdAt: true,

      uploadedBy: {
        select: {
          employeeId: true,
          name: true,
        },
      },
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
  '/search',
  authMiddleware,
  async (req, res) => {
    try {
      const q = req.query.q;
      if (!q) {
  return res.status(400).json({
    message: 'Search query is required',
  });
}const user =
  await prisma.user.findUnique({
    where: {
      id: req.user.id,
    },
    select: {
      departmentId: true,
    },
  });
      const documents =
  await prisma.document.findMany({
    where: {
      AND: [
        {
          OR: [
            {
              title: {
                contains: q,
                mode: 'insensitive',
              },
            },
            {
              tags: {
                contains: q,
                mode: 'insensitive',
              },
            },
            {
              ocrText: {
                contains: q,
                mode: 'insensitive',
              },
            },
          ],
        },

        req.user.role === 'ADMIN'
          ? {}
          : {
              folder: {
                OR: [
                  {
                    type: 'GENERAL',
                  },

                  {
                    ownerId:
                      req.user.id,
                  },

                  {
                    permissions: {
                      some: {
                        userId:
                          req.user.id,
                      },
                    },
                  },
                ],
              },
            },
      ],
    },

    include: {
      folder: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },

      uploadedBy: {
        select: {
          employeeId: true,
          name: true,
        },
      },
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
router.patch(
  '/:id',
  authMiddleware,
  async (req, res) => {
    try {
      const { title } = req.body;

      const document =
        await prisma.document.findUnique({
          where: {
            id: Number(
              req.params.id
            ),
          },
        });

      if (!document) {
        return res.status(404).json({
          message:
            'Document not found',
        });
      }

      if (
        document.uploadedById !==
        req.user.id
      ) {
        return res.status(403).json({
          message:
            'You can only rename your own documents',
        });
      }

      const updatedDocument =
        await prisma.document.update({
          where: {
            id: document.id,
          },
          data: {
            title,
          },
        });

      await prisma.auditLog.create({
        data: {
          action:
            'RENAME_DOCUMENT',
          details: `Renamed "${document.title}" to "${title}"`,
          userId:
            req.user.id,
        },
      });

      res.json({
        message:
          'Document renamed successfully',
        document:
          updatedDocument,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          'Server error',
      });
    }
  }
);
router.delete(
  '/:id',
  authMiddleware,
  async (req, res) => {
    try {
      const document =
        await prisma.document.findUnique({
          where: {
            id: parseInt(req.params.id),
          },
        });

      if (!document) {
        return res.status(404).json({
          message: 'Document not found',
        });
      }

     if (
  document.uploadedById !== req.user.id &&
  req.user.role !== 'ADMIN'
) {
        return res.status(403).json({
          message:
            'You can only delete your own documents',
        });
      }
      

      await prisma.auditLog.create({
  data: {
    action: 'DELETE',
    details: `Deleted document: ${document.title}`,
    userId: req.user.id,
  },
});
if (
  fs.existsSync(
    document.filePath
  )
) {
  fs.unlinkSync(
    document.filePath
  );
}
      await prisma.document.delete({
        where: {
          id: document.id,
        },
      });

      res.json({
        message:
          'Document deleted successfully',
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
  '/:id/download',
  authMiddleware,
  async (req, res) => {
    try {
      const document =
        await prisma.document.findUnique({
          where: {
            id: Number(req.params.id),
          },
        });

      if (!document) {
        return res.status(404).json({
          message: 'Document not found',
        });
      }
console.log(
  'DOWNLOAD PATH:',
  document.filePath
);

console.log(
  'FILE EXISTS:',
  fs.existsSync(
    document.filePath
  )
);
      const encryptedBuffer =
        fs.readFileSync(document.filePath);

      const iv =
        encryptedBuffer.subarray(0, 16);

      const encrypted =
        encryptedBuffer.subarray(16);

      const decipher =
        crypto.createDecipheriv(
          algorithm,
          key,
          iv
        );

      const decrypted =
        Buffer.concat([
          decipher.update(encrypted),
          decipher.final(),
        ]);

      res.setHeader(
        'Content-Type',
        document.mimeType
      );

      res.setHeader(
        'Content-Disposition',
        `inline; filename="${document.originalFileName}"`
      );

      res.send(decrypted);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);
router.get(
  '/:id',
  authMiddleware,
  async (req, res) => {
    try {
      console.log('PARAMS:', req.params);
      const document =
  await prisma.document.findUnique({
    where: {
      id: parseInt(req.params.id),
    },
    select: {
      id: true,
      title: true,
      originalFileName: true,
      documentType: true,
      tags: true,
      ocrText: true,
      createdAt: true,

      uploadedBy: {
        select: {
          employeeId: true,
          name: true,
        },
      },
    },
  });

      if (!document) {
        return res.status(404).json({
          message: 'Document not found',
        });
      }

      res.json(document);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);


router.post(
  '/:id/checkout',
  authMiddleware,
  async (req, res) => {
    try {
      const document =
        await prisma.document.findUnique({
          where: {
            id: Number(req.params.id),
          },
        });
const currentFolder =
  await prisma.folder.findUnique({
    where: {
      id: document.folderId,
    },
  });


      if (!document) {
        return res.status(404).json({
          message: 'Document not found',
        });
      }

      if (document.checkedOutById) {
        return res.status(400).json({
          message:
            'Document already checked out',
        });
      }

      const updated =
        await prisma.document.update({
          where: {
            id: document.id,
          },
          data: {
            checkedOutById: req.user.id,
            checkedOutAt: new Date(),
          },
        });

      res.json({
        message:
          'Document checked out',
        document: updated,
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
  '/:id/checkin',
  authMiddleware,
  async (req, res) => {
    try {
      const document =
        await prisma.document.findUnique({
          where: {
            id: Number(req.params.id),
          },
        });

      if (!document) {
        return res.status(404).json({
          message: 'Document not found',
        });
      }

      if (
        document.checkedOutById !==
        req.user.id
      ) {
        return res.status(403).json({
          message:
            'Only checkout user can check in',
        });
      }

      const updated =
        await prisma.document.update({
          where: {
            id: document.id,
          },
          data: {
            checkedOutById: null,
            checkedOutAt: null,
            version: {
              increment: 1,
            },
          },
        });

      res.json({
        message:
          'Document checked in',
        document: updated,
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
  '/:id/create-copy',
  authMiddleware,
  async (req, res) => {
    try {
      const document =
  await prisma.document.findUnique({
    where: {
      id: Number(req.params.id),
    },
    include: {
      folder: {
        include: {
          permissions: true,
        },
      },
    },
  });

      if (!document) {
        return res.status(404).json({
          message: 'Document not found',
        });
      }
if (
  document.folder &&
  document.folder.type ===
    'CONFIDENTIAL'
) {
  const hasPermission =
    document.folder.permissions.some(
      (permission) =>
        permission.userId ===
        req.user.id
    );

  if (
    document.folder.ownerId !==
      req.user.id &&
    req.user.role !== 'ADMIN' &&
    !hasPermission
  ) {
    return res.status(403).json({
      message: 'Access denied',
    });
  }
}
      const newPath =
        path.join(
          __dirname,
          '..',
          'storage',
          `${uuidv4()}.enc`
        );

      fs.copyFileSync(
        document.filePath,
        newPath
      );
const existingCopies =
  await prisma.document.count({
    where: {
      uploadedById:
        req.user.id,

      title: {
        startsWith:
          document.title,
      },
    },
  });

const newTitle = `${document.title}_${existingCopies + 1}`;
      const copy =
        await prisma.document.create({
          data: {
            title: newTitle,

            originalFileName:
              document.originalFileName,

            filePath:
              newPath,

            mimeType:
              document.mimeType,

            fileHash:
              document.fileHash,

            ocrText:
              document.ocrText,

            documentType:
              document.documentType,

            tags:
              document.tags,

            uploadedById:
              req.user.id,

            folderId:
              document.folderId,
          },
        });

      await prisma.auditLog.create({
        data: {
          action: 'CREATE_COPY',
          details:
            `Created copy of ${document.title}`,
          userId: req.user.id,
        },
      });

      res.status(201).json({
        message:
          'Copy created successfully',
        document: copy,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);
router.patch(
  '/:id/update-file',
  authMiddleware,
  upload.single('document'),
  async (req, res) => {
    try {
      const document =
  await prisma.document.findUnique({
    where: {
      id: Number(req.params.id),
    },
  });

if (!document) {
  return res.status(404).json({
    message: 'Document not found',
  });
}

const oldPath =
  document.filePath;

      
if (
  document.uploadedById !== req.user.id &&
  req.user.role !== 'ADMIN'
) {
  return res.status(403).json({
    message:
      'You can only edit your own documents',
  });
}
      if (!req.file) {
        return res.status(400).json({
          message: 'No file uploaded',
        });
      }

      let ocrText = null;
      if (
  req.file.mimetype.startsWith('image/')
) {
  const result =
    await Tesseract.recognize(
      req.file.buffer,
      'eng'
    );

  ocrText = result.data.text;
  
}
else if (
  req.file.mimetype === 'application/pdf'
) {
  const pdfData = await pdf(
    req.file.buffer
  );

  ocrText = pdfData.text;
}
else if (
  req.file.mimetype ===
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
) {
  const result =
    await mammoth.extractRawText({
      buffer: req.file.buffer,
    });

  ocrText = result.value;
}
else if (
  req.file.mimetype ===
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
) {
  const workbook =
    XLSX.read(
      req.file.buffer,
      { type: 'buffer' }
    );

  let text = '';

  workbook.SheetNames.forEach(
    (sheetName) => {
      const sheet =
        workbook.Sheets[sheetName];

      text +=
        XLSX.utils.sheet_to_csv(
          sheet
        );
    }
  );

  ocrText = text;
}

const iv =
  crypto.randomBytes(16);

const cipher =
  crypto.createCipheriv(
    algorithm,
    key,
    iv
  );

const encrypted =
  Buffer.concat([
    cipher.update(req.file.buffer),
    cipher.final(),
  ]);

const encryptedFile =
  Buffer.concat([
    iv,
    encrypted,
  ]);
  const fileName =
  `${uuidv4()}.enc`;



const filePath =
  path.join(
    __dirname,
    '..',
    'storage',
    fileName
  );

fs.writeFileSync(
  filePath,
  encryptedFile
);

console.log(
  'NEW FILE EXISTS:',
  fs.existsSync(filePath)
);


const fileHash =
  crypto
    .createHash('sha256')
    .update(req.file.buffer)
    .digest('hex');
    const updated =
  await prisma.document.update({
    where: {
      id: document.id,
    },
    data: {
      originalFileName:
        req.file.originalname,

      filePath,

      mimeType:
        req.file.mimetype,

      fileHash,

      ocrText,

      version: {
        increment: 1,
      },
    },
  });
  
  const documentsUsingOldPath =
  await prisma.document.count({
    where: {
      filePath: oldPath,
    },
  });

if (
  documentsUsingOldPath === 0 &&
  oldPath &&
  fs.existsSync(oldPath)
) {
  fs.unlinkSync(oldPath);
}
  await prisma.auditLog.create({
  data: {
    action: 'EDIT_DOCUMENT',
    details:
      `Edited ${document.title}`,
    userId: req.user.id,
  },
});
res.json({
  message:
    'Document updated successfully',
  document: updated,
});
    } catch (error) {
  console.error(error);

  res.status(500).json({
    message: 'Server error',
  });
}
}
);
router.patch(
  '/:id/move',
  authMiddleware,
  async (req, res) => {
    const { folderId } = req.body;

    const document =
      await prisma.document.findUnique({
        where: {
          id: Number(req.params.id),
        },
      });

    if (!document) {
      return res.status(404).json({
        message: 'Document not found',
      });
    }

    if (
      document.uploadedById !== req.user.id &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        message:
          'You can only move your own documents',
      });
    }

    const targetFolder =
      await prisma.folder.findUnique({
        where: {
          id: Number(folderId),
        },
      });
const currentFolder =
  await prisma.folder.findUnique({
    where: {
      id: document.folderId,
    },
  });

if (
  currentFolder?.type ===
  'CONFIDENTIAL'
) {
  return res.status(400).json({
    message:
      'Documents in confidential folders cannot be moved',
  });
}

if (
  targetFolder.type ===
  'CONFIDENTIAL'
) {
  return res.status(400).json({
    message:
      'Documents cannot be moved into confidential folders',
  });
}
    if (!targetFolder) {
      return res.status(404).json({
        message: 'Target folder not found',
      });
    }

    await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        folderId: Number(folderId),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'MOVE_DOCUMENT',
        details: `Moved "${document.title}"`,
        userId: req.user.id,
      },
    });

    res.json({
      message:
        'Document moved successfully',
    });
  }
);
module.exports = router;