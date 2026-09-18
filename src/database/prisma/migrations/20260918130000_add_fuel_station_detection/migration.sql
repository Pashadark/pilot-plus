CREATE TABLE "FuelStation" (
  "id" TEXT NOT NULL,
  "osmType" TEXT NOT NULL,
  "osmId" TEXT NOT NULL,
  "name" TEXT,
  "brand" TEXT,
  "address" TEXT,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'OPENSTREETMAP',
  "attribution" TEXT NOT NULL DEFAULT '© OpenStreetMap contributors',
  "sourceUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FuelStation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FuelStationVisit" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "stationId" TEXT NOT NULL,
  "enteredAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "exitedAt" TIMESTAMP(3),
  "notifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FuelStationVisit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FuelStation_osmType_osmId_key" ON "FuelStation"("osmType", "osmId");
CREATE INDEX "FuelStation_latitude_longitude_idx" ON "FuelStation"("latitude", "longitude");
CREATE INDEX "FuelStationVisit_vehicleId_exitedAt_lastSeenAt_idx" ON "FuelStationVisit"("vehicleId", "exitedAt", "lastSeenAt");
CREATE INDEX "FuelStationVisit_stationId_enteredAt_idx" ON "FuelStationVisit"("stationId", "enteredAt");
CREATE UNIQUE INDEX "FuelStationVisit_vehicleId_stationId_enteredAt_key" ON "FuelStationVisit"("vehicleId", "stationId", "enteredAt");
CREATE INDEX "FuelStationVisit_active_vehicle_idx" ON "FuelStationVisit"("vehicleId") WHERE "exitedAt" IS NULL;
ALTER TABLE "FuelStationVisit" ADD CONSTRAINT "FuelStationVisit_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelStationVisit" ADD CONSTRAINT "FuelStationVisit_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "FuelStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
