ALTER TYPE "public"."CompanyPermission" ADD VALUE IF NOT EXISTS 'VIEW_FINES';
ALTER TYPE "public"."CompanyPermission" ADD VALUE IF NOT EXISTS 'MANAGE_FINES';
ALTER TYPE "public"."AuditEntityType" ADD VALUE IF NOT EXISTS 'FINE';
ALTER TYPE "public"."AuditEntityType" ADD VALUE IF NOT EXISTS 'FINE_INTEGRATION';

CREATE TYPE "public"."FineStatus" AS ENUM ('NEW', 'UNPAID', 'PAID', 'CANCELLED', 'OVERDUE');
CREATE TYPE "public"."FineAssignmentSource" AS ENUM ('AUTOMATIC', 'MANUAL');

CREATE TABLE "public"."FineIntegration" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'DRIVER_HELPER',
  "tokenEncrypted" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastAttemptAt" TIMESTAMPTZ(3),
  "lastSuccessAt" TIMESTAMPTZ(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FineIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ExternalVehicleLink" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "vehicleId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'DRIVER_HELPER',
  "externalId" TEXT NOT NULL,
  "registrationNumberNormalized" TEXT,
  "registrationCertificateIndex" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalVehicleLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Fine" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "vehicleId" TEXT,
  "rentalId" TEXT,
  "clientId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'DRIVER_HELPER',
  "externalId" TEXT NOT NULL,
  "uin" TEXT,
  "decreeNumber" TEXT NOT NULL,
  "decreeAt" TIMESTAMPTZ(3),
  "offenseAt" TIMESTAMPTZ(3) NOT NULL,
  "discountExpiresAt" TIMESTAMPTZ(3),
  "originalAmountMinor" BIGINT NOT NULL,
  "currentAmountMinor" BIGINT NOT NULL,
  "discountPercent" INTEGER,
  "articleCode" TEXT,
  "description" TEXT,
  "address" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "status" "public"."FineStatus" NOT NULL DEFAULT 'NEW',
  "toBailiff" BOOLEAN NOT NULL DEFAULT false,
  "providerComment" TEXT,
  "photoState" TEXT,
  "providerUpdatedAt" TIMESTAMPTZ(3),
  "lastSyncedAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Fine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."FineAssignmentHistory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fineId" TEXT NOT NULL,
  "vehicleId" TEXT,
  "rentalId" TEXT,
  "clientId" TEXT,
  "source" "public"."FineAssignmentSource" NOT NULL,
  "reason" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FineAssignmentHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FineIntegration_companyId_key" ON "public"."FineIntegration"("companyId");
CREATE UNIQUE INDEX "ExternalVehicleLink_companyId_provider_externalId_key" ON "public"."ExternalVehicleLink"("companyId", "provider", "externalId");
CREATE INDEX "ExternalVehicleLink_companyId_vehicleId_idx" ON "public"."ExternalVehicleLink"("companyId", "vehicleId");
CREATE UNIQUE INDEX "Fine_companyId_provider_externalId_key" ON "public"."Fine"("companyId", "provider", "externalId");
CREATE INDEX "Fine_companyId_status_offenseAt_idx" ON "public"."Fine"("companyId", "status", "offenseAt");
CREATE INDEX "Fine_companyId_vehicleId_offenseAt_idx" ON "public"."Fine"("companyId", "vehicleId", "offenseAt");
CREATE INDEX "Fine_companyId_clientId_offenseAt_idx" ON "public"."Fine"("companyId", "clientId", "offenseAt");
CREATE INDEX "FineAssignmentHistory_companyId_fineId_createdAt_idx" ON "public"."FineAssignmentHistory"("companyId", "fineId", "createdAt");
CREATE INDEX "FineAssignmentHistory_actorUserId_createdAt_idx" ON "public"."FineAssignmentHistory"("actorUserId", "createdAt");

ALTER TABLE "public"."FineIntegration" ADD CONSTRAINT "FineIntegration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ExternalVehicleLink" ADD CONSTRAINT "ExternalVehicleLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ExternalVehicleLink" ADD CONSTRAINT "ExternalVehicleLink_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Fine" ADD CONSTRAINT "Fine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Fine" ADD CONSTRAINT "Fine_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Fine" ADD CONSTRAINT "Fine_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "public"."Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Fine" ADD CONSTRAINT "Fine_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."FineAssignmentHistory" ADD CONSTRAINT "FineAssignmentHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."FineAssignmentHistory" ADD CONSTRAINT "FineAssignmentHistory_fineId_fkey" FOREIGN KEY ("fineId") REFERENCES "public"."Fine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."FineAssignmentHistory" ADD CONSTRAINT "FineAssignmentHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
