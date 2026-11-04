CREATE TYPE "public"."GpsNotificationMode" AS ENUM (
  'RECORD_ONLY',
  'STAFF_ONLY',
  'STAFF_AND_CLIENT'
);

ALTER TABLE "public"."VehicleEvent"
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "rentalId" TEXT,
  ADD COLUMN "clientId" TEXT,
  ADD COLUMN "startedAt" TIMESTAMPTZ(3),
  ADD COLUMN "endedAt" TIMESTAMPTZ(3),
  ADD COLUMN "startLatitude" DECIMAL(9, 6),
  ADD COLUMN "startLongitude" DECIMAL(9, 6),
  ADD COLUMN "endLatitude" DECIMAL(9, 6),
  ADD COLUMN "endLongitude" DECIMAL(9, 6),
  ADD COLUMN "startSpeedKph" DECIMAL(8, 3),
  ADD COLUMN "endSpeedKph" DECIMAL(8, 3),
  ADD COLUMN "maxAccelerationMps2" DECIMAL(8, 3),
  ADD COLUMN "durationMs" INTEGER,
  ADD COLUMN "trackPointIds" JSONB,
  ADD COLUMN "details" JSONB;

CREATE TABLE "public"."CompanyGpsSettings" (
  "companyId" TEXT NOT NULL,
  "accelerationDetectionEnabled" BOOLEAN NOT NULL DEFAULT true,
  "harshAccelerationThresholdMps2" DECIMAL(5, 2) NOT NULL DEFAULT 3.0,
  "criticalAccelerationThresholdMps2" DECIMAL(5, 2) NOT NULL DEFAULT 4.0,
  "confirmationWindowMs" INTEGER NOT NULL DEFAULT 3000,
  "mergeWindowMs" INTEGER NOT NULL DEFAULT 3000,
  "maximumGapMs" INTEGER NOT NULL DEFAULT 10000,
  "clientWarningEventCount" INTEGER NOT NULL DEFAULT 3,
  "clientWarningWindowMinutes" INTEGER NOT NULL DEFAULT 30,
  "clientWarningCooldownMinutes" INTEGER NOT NULL DEFAULT 30,
  "notificationMode" "public"."GpsNotificationMode" NOT NULL DEFAULT 'RECORD_ONLY',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "CompanyGpsSettings_pkey" PRIMARY KEY ("companyId")
);

CREATE TABLE "public"."VehicleGpsSettingsOverride" (
  "vehicleId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "accelerationDetectionEnabled" BOOLEAN,
  "harshAccelerationThresholdMps2" DECIMAL(5, 2),
  "criticalAccelerationThresholdMps2" DECIMAL(5, 2),
  "confirmationWindowMs" INTEGER,
  "mergeWindowMs" INTEGER,
  "maximumGapMs" INTEGER,
  "clientWarningEventCount" INTEGER,
  "clientWarningWindowMinutes" INTEGER,
  "clientWarningCooldownMinutes" INTEGER,
  "notificationMode" "public"."GpsNotificationMode",
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "VehicleGpsSettingsOverride_pkey" PRIMARY KEY ("vehicleId")
);

CREATE TABLE "public"."GpsClientWarning" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "rentalId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "dedupeKey" VARCHAR(191) NOT NULL,
  "eventIds" JSONB NOT NULL,
  "eventCount" INTEGER NOT NULL,
  "windowStartedAt" TIMESTAMPTZ(3) NOT NULL,
  "windowEndedAt" TIMESTAMPTZ(3) NOT NULL,
  "sentAt" TIMESTAMPTZ(3),
  "acknowledgedAt" TIMESTAMPTZ(3),
  "telegramMessageId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "GpsClientWarning_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleEvent_companyId_recordedAt_idx"
  ON "public"."VehicleEvent"("companyId", "recordedAt");
CREATE INDEX "VehicleEvent_rentalId_recordedAt_idx"
  ON "public"."VehicleEvent"("rentalId", "recordedAt");
CREATE INDEX "VehicleEvent_clientId_recordedAt_idx"
  ON "public"."VehicleEvent"("clientId", "recordedAt");
CREATE INDEX "VehicleEvent_type_recordedAt_idx"
  ON "public"."VehicleEvent"("type", "recordedAt");

CREATE UNIQUE INDEX "VehicleGpsSettingsOverride_companyId_vehicleId_key"
  ON "public"."VehicleGpsSettingsOverride"("companyId", "vehicleId");
CREATE INDEX "VehicleGpsSettingsOverride_companyId_idx"
  ON "public"."VehicleGpsSettingsOverride"("companyId");

CREATE UNIQUE INDEX "GpsClientWarning_dedupeKey_key"
  ON "public"."GpsClientWarning"("dedupeKey");
CREATE INDEX "GpsClientWarning_companyId_createdAt_idx"
  ON "public"."GpsClientWarning"("companyId", "createdAt");
CREATE INDEX "GpsClientWarning_rentalId_windowEndedAt_idx"
  ON "public"."GpsClientWarning"("rentalId", "windowEndedAt");
CREATE INDEX "GpsClientWarning_clientId_acknowledgedAt_idx"
  ON "public"."GpsClientWarning"("clientId", "acknowledgedAt");

ALTER TABLE "public"."VehicleEvent"
  ADD CONSTRAINT "VehicleEvent_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "VehicleEvent_rentalId_fkey"
  FOREIGN KEY ("rentalId") REFERENCES "public"."Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "VehicleEvent_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."CompanyGpsSettings"
  ADD CONSTRAINT "CompanyGpsSettings_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."VehicleGpsSettingsOverride"
  ADD CONSTRAINT "VehicleGpsSettingsOverride_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "VehicleGpsSettingsOverride_companyId_vehicleId_fkey"
  FOREIGN KEY ("companyId", "vehicleId") REFERENCES "public"."Vehicle"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."GpsClientWarning"
  ADD CONSTRAINT "GpsClientWarning_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GpsClientWarning_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GpsClientWarning_rentalId_fkey"
  FOREIGN KEY ("rentalId") REFERENCES "public"."Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GpsClientWarning_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
