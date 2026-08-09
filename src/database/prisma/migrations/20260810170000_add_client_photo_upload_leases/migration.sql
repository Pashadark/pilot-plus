CREATE TABLE "public"."ClientPhotoUpload" (
  "id" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "sourceStorageKey" TEXT NOT NULL,
  "finalStorageKey" TEXT NOT NULL,
  "previousPhotoPath" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scanVerdict" TEXT,
  "sha256" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "committedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientPhotoUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientPhotoUpload_uploadId_key"
ON "public"."ClientPhotoUpload"("uploadId");

CREATE UNIQUE INDEX "ClientPhotoUpload_finalStorageKey_key"
ON "public"."ClientPhotoUpload"("finalStorageKey");

CREATE INDEX "ClientPhotoUpload_status_leaseExpiresAt_idx"
ON "public"."ClientPhotoUpload"("status", "leaseExpiresAt");

CREATE INDEX "ClientPhotoUpload_companyId_clientId_status_idx"
ON "public"."ClientPhotoUpload"("companyId", "clientId", "status");

ALTER TABLE "public"."ClientPhotoUpload"
ADD CONSTRAINT "ClientPhotoUpload_companyId_clientId_fkey"
FOREIGN KEY ("companyId", "clientId")
REFERENCES "public"."Client"("companyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;
