-- CreateEnum
CREATE TYPE "public"."DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'WARNING', 'UNASSIGNED', 'DISABLED');

-- CreateEnum
CREATE TYPE "public"."DeviceConnectionType" AS ENUM ('LTE', 'GSM', 'NONE');

-- CreateEnum
CREATE TYPE "public"."DevicePowerSource" AS ENUM ('VEHICLE', 'BATTERY');

-- CreateEnum
CREATE TYPE "public"."FirmwareChannel" AS ENUM ('STABLE', 'BETA');

-- CreateEnum
CREATE TYPE "public"."DeviceCommandType" AS ENUM ('REBOOT', 'SHUTDOWN', 'UPDATE_FIRMWARE');

-- CreateEnum
CREATE TYPE "public"."DeviceCommandStatus" AS ENUM ('PENDING', 'SENT', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."Device" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "hardwareVersion" TEXT NOT NULL,
    "firmwareVersion" TEXT NOT NULL,
    "status" "public"."DeviceStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "connectionType" "public"."DeviceConnectionType" NOT NULL DEFAULT 'NONE',
    "mobileOperator" TEXT,
    "signalStrength" INTEGER,
    "satellitesCount" INTEGER,
    "positionAccuracyMeters" DECIMAL(8,2),
    "powerSource" "public"."DevicePowerSource" NOT NULL DEFAULT 'VEHICLE',
    "externalVoltage" DECIMAL(5,2),
    "batteryLevel" INTEGER,
    "ignitionOn" BOOLEAN NOT NULL DEFAULT false,
    "isMoving" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "lastSeenAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FirmwareRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "channel" "public"."FirmwareChannel" NOT NULL DEFAULT 'STABLE',
    "releaseNotes" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmwareRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeviceCommand" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "firmwareReleaseId" TEXT,
    "type" "public"."DeviceCommandType" NOT NULL,
    "status" "public"."DeviceCommandStatus" NOT NULL DEFAULT 'PENDING',
    "targetFirmwareVersion" TEXT,
    "payload" JSONB,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_vehicleId_key" ON "public"."Device"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_serialNumber_key" ON "public"."Device"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Device_imei_key" ON "public"."Device"("imei");

-- CreateIndex
CREATE INDEX "Device_companyId_status_idx" ON "public"."Device"("companyId", "status");

-- CreateIndex
CREATE INDEX "Device_companyId_firmwareVersion_idx" ON "public"."Device"("companyId", "firmwareVersion");

-- CreateIndex
CREATE INDEX "Device_companyId_lastSeenAt_idx" ON "public"."Device"("companyId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "FirmwareRelease_version_key" ON "public"."FirmwareRelease"("version");

-- CreateIndex
CREATE INDEX "DeviceCommand_companyId_status_idx" ON "public"."DeviceCommand"("companyId", "status");

-- CreateIndex
CREATE INDEX "DeviceCommand_deviceId_status_createdAt_idx" ON "public"."DeviceCommand"("deviceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DeviceCommand_createdByUserId_createdAt_idx" ON "public"."DeviceCommand"("createdByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Device" ADD CONSTRAINT "Device_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Device" ADD CONSTRAINT "Device_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceCommand" ADD CONSTRAINT "DeviceCommand_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceCommand" ADD CONSTRAINT "DeviceCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceCommand" ADD CONSTRAINT "DeviceCommand_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeviceCommand" ADD CONSTRAINT "DeviceCommand_firmwareReleaseId_fkey" FOREIGN KEY ("firmwareReleaseId") REFERENCES "public"."FirmwareRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Проверяем диапазоны телеметрии на уровне базы данных.
ALTER TABLE "public"."Device"
ADD CONSTRAINT "Device_signalStrength_check"
CHECK ("signalStrength" IS NULL OR ("signalStrength" BETWEEN 0 AND 100)),
ADD CONSTRAINT "Device_batteryLevel_check"
CHECK ("batteryLevel" IS NULL OR ("batteryLevel" BETWEEN 0 AND 100)),
ADD CONSTRAINT "Device_satellitesCount_check"
CHECK ("satellitesCount" IS NULL OR "satellitesCount" >= 0),
ADD CONSTRAINT "Device_latitude_check"
CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90)),
ADD CONSTRAINT "Device_longitude_check"
CHECK ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180));
