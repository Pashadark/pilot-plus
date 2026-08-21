CREATE TYPE "public"."RentalOperationType" AS ENUM ('HANDOVER', 'EXTENSION', 'RETURN');
CREATE TYPE "public"."RentalEvidenceStatus" AS ENUM ('COMPLETE', 'VIDEO_MISSING', 'DASHBOARD_PHOTO_MISSING', 'MISSING');
CREATE TYPE "public"."RentalOperationMediaKind" AS ENUM ('INSPECTION_VIDEO', 'DASHBOARD_PHOTO');
CREATE TYPE "public"."RentalOperationMediaStatus" AS ENUM ('PENDING', 'SCANNING', 'CLEAN', 'BLOCKED', 'CLEANING', 'ERROR');
CREATE TYPE "public"."RentalFulfillmentMethod" AS ENUM ('OFFICE', 'DELIVERY');
CREATE TYPE "public"."RentalDepositStatus" AS ENUM ('NOT_COLLECTED', 'COLLECTED', 'RETURNED', 'PARTIALLY_WITHHELD', 'WITHHELD');
CREATE TYPE "public"."RentalPaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');
CREATE TYPE "public"."RentalVehicleCondition" AS ENUM ('GOOD', 'DAMAGE_RECORDED');

CREATE TABLE "public"."RentalOperation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "rentalId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "type" "public"."RentalOperationType" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "evidenceStatus" "public"."RentalEvidenceStatus" NOT NULL,
  "evidenceMissingReason" TEXT,
  "fulfillmentMethod" "public"."RentalFulfillmentMethod",
  "fulfillmentAddress" TEXT,
  "mileageKm" INTEGER,
  "fuelLevelPercent" INTEGER,
  "previousStartsAt" TIMESTAMPTZ(3),
  "previousEndsAt" TIMESTAMPTZ(3),
  "nextStartsAt" TIMESTAMPTZ(3),
  "nextEndsAt" TIMESTAMPTZ(3),
  "previousTotalPriceMinor" BIGINT,
  "nextTotalPriceMinor" BIGINT,
  "extensionChargeMinor" BIGINT,
  "mileageChargeMinor" BIGINT,
  "fuelChargeMinor" BIGINT,
  "totalChargeMinor" BIGINT,
  "depositAmountMinor" BIGINT,
  "depositWithheldMinor" BIGINT,
  "depositStatus" "public"."RentalDepositStatus",
  "depositPaymentMethod" "public"."RentalPaymentMethod",
  "depositResolutionReason" TEXT,
  "vehicleCondition" "public"."RentalVehicleCondition",
  "damageDescription" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RentalOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentalOperation_mileage_non_negative_check" CHECK ("mileageKm" IS NULL OR "mileageKm" >= 0),
  CONSTRAINT "RentalOperation_fuel_range_check" CHECK ("fuelLevelPercent" IS NULL OR "fuelLevelPercent" BETWEEN 0 AND 100),
  CONSTRAINT "RentalOperation_amounts_non_negative_check" CHECK (
    ("previousTotalPriceMinor" IS NULL OR "previousTotalPriceMinor" >= 0) AND
    ("nextTotalPriceMinor" IS NULL OR "nextTotalPriceMinor" >= 0) AND
    ("extensionChargeMinor" IS NULL OR "extensionChargeMinor" >= 0) AND
    ("mileageChargeMinor" IS NULL OR "mileageChargeMinor" >= 0) AND
    ("fuelChargeMinor" IS NULL OR "fuelChargeMinor" >= 0) AND
    ("totalChargeMinor" IS NULL OR "totalChargeMinor" >= 0) AND
    ("depositAmountMinor" IS NULL OR "depositAmountMinor" >= 0) AND
    ("depositWithheldMinor" IS NULL OR "depositWithheldMinor" >= 0)
  ),
  CONSTRAINT "RentalOperation_evidence_reason_check" CHECK (
    "evidenceStatus" = 'COMPLETE' OR NULLIF(btrim("evidenceMissingReason"), '') IS NOT NULL
  ),
  CONSTRAINT "RentalOperation_delivery_address_check" CHECK (
    "fulfillmentMethod" IS DISTINCT FROM 'DELIVERY' OR NULLIF(btrim("fulfillmentAddress"), '') IS NOT NULL
  ),
  CONSTRAINT "RentalOperation_damage_reason_check" CHECK (
    "vehicleCondition" IS DISTINCT FROM 'DAMAGE_RECORDED' OR NULLIF(btrim("damageDescription"), '') IS NOT NULL
  ),
  CONSTRAINT "RentalOperation_deposit_resolution_check" CHECK (
    "depositStatus" NOT IN ('PARTIALLY_WITHHELD', 'WITHHELD') OR NULLIF(btrim("depositResolutionReason"), '') IS NOT NULL
  )
);

