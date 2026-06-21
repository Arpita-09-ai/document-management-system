/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `publicId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `resourceType` on the `Document` table. All the data in the column will be lost.
  - Added the required column `encryptedFile` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileHash` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Folder` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FolderType" AS ENUM ('GENERAL', 'DEPARTMENTAL', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX "Folder_ownerId_idx";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "fileUrl",
DROP COLUMN "publicId",
DROP COLUMN "resourceType",
ADD COLUMN     "checkedOutAt" TIMESTAMP(3),
ADD COLUMN     "checkedOutById" INTEGER,
ADD COLUMN     "encryptedFile" BYTEA NOT NULL,
ADD COLUMN     "fileHash" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "departmentId" INTEGER,
ADD COLUMN     "type" "FolderType" NOT NULL;

-- CreateTable
CREATE TABLE "FolderAccessRequest" (
    "id" SERIAL NOT NULL,
    "folderId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolderAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolderPermission" (
    "id" SERIAL NOT NULL,
    "folderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FolderPermission_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderAccessRequest" ADD CONSTRAINT "FolderAccessRequest_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderAccessRequest" ADD CONSTRAINT "FolderAccessRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderPermission" ADD CONSTRAINT "FolderPermission_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderPermission" ADD CONSTRAINT "FolderPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
