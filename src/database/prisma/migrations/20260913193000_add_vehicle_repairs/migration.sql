ALTER TYPE "public"."MaintenanceStatus" ADD VALUE IF NOT EXISTS 'DAMAGE_REPORTED';
ALTER TYPE "public"."MaintenanceStatus" ADD VALUE IF NOT EXISTS 'WAITING_REPAIR';

CREATE TYPE "public"."MaintenanceRecordType" AS ENUM ('MAINTENANCE', 'REPAIR');
CREATE TYPE "public"."MaintenanceAttachmentKind" AS ENUM ('DAMAGE_BEFORE', 'REPAIR_AFTER', 'DOCUMENT', 'RECEIPT');

ALTER TABLE "public"."MaintenanceRecord"
  ADD COLUMN "recordType" "public"."MaintenanceRecordType" NOT NULL DEFAULT 'MAINTENANCE',
  ADD COLUMN "damageReportedAt" TIMESTAMPTZ(3),
  ADD COLUMN "startedAt" TIMESTAMPTZ(3),
  ADD COLUMN "rentalId" TEXT,
  ADD COLUMN "clientId" TEXT;

CREATE TABLE "public"."MaintenanceWorkItem" (
  "id" TEXT NOT NULL,
  "maintenanceRecordId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "costMinor" INTEGER,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceWorkItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."MaintenanceAttachment" (
  "id" TEXT NOT NULL,
  "maintenanceRecordId" TEXT NOT NULL,
  "kind" "public"."MaintenanceAttachmentKind" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "verifiedMime" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "caption" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceRecord_vehicleId_recordType_status_idx"
  ON "public"."MaintenanceRecord"("vehicleId", "recordType", "status");
CREATE INDEX "MaintenanceRecord_rentalId_idx" ON "public"."MaintenanceRecord"("rentalId");
CREATE INDEX "MaintenanceRecord_clientId_idx" ON "public"."MaintenanceRecord"("clientId");
CREATE INDEX "MaintenanceWorkItem_maintenanceRecordId_position_idx"
  ON "public"."MaintenanceWorkItem"("maintenanceRecordId", "position");
CREATE UNIQUE INDEX "MaintenanceAttachment_storageKey_key"
  ON "public"."MaintenanceAttachment"("storageKey");
CREATE INDEX "MaintenanceAttachment_maintenanceRecordId_kind_createdAt_idx"
  ON "public"."MaintenanceAttachment"("maintenanceRecordId", "kind", "createdAt");

ALTER TABLE "public"."MaintenanceRecord"
  ADD CONSTRAINT "MaintenanceRecord_rentalId_fkey"
  FOREIGN KEY ("rentalId") REFERENCES "public"."Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MaintenanceRecord_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."MaintenanceWorkItem"
  ADD CONSTRAINT "MaintenanceWorkItem_maintenanceRecordId_fkey"
  FOREIGN KEY ("maintenanceRecordId") REFERENCES "public"."MaintenanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."MaintenanceAttachment"
  ADD CONSTRAINT "MaintenanceAttachment_maintenanceRecordId_fkey"
  FOREIGN KEY ("maintenanceRecordId") REFERENCES "public"."MaintenanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
