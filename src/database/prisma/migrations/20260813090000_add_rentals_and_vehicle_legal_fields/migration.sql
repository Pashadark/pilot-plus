-- Rental contracts are introduced additively. Existing companies and vehicles remain valid
-- until their legal and rental data is filled through the application workflow.
-- Prisma runs this migration in a transaction. The lock timeout fails rather than silently
-- waiting on a busy legacy Vehicle table; schedule deployment during a low-write window.
SET LOCAL lock_timeout = '5s';

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- AlterTable
ALTER TABLE "public"."Company"
ADD COLUMN "legalName" TEXT,
ADD COLUMN "entrepreneurName" TEXT,
ADD COLUMN "lessorBirthDate" DATE,
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
ADD COLUMN "valueMinor" BIGINT,
ADD COLUMN "depositMinor" BIGINT,
ADD COLUMN "includedMileageKm" INTEGER,
ADD COLUMN "overageMileagePriceMinor" BIGINT,
ADD COLUMN "missingFuelPriceMinor" BIGINT,
ADD COLUMN "registrationCertificateNumber" TEXT,
ADD COLUMN "vehiclePassportNumber" TEXT,
ADD COLUMN "osagoInsurer" TEXT,
ADD COLUMN "osagoPolicyNumber" TEXT,
ADD COLUMN "osagoStartsAt" DATE,
ADD COLUMN "osagoEndsAt" DATE,
ADD COLUMN "cascoInsurer" TEXT,
ADD COLUMN "cascoPolicyNumber" TEXT,
ADD COLUMN "cascoStartsAt" DATE,
ADD COLUMN "cascoEndsAt" DATE,
ADD COLUMN "isRentalReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rentalReadyAt" TIMESTAMPTZ(3),
ADD COLUMN "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN "archivedByUserId" TEXT;

