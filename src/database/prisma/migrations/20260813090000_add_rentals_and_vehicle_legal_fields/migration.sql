-- Rental contracts are introduced additively. Existing companies and vehicles remain valid
-- until their legal and rental data is filled through the application workflow.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- AlterTable
ALTER TABLE "public"."Company"
ADD COLUMN "legalName" TEXT,
ADD COLUMN "entrepreneurName" TEXT,
ADD COLUMN "lessorBirthDate" TIMESTAMP(3),
ADD COLUMN "lessorPassportEncrypted" TEXT,
ADD COLUMN "ogrnip" TEXT,
ADD COLUMN "bankName" TEXT,
ADD COLUMN "settlementAccount" TEXT,
ADD COLUMN "correspondentAccount" TEXT,
ADD COLUMN "bik" TEXT,
ADD COLUMN "contractCity" TEXT,
ADD COLUMN "defaultPickupAddress" TEXT,
ADD COLUMN "defaultReturnAddress" TEXT,
ADD COLUMN "signatoryName" TEXT,
ADD COLUMN "signatoryAuthority" TEXT;

-- AlterTable
ALTER TABLE "public"."Vehicle"
ADD COLUMN "registrationNumberNormalized" TEXT,
ADD COLUMN "make" TEXT,
ADD COLUMN "modelName" TEXT,
ADD COLUMN "generation" TEXT,
ADD COLUMN "trim" TEXT,
ADD COLUMN "manufacturedYear" INTEGER,
ADD COLUMN "color" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "bodyType" TEXT,
ADD COLUMN "odometerKm" DECIMAL(12,1),
ADD COLUMN "valueMinor" INTEGER,
ADD COLUMN "depositMinor" INTEGER,
ADD COLUMN "includedMileageKm" INTEGER,
ADD COLUMN "overageMileagePriceMinor" INTEGER,
ADD COLUMN "missingFuelPriceMinor" INTEGER,
ADD COLUMN "registrationCertificateNumber" TEXT,
ADD COLUMN "vehiclePassportNumber" TEXT,
ADD COLUMN "osagoInsurer" TEXT,
ADD COLUMN "osagoPolicyNumber" TEXT,
ADD COLUMN "osagoStartsAt" TIMESTAMP(3),
ADD COLUMN "osagoEndsAt" TIMESTAMP(3),
ADD COLUMN "cascoInsurer" TEXT,
ADD COLUMN "cascoPolicyNumber" TEXT,
ADD COLUMN "cascoStartsAt" TIMESTAMP(3),
ADD COLUMN "cascoEndsAt" TIMESTAMP(3),
ADD COLUMN "isRentalReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rentalReadyAt" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedByUserId" TEXT;

-- CreateEnum
CREATE TYPE "public"."RentalStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."RentalDocumentFormat" AS ENUM ('DOCX', 'PDF');

-- CreateTable
CREATE TABLE "public"."ContractTemplateVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "documentSchemaVersion" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rental" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."RentalStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL,
    "dailyRateMinor" INTEGER NOT NULL,
    "billableDays" INTEGER NOT NULL,
    "basePriceMinor" INTEGER NOT NULL,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "servicesMinor" INTEGER NOT NULL DEFAULT 0,
    "totalPriceMinor" INTEGER NOT NULL,
    "depositMinor" INTEGER,
    "includedMileageKm" INTEGER,
    "overageMileagePriceMinor" INTEGER,
    "missingFuelPriceMinor" INTEGER,
    "priceOverrideReason" TEXT,
    "snapshotVersion" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RentalDriver" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "clientId" TEXT,
    "snapshot" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RentalDocumentVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "format" "public"."RentalDocumentFormat" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "status" "public"."DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
    "clientDocumentVersionId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_companyId_id_key" ON "public"."Vehicle"("companyId", "id");
