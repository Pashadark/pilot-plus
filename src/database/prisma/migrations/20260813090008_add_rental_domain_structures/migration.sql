CREATE EXTENSION IF NOT EXISTS btree_gist;

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

    CONSTRAINT "RentalDocumentVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RentalDocumentVersion_clientDocumentVersionId_key" UNIQUE ("clientDocumentVersionId"),
    CONSTRAINT "RentalDocumentVersion_clientDocumentId_clientDocumentVersionId_key" UNIQUE ("clientDocumentId", "clientDocumentVersionId")
);

-- Indexes for these new empty tables are ordinary transactional indexes. Legacy-table indexes
-- were built one-at-a-time by the preceding concurrent migration sequence.
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
CREATE UNIQUE INDEX "RentalDocumentVersion_clientDocumentVersionId_key" ON "public"."RentalDocumentVersion"("clientDocumentVersionId");
CREATE UNIQUE INDEX "RentalDocumentVersion_clientDocumentId_clientDocumentVersionId_key" ON "public"."RentalDocumentVersion"("clientDocumentId", "clientDocumentVersionId");
CREATE INDEX "RentalDocumentVersion_companyId_clientId_rentalId_idx" ON "public"."RentalDocumentVersion"("companyId", "clientId", "rentalId");

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
  NULLIF(btrim("priceOverrideReason"), '') IS NOT NULL
  OR (
    "dailyRateMinor"::numeric * "billableDays"::numeric = "basePriceMinor"::numeric
    AND "totalPriceMinor"::numeric = "basePriceMinor"::numeric - "discountMinor"::numeric + "servicesMinor"::numeric
  )
),
ADD CONSTRAINT "Rental_lifecycle_check" CHECK (
  ("status" = 'DRAFT' AND "contractNumber" IS NULL AND "confirmedAt" IS NULL AND "activatedAt" IS NULL AND "completedAt" IS NULL AND "cancelledAt" IS NULL)
  OR ("status" = 'CONFIRMED' AND "contractNumber" IS NOT NULL AND "confirmedAt" IS NOT NULL AND "confirmedAt" >= "createdAt" AND "activatedAt" IS NULL AND "completedAt" IS NULL AND "cancelledAt" IS NULL)
  OR ("status" = 'ACTIVE' AND "contractNumber" IS NOT NULL AND "confirmedAt" IS NOT NULL AND "confirmedAt" >= "createdAt" AND "activatedAt" IS NOT NULL AND "activatedAt" >= "confirmedAt" AND "completedAt" IS NULL AND "cancelledAt" IS NULL)
  OR ("status" = 'COMPLETED' AND "contractNumber" IS NOT NULL AND "confirmedAt" IS NOT NULL AND "confirmedAt" >= "createdAt" AND "activatedAt" IS NOT NULL AND "activatedAt" >= "confirmedAt" AND "completedAt" IS NOT NULL AND "completedAt" >= "activatedAt" AND "cancelledAt" IS NULL)
  OR (
    "status" = 'CANCELLED'
    AND "cancelledAt" IS NOT NULL
    AND "completedAt" IS NULL
    AND (
      ("confirmedAt" IS NULL AND "contractNumber" IS NULL AND "activatedAt" IS NULL AND "cancelledAt" >= "createdAt")
      OR (
        "confirmedAt" IS NOT NULL
        AND "contractNumber" IS NOT NULL
        AND "confirmedAt" >= "createdAt"
        AND ("activatedAt" IS NULL OR "activatedAt" >= "confirmedAt")
        AND "cancelledAt" >= COALESCE("activatedAt", "confirmedAt")
      )
    )
  )
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

-- Published templates are immutable history. Corrections require a new version.
CREATE FUNCTION "public"."prevent_published_contract_template_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."isPublished" THEN
    RAISE EXCEPTION 'Published contract template versions are immutable; create a new version.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "ContractTemplateVersion_prevent_published_mutation"
BEFORE UPDATE OR DELETE ON "public"."ContractTemplateVersion"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_published_contract_template_mutation"();

-- A confirmed legal snapshot retains its parties, vehicle, interval, template and number. The
-- lifecycle itself remains movable only along the explicitly allowed forward/cancellation paths.
CREATE FUNCTION "public"."prevent_rental_legal_snapshot_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'CONFIRMED', 'CANCELLED'))
    OR (OLD."status" = 'CONFIRMED' AND NEW."status" IN ('CONFIRMED', 'ACTIVE', 'CANCELLED'))
    OR (OLD."status" = 'ACTIVE' AND NEW."status" IN ('ACTIVE', 'COMPLETED', 'CANCELLED'))
    OR (OLD."status" = 'COMPLETED' AND NEW."status" = 'COMPLETED')
    OR (OLD."status" = 'CANCELLED' AND NEW."status" = 'CANCELLED')
  ) THEN
    RAISE EXCEPTION 'Invalid rental lifecycle transition from % to %.', OLD."status", NEW."status";
  END IF;

  IF OLD."confirmedAt" IS NOT NULL AND (
    NEW."companyId" IS DISTINCT FROM OLD."companyId"
    OR NEW."clientId" IS DISTINCT FROM OLD."clientId"
    OR NEW."vehicleId" IS DISTINCT FROM OLD."vehicleId"
    OR NEW."startsAt" IS DISTINCT FROM OLD."startsAt"
    OR NEW."endsAt" IS DISTINCT FROM OLD."endsAt"
    OR NEW."contractNumber" IS DISTINCT FROM OLD."contractNumber"
    OR NEW."snapshotVersion" IS DISTINCT FROM OLD."snapshotVersion"
    OR NEW."snapshot" IS DISTINCT FROM OLD."snapshot"
    OR NEW."templateVersionId" IS DISTINCT FROM OLD."templateVersionId"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."dailyRateMinor" IS DISTINCT FROM OLD."dailyRateMinor"
    OR NEW."billableDays" IS DISTINCT FROM OLD."billableDays"
    OR NEW."basePriceMinor" IS DISTINCT FROM OLD."basePriceMinor"
    OR NEW."discountMinor" IS DISTINCT FROM OLD."discountMinor"
    OR NEW."servicesMinor" IS DISTINCT FROM OLD."servicesMinor"
    OR NEW."totalPriceMinor" IS DISTINCT FROM OLD."totalPriceMinor"
    OR NEW."depositMinor" IS DISTINCT FROM OLD."depositMinor"
    OR NEW."includedMileageKm" IS DISTINCT FROM OLD."includedMileageKm"
    OR NEW."overageMileagePriceMinor" IS DISTINCT FROM OLD."overageMileagePriceMinor"
    OR NEW."missingFuelPriceMinor" IS DISTINCT FROM OLD."missingFuelPriceMinor"
    OR NEW."priceOverrideReason" IS DISTINCT FROM OLD."priceOverrideReason"
  ) THEN
    RAISE EXCEPTION 'Confirmed rental legal snapshot fields are immutable.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Rental_prevent_legal_snapshot_mutation"
