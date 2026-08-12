-- Remove the redundant single-column Client FK; the composite FK remains the tenant invariant.
ALTER TABLE "public"."ClientDocument"
DROP CONSTRAINT IF EXISTS "ClientDocument_clientId_fkey";

-- Nullable/additive lifecycle columns keep rolling deployments compatible.
ALTER TABLE "public"."ClientDocumentVersion"
ADD COLUMN "scanRetryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "quarantineExpiresAt" TIMESTAMP(3),
ADD COLUMN "cleanupPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cleanupLeaseExpiresAt" TIMESTAMP(3),
ADD COLUMN "storageDeletedAt" TIMESTAMP(3);

CREATE INDEX "ClientDocumentVersion_cleanupPending_cleanupLeaseExpiresAt_idx"
ON "public"."ClientDocumentVersion"("cleanupPending", "cleanupLeaseExpiresAt");

CREATE TABLE "public"."ClientUploadPermit" (
  "id" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "reservedBytes" INTEGER NOT NULL,
  "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientUploadPermit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientUploadPermit_uploadId_key"
ON "public"."ClientUploadPermit"("uploadId");

CREATE INDEX "ClientUploadPermit_companyId_status_leaseExpiresAt_idx"
ON "public"."ClientUploadPermit"("companyId", "status", "leaseExpiresAt");

CREATE INDEX "ClientUploadPermit_userId_status_leaseExpiresAt_idx"
ON "public"."ClientUploadPermit"("userId", "status", "leaseExpiresAt");

CREATE INDEX "ClientUploadPermit_companyId_createdAt_idx"
ON "public"."ClientUploadPermit"("companyId", "createdAt");

CREATE INDEX "ClientUploadPermit_userId_createdAt_idx"
ON "public"."ClientUploadPermit"("userId", "createdAt");

ALTER TABLE "public"."ClientUploadPermit"
ADD CONSTRAINT "ClientUploadPermit_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ClientUploadPermit"
ADD CONSTRAINT "ClientUploadPermit_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
