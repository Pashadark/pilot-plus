CREATE TYPE "public"."ClientDocumentCategory" AS ENUM (
  'PASSPORT',
  'DRIVER_LICENSE',
  'CONTRACT',
  'POWER_OF_ATTORNEY',
  'MEDICAL',
  'OTHER'
);

CREATE TYPE "public"."DocumentScanStatus" AS ENUM (
  'UPLOADING',
  'PENDING',
  'CLEAN',
  'BLOCKED',
  'ERROR',
  'ARCHIVED'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VIEW';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOWNLOAD';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SCAN';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'CLIENT_DOCUMENT';

CREATE TABLE "public"."ClientDocument" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "category" "public"."ClientDocumentCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "numberEncrypted" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "status" "public"."DocumentScanStatus" NOT NULL DEFAULT 'UPLOADING',
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ClientDocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "verifiedMime" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "scanEngine" TEXT,
  "signatureVersion" TEXT,
  "scanVerdict" TEXT,
  "scannedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientDocumentVersion_storageKey_key" ON "public"."ClientDocumentVersion"("storageKey");
CREATE UNIQUE INDEX "ClientDocumentVersion_documentId_version_key" ON "public"."ClientDocumentVersion"("documentId", "version");
CREATE UNIQUE INDEX "Client_companyId_id_key" ON "public"."Client"("companyId", "id");
CREATE INDEX "ClientDocument_companyId_clientId_status_idx" ON "public"."ClientDocument"("companyId", "clientId", "status");
CREATE INDEX "ClientDocumentVersion_documentId_createdAt_idx" ON "public"."ClientDocumentVersion"("documentId", "createdAt");

ALTER TABLE "public"."ClientDocument"
ADD CONSTRAINT "ClientDocument_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ClientDocument"
ADD CONSTRAINT "ClientDocument_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ClientDocument"
ADD CONSTRAINT "ClientDocument_companyId_clientId_fkey"
FOREIGN KEY ("companyId", "clientId") REFERENCES "public"."Client"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ClientDocument"
ADD CONSTRAINT "ClientDocument_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."ClientDocumentVersion"
ADD CONSTRAINT "ClientDocumentVersion_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "public"."ClientDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
