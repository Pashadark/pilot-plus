ALTER TABLE "VehicleDocument"
ADD COLUMN "storageKey" TEXT,
ADD COLUMN "originalName" TEXT,
ADD COLUMN "verifiedMime" TEXT,
ADD COLUMN "sha256" TEXT,
ADD COLUMN "bytes" INTEGER;

CREATE UNIQUE INDEX "VehicleDocument_storageKey_key" ON "VehicleDocument"("storageKey");
