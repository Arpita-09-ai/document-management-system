const fs = require('fs');
const express = require('express');
const router = express.Router();

const prisma = require('../utils/prisma');
const authMiddleware = require('../middleware/authMiddleware');

router.post(
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const { name, type } = req.body;
      if (
  !['GENERAL', 'DEPARTMENTAL', 'CONFIDENTIAL']
    .includes(type)
) {
  return res.status(400).json({
    message: 'Invalid folder type',
  });
}
     if (!name || !type) {
        return res.status(400).json({
          message: 'Folder name is required',
        });
      }
const user =
  await prisma.user.findUnique({
    where: {
      id: req.user.id,
    },
    select: {
      departmentId: true,
    },
  });
      const folder = await prisma.folder.create({
  data: {
  name,
  type,
  ownerId: req.user.id,

  departmentId:
  user.departmentId,
}
});
      await prisma.auditLog.create({
  data: {
    action: 'CREATE_FOLDER',
    details: `Created folder "${name}"`,
    userId: req.user.id,
  },
});
      res.status(201).json({
        message: 'Folder created successfully',
        folder,
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
      const user =
  await prisma.user.findUnique({
    where: {
      id: req.user.id,
    },
  });
     const folders =
  await prisma.folder.findMany({
    where: {
      OR: [
        {
          ownerId: req.user.id,
        },
        {
          permissions: {
            some: {
              userId: req.user.id,
            },
          },
        },
        {
          departmentId:
            user.departmentId,
        },
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

      res.json(folders);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);

router.post(
  '/:id/request-access',
  authMiddleware,
  async (req, res) => {
    try {
      const folder =
        await prisma.folder.findUnique({
          where: {
            id: Number(req.params.id),
          },
        });

      if (!folder) {
        return res.status(404).json({
          message: 'Folder not found',
        });
      }
if (
  folder.type !== 'CONFIDENTIAL'
) {
  return res.status(400).json({
    message:
      'Access requests only allowed for confidential folders',
  });
}
if (
  req.user.role === 'ADMIN'
) {
  return res.status(400).json({
    message:
      'Admins do not need access requests',
  });
}
if (
  folder.ownerId === req.user.id
) {
  return res.status(400).json({
    message:
      'You already own this folder',
  });
}
      const existing =
        await prisma.folderAccessRequest.findFirst({
          where: {
            folderId: folder.id,
            requesterId: req.user.id,
            status: 'PENDING',
          },
        });

      if (existing) {
        return res.status(400).json({
          message:
            'Request already pending',
        });
      }
const existingPermission =
  await prisma.folderPermission.findFirst({
    where: {
      folderId: folder.id,
      userId: req.user.id,
    },
  });

if (existingPermission) {
  return res.status(400).json({
    message:
      'You already have access',
  });
}
      const request =
        await prisma.folderAccessRequest.create({
          data: {
            folderId: folder.id,
            requesterId: req.user.id,
          },
        });

      res.status(201).json({
        message:
          'Access request submitted',
        request,
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
  '/my-folders',
  authMiddleware,
  async (req, res) => {
    try {
      const folders =
        await prisma.folder.findMany({
          where: {
            OR: [
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

          include: {
            permissions: {
              where: {
                userId:
                  req.user.id,
              },
            },
          },

          orderBy: {
            createdAt: 'desc',
          },
        });

      res.json(folders);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);
router.get(
  '/confidential',
  authMiddleware,
  async (req, res) => {
    try {
      const user =
        await prisma.user.findUnique({
          where: {
            id: req.user.id,
          },
          select: {
            departmentId: true,
          },
        });

     if (
  req.user.role === 'ADMIN'
) {
  const folders =
    await prisma.folder.findMany({
      where: {
  type: 'CONFIDENTIAL',

  NOT: {
    ownerId: req.user.id,
  },
},
      include: {
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

  return res.json({
  isAdmin: true,
  folders,
});
}

const folders =
  await prisma.folder.findMany({
    where: {
      type: 'CONFIDENTIAL',
      departmentId:
        user.departmentId,

      NOT: {
        ownerId: req.user.id,
      },
       permissions: {
        none: {
          userId: req.user.id,
        },
      },
    },
    
    
    include: {
      department: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

res.json({
  isAdmin: false,
  folders,
});}catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);
router.get(
  '/access-requests',
  authMiddleware,
  async (req, res) => {
    try {
      const requests =
        await prisma.folderAccessRequest.findMany({
          where: {
            folder: {
              ownerId: req.user.id,
            },
            status: 'PENDING',
          },
          include: {
            requester: {
              select: {
                name: true,
                employeeId: true,
              },
            },
            folder: true,
          },
        });

      res.json(requests);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);
router.patch(
  '/requests/:id/approve',
  authMiddleware,
  async (req, res) => {
    try {
      const request =
        await prisma.folderAccessRequest.findUnique({
          where: {
            id: Number(req.params.id),
          },
          include: {
            folder: true,
          },
        });

      if (!request) {
        return res.status(404).json({
          message: 'Request not found',
        });
      }

      if (
        request.folder.ownerId !==
        req.user.id
      ) {
        return res.status(403).json({
          message: 'Access denied',
        });
      }
const existingPermission =
  await prisma.folderPermission.findFirst({
    where: {
      folderId: request.folderId,
      userId: request.requesterId,
    },
  });

if (existingPermission) {
  return res.status(400).json({
    message:
      'User already has access',
  });
}
      await prisma.folderPermission.create({
        data: {
          folderId: request.folderId,
          userId: request.requesterId,
          canView: true,
          canEdit: false,
          canDelete: false,
        },
      });

      await prisma.folderAccessRequest.update({
        where: {
          id: request.id,
        },
        data: {
          status: 'APPROVED',
        },
      });

      res.json({
        message:
          'Request approved successfully',
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
  '/requests/:id/reject',
  authMiddleware,
  async (req, res) => {
    try {
      const request =
        await prisma.folderAccessRequest.findUnique({
          where: {
            id: Number(req.params.id),
          },
          include: {
            folder: true,
          },
        });

      if (!request) {
        return res.status(404).json({
          message: 'Request not found',
        });
      }

      if (
        request.folder.ownerId !==
        req.user.id
      ) {
        return res.status(403).json({
          message: 'Access denied',
        });
      }

      await prisma.folderAccessRequest.update({
        where: {
          id: request.id,
        },
        data: {
          status: 'REJECTED',
        },
      });

      res.json({
        message:
          'Request rejected successfully',
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
  '/my-requests',
  authMiddleware,
  async (req, res) => {
    try {
      const requests =
        await prisma.folderAccessRequest.findMany({
          where: {
            requesterId: req.user.id,
          },
          include: {
            folder: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

      res.json(requests);
    } catch (error) {
      res.status(500).json({
        message: 'Server error',
      });
    }
  }
);
router.get(
  '/general',
  authMiddleware,
  async (req, res) => {
    try {
      const user =
        await prisma.user.findUnique({
          where: {
            id: req.user.id,
          },
          select: {
            departmentId: true,
          },
        });

      if (
        req.user.role === 'ADMIN'
      ) {
        const folders =
          await prisma.folder.findMany({
            where: {
              type: 'GENERAL',
            },

            include: {
              department: {
                select: {
                  name: true,
                },
              },
            },

            orderBy: {
              createdAt: 'desc',
            },
          });

        return res.json(folders);
      }

      const folders =
        await prisma.folder.findMany({
          where: {
            type: 'GENERAL',

            departmentId:
              user.departmentId,
          },

          include: {
            department: {
              select: {
                name: true,
              },
            },
          },

          orderBy: {
            createdAt: 'desc',
          },
        });

      res.json(folders);
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
      const folder =
  await prisma.folder.findUnique({
    where: {
      id: Number(req.params.id),
    },
    include: {
      permissions: true,
      documents: {
  orderBy: {
    createdAt: 'desc',
  },
  select: {
    id: true,
    title: true,
    originalFileName: true,
    documentType: true,
    tags: true,
    createdAt: true,
    uploadedById: true,
  },
},
    },
  });

      if (!folder) {
  return res.status(404).json({
    message: 'Folder not found',
  });
}
const hasPermission =
  folder.permissions.some(
    (permission) =>
      permission.userId ===
      req.user.id
  );
const user =
  await prisma.user.findUnique({
    where: {
      id: req.user.id,
    },
    select: {
      departmentId: true,
    },
  });

const sameDepartment =
  folder.departmentId &&
  folder.departmentId ===
    user.departmentId;
if (
  folder.ownerId !== req.user.id &&
  req.user.role !== 'ADMIN' &&
  !hasPermission &&
  !sameDepartment
) {
  return res.status(403).json({
    message: 'Access denied',
  });

}

      res.json(folder);
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
      const { name } = req.body;

      const folder = await prisma.folder.findUnique({
        where: {
          id: Number(req.params.id),
        },
      });

      if (!folder) {
        return res.status(404).json({
          message: 'Folder not found',
        });
      }

      if (
        folder.ownerId !== req.user.id &&
        req.user.role !== 'ADMIN'
      ) {
        return res.status(403).json({
          message: 'Access denied',
        });
      }

      const updatedFolder =
        await prisma.folder.update({
          where: {
            id: folder.id,
          },
          data: {
            name,
          },
        });
        await prisma.auditLog.create({
  data: {
    action: 'RENAME_FOLDER',
    details: `Renamed folder "${folder.name}" to "${name}"`,
    userId: req.user.id,
  },
});
      res.json({
        message: 'Folder renamed successfully',
        folder: updatedFolder,
      });
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
  async (req, res) => {
    try {
      const folder = await prisma.folder.findUnique({
        where: {
          id: Number(req.params.id),
        },
        include: {
          documents: true,
        },
      });

      if (!folder) {
        return res.status(404).json({
          message: 'Folder not found',
        });
      }

      // EMPLOYEE RULES
      if (req.user.role !== 'ADMIN') {
        if (folder.ownerId !== req.user.id) {
          return res.status(403).json({
            message: 'Access denied',
          });
        }

        if (folder.documents.length > 0) {
          return res.status(400).json({
            message:
              'Folder contains documents. Delete or move them first.',
          });
        }
await prisma.folderAccessRequest.deleteMany({
  where: {
    folderId: folder.id,
  },
});

await prisma.folderPermission.deleteMany({
  where: {
    folderId: folder.id,
  },
});
        await prisma.folder.delete({
          where: {
            id: folder.id,
          },
        });
        await prisma.auditLog.create({
  data: {
    action: 'DELETE_FOLDER',
    details: `Deleted folder "${folder.name}"`,
    userId: req.user.id,
  },
});
        return res.json({
          message: 'Folder deleted successfully',
        });
      }

      // ADMIN RULES
      
      for (const document of folder.documents) {
  if (
    document.filePath &&
    fs.existsSync(
      document.filePath
    )
  ) {
    fs.unlinkSync(
      document.filePath
    );
  }
}
      await prisma.document.deleteMany({
        where: {
          folderId: folder.id,
        },
      });
await prisma.folderAccessRequest.deleteMany({
  where: {
    folderId: folder.id,
  },
});

await prisma.folderPermission.deleteMany({
  where: {
    folderId: folder.id,
  },
});
      await prisma.folder.delete({
        where: {
          id: folder.id,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'DELETE_FOLDER',
          details: `Deleted folder "${folder.name}"`,
          userId: req.user.id,
        },
      });

      res.json({
        message: 'Folder deleted successfully',
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