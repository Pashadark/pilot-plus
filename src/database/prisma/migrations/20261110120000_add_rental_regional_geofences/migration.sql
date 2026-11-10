CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TYPE "public"."CompanyPermission" ADD VALUE IF NOT EXISTS 'MANAGE_REGIONAL_GEOFENCES';

CREATE TYPE "public"."RegionalGeofenceState" AS ENUM (
  'INSIDE',
  'APPROACHING',
  'OUTSIDE_PENDING',
  'OUTSIDE',
  'RETURNED'
);

CREATE TABLE "public"."RussianRegion" (
  "code" VARCHAR(16) NOT NULL,
  "nameRu" TEXT NOT NULL,
  "nameEn" TEXT,
  "source" TEXT NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "sourceUpdatedAt" TIMESTAMPTZ(3),
  "automaticEnforcementAllowed" BOOLEAN NOT NULL DEFAULT true,
  "boundary" geometry(MultiPolygon, 4326),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RussianRegion_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "public"."RentalRegionalGeofence" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "rentalId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "regionCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "warningDistanceKm" INTEGER NOT NULL DEFAULT 10,
  "attentionDistanceKm" INTEGER NOT NULL DEFAULT 5,
  "criticalDistanceKm" INTEGER NOT NULL DEFAULT 1,
  "hysteresisMeters" INTEGER NOT NULL DEFAULT 150,
  "confirmationPoints" INTEGER NOT NULL DEFAULT 3,
  "confirmationWindowSeconds" INTEGER NOT NULL DEFAULT 10,
  "state" "public"."RegionalGeofenceState" NOT NULL DEFAULT 'INSIDE',
  "pendingTransition" VARCHAR(16),
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "pendingSince" TIMESTAMPTZ(3),
  "outsideSince" TIMESTAMPTZ(3),
  "lastEvaluatedAt" TIMESTAMPTZ(3),
  "lastDistanceKm" DECIMAL(10,3),
  "lastApproachThresholdKm" INTEGER,
  "regionUnion" geometry(MultiPolygon, 4326),
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RentalRegionalGeofence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentalRegionalGeofence_thresholds_check" CHECK (
    "warningDistanceKm" > "attentionDistanceKm"
    AND "attentionDistanceKm" > "criticalDistanceKm"
    AND "criticalDistanceKm" > 0
  ),
  CONSTRAINT "RentalRegionalGeofence_confirmation_check" CHECK (
    "hysteresisMeters" BETWEEN 25 AND 2000
    AND "confirmationPoints" BETWEEN 2 AND 10
    AND "confirmationWindowSeconds" BETWEEN 0 AND 300
  ),
  CONSTRAINT "RentalRegionalGeofence_pending_transition_check" CHECK (
    "pendingTransition" IS NULL OR "pendingTransition" IN ('OUTSIDE', 'INSIDE')
  )
);

CREATE UNIQUE INDEX "RentalRegionalGeofence_rentalId_key"
  ON "public"."RentalRegionalGeofence"("rentalId");
CREATE UNIQUE INDEX "RentalRegionalGeofence_companyId_rentalId_key"
  ON "public"."RentalRegionalGeofence"("companyId", "rentalId");
CREATE INDEX "RentalRegionalGeofence_companyId_enabled_idx"
  ON "public"."RentalRegionalGeofence"("companyId", "enabled");
CREATE INDEX "RentalRegionalGeofence_rentalId_enabled_idx"
  ON "public"."RentalRegionalGeofence"("rentalId", "enabled");
CREATE INDEX "RentalRegionalGeofence_state_lastEvaluatedAt_idx"
  ON "public"."RentalRegionalGeofence"("state", "lastEvaluatedAt");
CREATE INDEX "RussianRegion_nameRu_idx" ON "public"."RussianRegion"("nameRu");
CREATE INDEX "RussianRegion_boundary_gist_idx"
  ON "public"."RussianRegion" USING GIST ("boundary");
CREATE INDEX "RentalRegionalGeofence_regionUnion_gist_idx"
  ON "public"."RentalRegionalGeofence" USING GIST ("regionUnion");

ALTER TABLE "public"."RentalRegionalGeofence"
  ADD CONSTRAINT "RentalRegionalGeofence_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RentalRegionalGeofence"
  ADD CONSTRAINT "RentalRegionalGeofence_companyId_rentalId_fkey"
  FOREIGN KEY ("companyId", "rentalId") REFERENCES "public"."Rental"("companyId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RentalRegionalGeofence"
  ADD CONSTRAINT "RentalRegionalGeofence_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