-- Compatibility invariant: legacy writers may still send only registrationNumber.
CREATE FUNCTION "public"."normalize_vehicle_registration_number"(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT NULLIF(regexp_replace(upper(value), '[^0-9A-ZА-ЯЁ]', '', 'g'), '');
$$;

CREATE FUNCTION "public"."set_vehicle_registration_number_normalized"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."registrationNumberNormalized" := "public"."normalize_vehicle_registration_number"(NEW."registrationNumber");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Vehicle_normalize_registration_number"
BEFORE INSERT OR UPDATE OF "registrationNumber" ON "public"."Vehicle"
FOR EACH ROW EXECUTE FUNCTION "public"."set_vehicle_registration_number_normalized"();

-- Backfill is deterministic and does not invent a resolution for duplicate legacy records.
UPDATE "public"."Vehicle"
SET "registrationNumberNormalized" = "public"."normalize_vehicle_registration_number"("registrationNumber")
WHERE "registrationNumberNormalized" IS DISTINCT FROM "public"."normalize_vehicle_registration_number"("registrationNumber");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."Vehicle"
    WHERE "registrationNumberNormalized" IS NOT NULL
    GROUP BY "companyId", "registrationNumberNormalized"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add vehicle plate uniqueness: duplicate normalized registration numbers exist. Resolve duplicates explicitly before retrying; this migration does not alter legacy records.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "public"."Vehicle"
    WHERE NULLIF(btrim("vin"), '') IS NOT NULL
    GROUP BY "companyId", upper(btrim("vin"))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add vehicle VIN uniqueness: duplicate VIN values exist. Resolve duplicates explicitly before retrying; this migration does not alter legacy records.';
  END IF;
END;
$$;

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
    "publishedAt" TIMESTAMPTZ(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContractTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rental" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "public"."RentalStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL,
    "dailyRateMinor" BIGINT NOT NULL,
    "billableDays" INTEGER NOT NULL,
    "basePriceMinor" BIGINT NOT NULL,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "servicesMinor" BIGINT NOT NULL DEFAULT 0,
    "totalPriceMinor" BIGINT NOT NULL,
    "depositMinor" BIGINT,
    "includedMileageKm" INTEGER,
    "overageMileagePriceMinor" BIGINT,
    "missingFuelPriceMinor" BIGINT,
    "priceOverrideReason" TEXT,
    "snapshotVersion" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "activatedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

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
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RentalDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RentalDocumentVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "clientDocumentId" TEXT NOT NULL,
    "clientDocumentVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "format" "public"."RentalDocumentFormat" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RentalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex. These standard unique indexes are deliberate: CREATE INDEX CONCURRENTLY cannot
-- run in Prisma's transactional migration. lock_timeout above makes contention fail fast.
CREATE UNIQUE INDEX "Vehicle_companyId_id_key" ON "public"."Vehicle"("companyId", "id");
CREATE UNIQUE INDEX "Vehicle_companyId_registrationNumberNormalized_key" ON "public"."Vehicle"("companyId", "registrationNumberNormalized");
CREATE UNIQUE INDEX "Vehicle_companyId_vin_key" ON "public"."Vehicle"("companyId", "vin");
CREATE INDEX "Vehicle_companyId_archivedAt_idx" ON "public"."Vehicle"("companyId", "archivedAt");
CREATE UNIQUE INDEX "ClientDocument_companyId_clientId_id_key" ON "public"."ClientDocument"("companyId", "clientId", "id");
CREATE UNIQUE INDEX "ClientDocumentVersion_documentId_id_key" ON "public"."ClientDocumentVersion"("documentId", "id");
CREATE UNIQUE INDEX "ContractTemplateVersion_companyId_version_key" ON "public"."ContractTemplateVersion"("companyId", "version");
CREATE UNIQUE INDEX "ContractTemplateVersion_companyId_id_key" ON "public"."ContractTemplateVersion"("companyId", "id");
CREATE INDEX "ContractTemplateVersion_companyId_isPublished_publishedAt_idx" ON "public"."ContractTemplateVersion"("companyId", "isPublished", "publishedAt");
CREATE UNIQUE INDEX "Rental_companyId_id_key" ON "public"."Rental"("companyId", "id");
CREATE UNIQUE INDEX "Rental_companyId_clientId_id_key" ON "public"."Rental"("companyId", "clientId", "id");
CREATE UNIQUE INDEX "Rental_companyId_contractNumber_key" ON "public"."Rental"("companyId", "contractNumber");
CREATE INDEX "Rental_companyId_status_startsAt_idx" ON "public"."Rental"("companyId", "status", "startsAt");
CREATE INDEX "Rental_companyId_vehicleId_startsAt_idx" ON "public"."Rental"("companyId", "vehicleId", "startsAt");
CREATE INDEX "Rental_companyId_clientId_startsAt_idx" ON "public"."Rental"("companyId", "clientId", "startsAt");
CREATE UNIQUE INDEX "RentalDriver_rentalId_sortOrder_key" ON "public"."RentalDriver"("rentalId", "sortOrder");
CREATE INDEX "RentalDriver_companyId_clientId_idx" ON "public"."RentalDriver"("companyId", "clientId");
CREATE UNIQUE INDEX "RentalDocumentVersion_rentalId_version_format_key" ON "public"."RentalDocumentVersion"("rentalId", "version", "format");
CREATE INDEX "RentalDocumentVersion_companyId_clientId_rentalId_idx" ON "public"."RentalDocumentVersion"("companyId", "clientId", "rentalId");

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
ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_companyId_clientId_rentalId_fkey" FOREIGN KEY ("companyId", "clientId", "rentalId") REFERENCES "public"."Rental"("companyId", "clientId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_companyId_clientId_clientDocumentId_fkey" FOREIGN KEY ("companyId", "clientId", "clientDocumentId") REFERENCES "public"."ClientDocument"("companyId", "clientId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalDocumentVersion" ADD CONSTRAINT "RentalDocumentVersion_clientDocumentId_clientDocumentVersionId_fkey" FOREIGN KEY ("clientDocumentId", "clientDocumentVersionId") REFERENCES "public"."ClientDocumentVersion"("documentId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rental records always represent a forward UTC interval and non-negative minor-unit amounts.
ALTER TABLE "public"."Rental"
ADD CONSTRAINT "Rental_endsAt_after_startsAt_check" CHECK ("endsAt" > "startsAt"),
ADD CONSTRAINT "Rental_snapshotVersion_positive_check" CHECK ("snapshotVersion" > 0),
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
),
ADD CONSTRAINT "Rental_calculation_check" CHECK (
  "priceOverrideReason" IS NOT NULL
  OR "totalPriceMinor" = "basePriceMinor" - "discountMinor" + "servicesMinor"
),
ADD CONSTRAINT "Rental_lifecycle_check" CHECK (
  ("status" = 'DRAFT' AND "contractNumber" IS NULL AND "confirmedAt" IS NULL AND "activatedAt" IS NULL AND "completedAt" IS NULL AND "cancelledAt" IS NULL)
  OR ("status" = 'CONFIRMED' AND "contractNumber" IS NOT NULL AND "confirmedAt" IS NOT NULL AND "activatedAt" IS NULL AND "completedAt" IS NULL AND "cancelledAt" IS NULL)
  OR ("status" = 'ACTIVE' AND "contractNumber" IS NOT NULL AND "confirmedAt" IS NOT NULL AND "activatedAt" IS NOT NULL AND "completedAt" IS NULL AND "cancelledAt" IS NULL)
  OR ("status" = 'COMPLETED' AND "contractNumber" IS NOT NULL AND "confirmedAt" IS NOT NULL AND "activatedAt" IS NOT NULL AND "completedAt" IS NOT NULL AND "cancelledAt" IS NULL)
  OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "completedAt" IS NULL AND ("activatedAt" IS NULL OR "confirmedAt" IS NOT NULL))
);

