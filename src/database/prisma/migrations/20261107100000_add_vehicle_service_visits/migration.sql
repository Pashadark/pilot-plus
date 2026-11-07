-- CreateTable
CREATE TABLE "VehicleServiceVisit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    "lastInsideAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,
    "confirmedAt" TIMESTAMP(3) WITH TIME ZONE,
    "exitedAt" TIMESTAMP(3) WITH TIME ZONE,
    "notificationQueuedAt" TIMESTAMP(3) WITH TIME ZONE,
    "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL,

    CONSTRAINT "VehicleServiceVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleServiceVisit_companyId_id_key" ON "VehicleServiceVisit"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleServiceVisit_one_active_per_vehicle" ON "VehicleServiceVisit"("vehicleId") WHERE "exitedAt" IS NULL;

-- CreateIndex
CREATE INDEX "VehicleServiceVisit_companyId_confirmedAt_exitedAt_idx" ON "VehicleServiceVisit"("companyId", "confirmedAt", "exitedAt");

-- CreateIndex
CREATE INDEX "VehicleServiceVisit_vehicleId_enteredAt_idx" ON "VehicleServiceVisit"("vehicleId", "enteredAt");

-- AddForeignKey
ALTER TABLE "VehicleServiceVisit" ADD CONSTRAINT "VehicleServiceVisit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleServiceVisit" ADD CONSTRAINT "VehicleServiceVisit_companyId_vehicleId_fkey" FOREIGN KEY ("companyId", "vehicleId") REFERENCES "Vehicle"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
