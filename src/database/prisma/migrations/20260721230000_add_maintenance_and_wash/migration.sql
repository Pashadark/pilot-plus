-- CreateEnum
CREATE TYPE "public"."MaintenanceStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."MaintenanceKind" AS ENUM ('OIL', 'FILTERS', 'BRAKES', 'TIRES', 'TIMING', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."WashStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."WashKind" AS ENUM ('BODY', 'COMPLEX', 'INTERIOR', 'MATS', 'ENGINE', 'OTHER');

-- AlterTable
ALTER TABLE "public"."MaintenanceRecord"
  ADD COLUMN "kind" "public"."MaintenanceKind" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "targetOdometerKm" DECIMAL(12, 1),
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "costMinor" INTEGER,
  ADD COLUMN "notes" TEXT;

ALTER TABLE "public"."MaintenanceRecord"
  ALTER COLUMN "kind" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "public"."MaintenanceStatus"
  USING CASE
    WHEN "status" IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED')
      THEN "status"::"public"."MaintenanceStatus"
    ELSE 'PLANNED'::"public"."MaintenanceStatus"
  END;

-- CreateTable
CREATE TABLE "public"."WashRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "public"."WashKind" NOT NULL,
    "status" "public"."WashStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "provider" TEXT,
    "costMinor" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WashRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WashRecord_vehicleId_scheduledAt_idx" ON "public"."WashRecord"("vehicleId", "scheduledAt");

-- CreateIndex
CREATE INDEX "WashRecord_status_scheduledAt_idx" ON "public"."WashRecord"("status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "public"."WashRecord" ADD CONSTRAINT "WashRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
