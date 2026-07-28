-- CreateEnum
CREATE TYPE "public"."ManualVehicleEventKind" AS ENUM ('NOTE', 'INCIDENT', 'ASSIGNMENT');

-- CreateTable
CREATE TABLE "public"."ManualVehicleEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "public"."ManualVehicleEventKind" NOT NULL,
    "severity" "public"."TelemetrySeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualVehicleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventReadReceipt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventKey" VARCHAR(191) NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualVehicleEvent_companyId_recordedAt_idx" ON "public"."ManualVehicleEvent"("companyId", "recordedAt");

-- CreateIndex
CREATE INDEX "ManualVehicleEvent_vehicleId_recordedAt_idx" ON "public"."ManualVehicleEvent"("vehicleId", "recordedAt");

-- CreateIndex
CREATE INDEX "ManualVehicleEvent_authorId_createdAt_idx" ON "public"."ManualVehicleEvent"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventReadReceipt_userId_eventKey_key" ON "public"."EventReadReceipt"("userId", "eventKey");

-- CreateIndex
CREATE INDEX "EventReadReceipt_companyId_userId_readAt_idx" ON "public"."EventReadReceipt"("companyId", "userId", "readAt");

-- AddForeignKey
ALTER TABLE "public"."ManualVehicleEvent" ADD CONSTRAINT "ManualVehicleEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ManualVehicleEvent" ADD CONSTRAINT "ManualVehicleEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ManualVehicleEvent" ADD CONSTRAINT "ManualVehicleEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventReadReceipt" ADD CONSTRAINT "EventReadReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventReadReceipt" ADD CONSTRAINT "EventReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Validate coordinates and stable event-key length at the database boundary.
ALTER TABLE "public"."ManualVehicleEvent"
ADD CONSTRAINT "ManualVehicleEvent_latitude_check"
CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90)),
ADD CONSTRAINT "ManualVehicleEvent_longitude_check"
CHECK ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180));

ALTER TABLE "public"."EventReadReceipt"
ADD CONSTRAINT "EventReadReceipt_eventKey_length_check"
CHECK (char_length("eventKey") BETWEEN 3 AND 191);