CREATE UNIQUE INDEX "Vehicle_companyId_registrationNumberNormalized_key" ON "public"."Vehicle"("companyId", "registrationNumberNormalized");
CREATE UNIQUE INDEX "Vehicle_companyId_vin_key" ON "public"."Vehicle"("companyId", "vin");
CREATE INDEX "Vehicle_companyId_archivedAt_idx" ON "public"."Vehicle"("companyId", "archivedAt");
CREATE UNIQUE INDEX "ContractTemplateVersion_companyId_version_key" ON "public"."ContractTemplateVersion"("companyId", "version");
CREATE UNIQUE INDEX "ContractTemplateVersion_companyId_id_key" ON "public"."ContractTemplateVersion"("companyId", "id");
CREATE INDEX "ContractTemplateVersion_companyId_isPublished_publishedAt_idx" ON "public"."ContractTemplateVersion"("companyId", "isPublished", "publishedAt");
CREATE UNIQUE INDEX "Rental_companyId_id_key" ON "public"."Rental"("companyId", "id");
CREATE UNIQUE INDEX "Rental_companyId_contractNumber_key" ON "public"."Rental"("companyId", "contractNumber");
CREATE INDEX "Rental_companyId_status_startsAt_idx" ON "public"."Rental"("companyId", "status", "startsAt");
CREATE INDEX "Rental_companyId_vehicleId_startsAt_idx" ON "public"."Rental"("companyId", "vehicleId", "startsAt");
CREATE INDEX "Rental_companyId_clientId_startsAt_idx" ON "public"."Rental"("companyId", "clientId", "startsAt");
CREATE UNIQUE INDEX "RentalDriver_rentalId_sortOrder_key" ON "public"."RentalDriver"("rentalId", "sortOrder");
CREATE INDEX "RentalDriver_companyId_clientId_idx" ON "public"."RentalDriver"("companyId", "clientId");
CREATE UNIQUE INDEX "RentalDocumentVersion_storageKey_key" ON "public"."RentalDocumentVersion"("storageKey");
CREATE UNIQUE INDEX "RentalDocumentVersion_clientDocumentVersionId_key" ON "public"."RentalDocumentVersion"("clientDocumentVersionId");
CREATE UNIQUE INDEX "RentalDocumentVersion_rentalId_version_format_key" ON "public"."RentalDocumentVersion"("rentalId", "version", "format");
CREATE INDEX "RentalDocumentVersion_companyId_rentalId_status_idx" ON "public"."RentalDocumentVersion"("companyId", "rentalId", "status");

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ContractTemplateVersion" ADD CONSTRAINT "ContractTemplateVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ContractTemplateVersion" ADD CONSTRAINT "ContractTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_clientId_fkey" FOREIGN KEY ("companyId", "clientId") REFERENCES "public"."Client"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_vehicleId_fkey" FOREIGN KEY ("companyId", "vehicleId") REFERENCES "public"."Vehicle"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_companyId_templateVersionId_fkey" FOREIGN KEY ("companyId", "templateVersionId") REFERENCES "public"."ContractTemplateVersion"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."Rental" ADD CONSTRAINT "Rental_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDriver" ADD CONSTRAINT "RentalDriver_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDriver" ADD CONSTRAINT "RentalDriver_companyId_rentalId_fkey" FOREIGN KEY ("companyId", "rentalId") REFERENCES "public"."Rental"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDriver" ADD CONSTRAINT "RentalDriver_companyId_clientId_fkey" FOREIGN KEY ("companyId", "clientId") REFERENCES "public"."Client"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_companyId_rentalId_fkey" FOREIGN KEY ("companyId", "rentalId") REFERENCES "public"."Rental"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_clientDocumentVersionId_fkey" FOREIGN KEY ("clientDocumentVersionId") REFERENCES "public"."ClientDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rental records always represent a forward UTC interval and non-negative minor-unit amounts.
ALTER TABLE "public"."Rental"
ADD CONSTRAINT "Rental_endsAt_after_startsAt_check" CHECK ("endsAt" > "startsAt"),
ADD CONSTRAINT "Rental_non_negative_amounts_check" CHECK (
  "dailyRateMinor" >= 0
  AND "billableDays" > 0
  AND "basePriceMinor" >= 0
  AND "discountMinor" >= 0
  AND "servicesMinor" >= 0
  AND "totalPriceMinor" >= 0
  AND ("depositMinor" IS NULL OR "depositMinor" >= 0)
  AND ("includedMileageKm" IS NULL OR "includedMileageKm" >= 0)
  AND ("overageMileagePriceMinor" IS NULL OR "overageMileagePriceMinor" >= 0)
  AND ("missingFuelPriceMinor" IS NULL OR "missingFuelPriceMinor" >= 0)
);

ALTER TABLE "public"."RentalDocumentVersion"
ADD CONSTRAINT "RentalDocumentVersion_bytes_non_negative_check" CHECK ("bytes" >= 0);

-- The database is the final guard against concurrent confirmation of overlapping vehicle intervals.
ALTER TABLE "public"."Rental"
ADD CONSTRAINT "Rental_vehicle_active_interval_excl"
EXCLUDE USING GIST (
  "companyId" WITH =,
  "vehicleId" WITH =,
  tsrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE ("status" IN ('CONFIRMED', 'ACTIVE'));
