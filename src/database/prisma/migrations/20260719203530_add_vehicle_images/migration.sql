-- CreateTable
CREATE TABLE "public"."VehicleImage" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleImage_vehicleId_isPrimary_idx" ON "public"."VehicleImage"("vehicleId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleImage_vehicleId_position_key" ON "public"."VehicleImage"("vehicleId", "position");

-- AddForeignKey
ALTER TABLE "public"."VehicleImage" ADD CONSTRAINT "VehicleImage_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