ALTER TABLE "public"."RentalDriver"
ADD CONSTRAINT "RentalDriver_sortOrder_non_negative_check" CHECK ("sortOrder" >= 0);

ALTER TABLE "public"."ContractTemplateVersion"
ADD CONSTRAINT "ContractTemplateVersion_version_positive_check" CHECK ("version" > 0 AND "documentSchemaVersion" > 0),
ADD CONSTRAINT "ContractTemplateVersion_publishedAt_check" CHECK (
  ("isPublished" AND "publishedAt" IS NOT NULL)
  OR (NOT "isPublished" AND "publishedAt" IS NULL)
);

ALTER TABLE "public"."RentalDocumentVersion"
ADD CONSTRAINT "RentalDocumentVersion_version_positive_check" CHECK ("version" > 0);

CREATE FUNCTION "public"."assert_rental_document_contract_category"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "public"."ClientDocument"
    WHERE "id" = NEW."clientDocumentId"
      AND "companyId" = NEW."companyId"
      AND "clientId" = NEW."clientId"
      AND "category" = 'CONTRACT'
  ) THEN
    RAISE EXCEPTION 'Rental document must reference a CONTRACT client document owned by the rental company and client.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "RentalDocumentVersion_contract_category_check"
BEFORE INSERT OR UPDATE OF "companyId", "clientId", "clientDocumentId" ON "public"."RentalDocumentVersion"
FOR EACH ROW EXECUTE FUNCTION "public"."assert_rental_document_contract_category"();

CREATE FUNCTION "public"."assert_rental_document_format_matches_client_version"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "public"."ClientDocumentVersion" AS version
    WHERE version."id" = NEW."clientDocumentVersionId"
      AND version."documentId" = NEW."clientDocumentId"
      AND (
        (NEW."format" = 'DOCX' AND version."verifiedMime" = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        OR (NEW."format" = 'PDF' AND version."verifiedMime" = 'application/pdf')
      )
  ) THEN
    RAISE EXCEPTION 'Rental document format must match the verified private client-document version.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "RentalDocumentVersion_format_matches_client_version_check"
BEFORE INSERT OR UPDATE OF "format", "clientDocumentId", "clientDocumentVersionId" ON "public"."RentalDocumentVersion"
FOR EACH ROW EXECUTE FUNCTION "public"."assert_rental_document_format_matches_client_version"();

-- The database is the final guard against concurrent confirmation of overlapping vehicle intervals.
ALTER TABLE "public"."Rental"
ADD CONSTRAINT "Rental_vehicle_active_interval_excl"
EXCLUDE USING GIST (
  "companyId" WITH =,
  "vehicleId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE ("status" IN ('CONFIRMED', 'ACTIVE'));
