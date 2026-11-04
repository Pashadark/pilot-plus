CREATE TYPE "public"."DepositLedgerEntryKind" AS ENUM (
  'DEPOSIT_PAYMENT',
  'MANUAL_CREDIT',
  'FINE_RESERVATION',
  'FINE_RESERVATION_ADJUSTMENT',
  'FINE_RESERVATION_RELEASE',
  'FINE_WITHHOLDING',
  'DEPOSIT_RETURN',
  'DEBT_PAYMENT',
  'MANUAL_CORRECTION'
);

CREATE TYPE "public"."DepositLedgerEntrySource" AS ENUM ('AUTOMATIC', 'STAFF', 'MIGRATION');

CREATE TABLE "public"."DepositLedgerEntry" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "rentalId" TEXT NOT NULL,
  "fineId" TEXT,
  "paymentId" TEXT,
  "operationId" TEXT,
  "reversalOfId" TEXT,
  "kind" "public"."DepositLedgerEntryKind" NOT NULL,
  "source" "public"."DepositLedgerEntrySource" NOT NULL,
  "cashDeltaMinor" BIGINT NOT NULL DEFAULT 0,
  "reservedDeltaMinor" BIGINT NOT NULL DEFAULT 0,
  "withheldDeltaMinor" BIGINT NOT NULL DEFAULT 0,
  "debtDeltaMinor" BIGINT NOT NULL DEFAULT 0,
  "commissionBasisPoints" INTEGER,
  "reason" TEXT,
  "metadata" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "actorUserId" TEXT,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DepositLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DepositLedgerEntry_has_non_zero_delta_check" CHECK (
    "cashDeltaMinor" <> 0 OR
    "reservedDeltaMinor" <> 0 OR
    "withheldDeltaMinor" <> 0 OR
    "debtDeltaMinor" <> 0
  ),
  CONSTRAINT "DepositLedgerEntry_commission_basis_points_check" CHECK (
    "commissionBasisPoints" IS NULL OR
    ("commissionBasisPoints" >= 0 AND "commissionBasisPoints" <= 10000)
  ),
  CONSTRAINT "DepositLedgerEntry_staff_reason_check" CHECK (
    "source" <> 'STAFF' OR LENGTH(BTRIM(COALESCE("reason", ''))) > 0
  )
);

CREATE UNIQUE INDEX "DepositLedgerEntry_companyId_idempotencyKey_key"
  ON "public"."DepositLedgerEntry"("companyId", "idempotencyKey");
CREATE INDEX "DepositLedgerEntry_companyId_rentalId_occurredAt_idx"
  ON "public"."DepositLedgerEntry"("companyId", "rentalId", "occurredAt");
CREATE INDEX "DepositLedgerEntry_companyId_clientId_occurredAt_idx"
  ON "public"."DepositLedgerEntry"("companyId", "clientId", "occurredAt");
CREATE INDEX "DepositLedgerEntry_companyId_fineId_occurredAt_idx"
  ON "public"."DepositLedgerEntry"("companyId", "fineId", "occurredAt");
CREATE INDEX "DepositLedgerEntry_paymentId_idx" ON "public"."DepositLedgerEntry"("paymentId");
CREATE INDEX "DepositLedgerEntry_operationId_idx" ON "public"."DepositLedgerEntry"("operationId");
CREATE INDEX "DepositLedgerEntry_reversalOfId_idx" ON "public"."DepositLedgerEntry"("reversalOfId");
CREATE INDEX "DepositLedgerEntry_actorUserId_occurredAt_idx"
  ON "public"."DepositLedgerEntry"("actorUserId", "occurredAt");

ALTER TABLE "public"."DepositLedgerEntry"
  ADD CONSTRAINT "DepositLedgerEntry_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DepositLedgerEntry_companyId_clientId_fkey"
  FOREIGN KEY ("companyId", "clientId") REFERENCES "public"."Client"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DepositLedgerEntry_companyId_rentalId_fkey"
  FOREIGN KEY ("companyId", "rentalId") REFERENCES "public"."Rental"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DepositLedgerEntry_companyId_fineId_fkey"
  FOREIGN KEY ("companyId", "fineId") REFERENCES "public"."Fine"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DepositLedgerEntry_companyId_paymentId_fkey"
  FOREIGN KEY ("companyId", "paymentId") REFERENCES "public"."RentalPayment"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DepositLedgerEntry_companyId_operationId_fkey"
  FOREIGN KEY ("companyId", "operationId") REFERENCES "public"."RentalOperation"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DepositLedgerEntry_reversalOfId_fkey"
  FOREIGN KEY ("reversalOfId") REFERENCES "public"."DepositLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DepositLedgerEntry_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "public"."DepositLedgerEntry" (
  "id", "companyId", "clientId", "rentalId", "paymentId", "kind", "source",
  "cashDeltaMinor", "idempotencyKey", "actorUserId", "occurredAt"
)
SELECT
  'dpl_' || MD5(rp."id"),
  rp."companyId",
  r."clientId",
  rp."rentalId",
  rp."id",
  'DEPOSIT_PAYMENT'::"public"."DepositLedgerEntryKind",
  'MIGRATION'::"public"."DepositLedgerEntrySource",
  rp."amountMinor",
  'backfill:deposit-payment:' || rp."id",
  rp."recordedByUserId",
  rp."recordedAt"
FROM "public"."RentalPayment" rp
JOIN "public"."Rental" r
  ON r."companyId" = rp."companyId" AND r."id" = rp."rentalId"
WHERE rp."kind" = 'DEPOSIT' AND rp."status" = 'CONFIRMED' AND rp."amountMinor" > 0;

INSERT INTO "public"."DepositLedgerEntry" (
  "id", "companyId", "clientId", "rentalId", "operationId", "kind", "source",
  "cashDeltaMinor", "withheldDeltaMinor", "idempotencyKey", "actorUserId", "reason", "occurredAt"
)
SELECT
  'dlr_' || MD5(ro."id"),
  ro."companyId",
  ro."clientId",
  ro."rentalId",
  ro."id",
  'DEPOSIT_RETURN'::"public"."DepositLedgerEntryKind",
  'MIGRATION'::"public"."DepositLedgerEntrySource",
  -GREATEST(COALESCE(ro."depositAmountMinor", 0) - COALESCE(ro."depositWithheldMinor", 0), 0),
  GREATEST(COALESCE(ro."depositWithheldMinor", 0), 0),
  'backfill:deposit-return:' || ro."id",
  ro."actorUserId",
  ro."depositResolutionReason",
  ro."occurredAt"
FROM "public"."RentalOperation" ro
WHERE ro."type" = 'DEPOSIT_RETURN'
  AND ro."status" = 'COMMITTED'
  AND (
    COALESCE(ro."depositAmountMinor", 0) - COALESCE(ro."depositWithheldMinor", 0) > 0 OR
    COALESCE(ro."depositWithheldMinor", 0) > 0
  );