BEFORE UPDATE ON "public"."Rental"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_rental_legal_snapshot_mutation"();

-- Do not allow later edits to the source document to invalidate a legal rental-document link.
CREATE FUNCTION "public"."prevent_rental_document_category_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."category" <> 'CONTRACT' AND EXISTS (
    SELECT 1 FROM "public"."RentalDocumentVersion"
    WHERE "clientDocumentId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'A client document referenced by a rental must remain in CONTRACT category.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ClientDocument_prevent_rental_category_mutation"
BEFORE UPDATE OF "category" ON "public"."ClientDocument"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_rental_document_category_mutation"();

CREATE FUNCTION "public"."prevent_rental_document_mime_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."RentalDocumentVersion" AS rental_document
    WHERE rental_document."clientDocumentVersionId" = OLD."id"
      AND (
        (rental_document."format" = 'DOCX' AND NEW."verifiedMime" IS DISTINCT FROM 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        OR (rental_document."format" = 'PDF' AND NEW."verifiedMime" IS DISTINCT FROM 'application/pdf')
      )
  ) THEN
    RAISE EXCEPTION 'A verified MIME type referenced by a rental document cannot be changed incompatibly.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ClientDocumentVersion_prevent_rental_mime_mutation"
BEFORE UPDATE OF "verifiedMime" ON "public"."ClientDocumentVersion"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_rental_document_mime_mutation"();