CREATE TABLE "public"."RentalOperationMedia" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "kind" "public"."RentalOperationMediaKind" NOT NULL,
  "status" "public"."RentalOperationMediaStatus" NOT NULL DEFAULT 'PENDING',
  "uploadId" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "verifiedMime" TEXT,
  "bytes" INTEGER,
  "sha256" TEXT,
  "quarantineKey" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "scanEngine" TEXT,
  "signatureVersion" TEXT,
  "leaseExpiresAt" TIMESTAMPTZ(3),
  "claimToken" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "promotedAt" TIMESTAMPTZ(3),
  "committedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "RentalOperationMedia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentalOperationMedia_bytes_positive_check" CHECK ("bytes" IS NULL OR "bytes" > 0),
  CONSTRAINT "RentalOperationMedia_retry_non_negative_check" CHECK ("retryCount" >= 0)
);

CREATE UNIQUE INDEX "RentalOperation_companyId_idempotencyKey_key" ON "public"."RentalOperation"("companyId", "idempotencyKey");
CREATE UNIQUE INDEX "RentalOperation_companyId_id_key" ON "public"."RentalOperation"("companyId", "id");
CREATE INDEX "RentalOperation_companyId_rentalId_occurredAt_idx" ON "public"."RentalOperation"("companyId", "rentalId", "occurredAt");
CREATE INDEX "RentalOperation_companyId_vehicleId_occurredAt_idx" ON "public"."RentalOperation"("companyId", "vehicleId", "occurredAt");
CREATE INDEX "RentalOperation_companyId_clientId_occurredAt_idx" ON "public"."RentalOperation"("companyId", "clientId", "occurredAt");
CREATE INDEX "RentalOperation_actorUserId_occurredAt_idx" ON "public"."RentalOperation"("actorUserId", "occurredAt");

CREATE UNIQUE INDEX "RentalOperationMedia_uploadId_key" ON "public"."RentalOperationMedia"("uploadId");
CREATE UNIQUE INDEX "RentalOperationMedia_quarantineKey_key" ON "public"."RentalOperationMedia"("quarantineKey");
CREATE UNIQUE INDEX "RentalOperationMedia_storageKey_key" ON "public"."RentalOperationMedia"("storageKey");
CREATE UNIQUE INDEX "RentalOperationMedia_claimToken_key" ON "public"."RentalOperationMedia"("claimToken");
CREATE UNIQUE INDEX "RentalOperationMedia_operationId_kind_key" ON "public"."RentalOperationMedia"("operationId", "kind");
CREATE INDEX "RentalOperationMedia_companyId_status_leaseExpiresAt_idx" ON "public"."RentalOperationMedia"("companyId", "status", "leaseExpiresAt");
CREATE INDEX "RentalOperationMedia_companyId_operationId_status_idx" ON "public"."RentalOperationMedia"("companyId", "operationId", "status");

ALTER TABLE "public"."RentalOperation" ADD CONSTRAINT "RentalOperation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalOperation" ADD CONSTRAINT "RentalOperation_companyId_rentalId_fkey" FOREIGN KEY ("companyId", "rentalId") REFERENCES "public"."Rental"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalOperation" ADD CONSTRAINT "RentalOperation_companyId_clientId_fkey" FOREIGN KEY ("companyId", "clientId") REFERENCES "public"."Client"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalOperation" ADD CONSTRAINT "RentalOperation_companyId_vehicleId_fkey" FOREIGN KEY ("companyId", "vehicleId") REFERENCES "public"."Vehicle"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalOperation" ADD CONSTRAINT "RentalOperation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalOperationMedia" ADD CONSTRAINT "RentalOperationMedia_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalOperationMedia" ADD CONSTRAINT "RentalOperationMedia_companyId_operationId_fkey" FOREIGN KEY ("companyId", "operationId") REFERENCES "public"."RentalOperation"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "public"."prevent_rental_operation_fact_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Rental operation facts are immutable';
END;
$$;

CREATE TRIGGER "RentalOperation_prevent_fact_mutation"
BEFORE UPDATE ON "public"."RentalOperation"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_rental_operation_fact_mutation"();

CREATE TRIGGER "RentalOperation_prevent_delete"
BEFORE DELETE ON "public"."RentalOperation"
FOR EACH ROW EXECUTE FUNCTION "public"."prevent_rental_operation_fact_mutation"();
