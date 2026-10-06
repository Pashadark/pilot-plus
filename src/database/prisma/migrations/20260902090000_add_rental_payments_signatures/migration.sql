CREATE TYPE "public"."RentalPaymentKind" AS ENUM ('RENT', 'DEPOSIT');
CREATE TYPE "public"."RentalPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "public"."RentalSignatureParty" AS ENUM ('CLIENT', 'COMPANY');
CREATE TYPE "public"."RentalSignatureStatus" AS ENUM ('MISSING', 'SIGNED', 'REVOKED');

CREATE TABLE "public"."RentalPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "kind" "public"."RentalPaymentKind" NOT NULL,
    "status" "public"."RentalPaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'RUB',
    "method" "public"."RentalPaymentMethod" NOT NULL,
    "reference" TEXT,
    "comment" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "RentalPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RentalPayment_amountMinor_positive_check" CHECK ("amountMinor" > 0)
);

CREATE TABLE "public"."RentalSignature" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "party" "public"."RentalSignatureParty" NOT NULL,
    "status" "public"."RentalSignatureStatus" NOT NULL DEFAULT 'MISSING',
    "signedByName" TEXT,
    "signedAt" TIMESTAMPTZ(3),
    "comment" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "RentalSignature_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RentalSignature_signed_facts_check" CHECK (
      ("status" = 'SIGNED' AND "signedAt" IS NOT NULL AND NULLIF(btrim("signedByName"), '') IS NOT NULL)
      OR ("status" <> 'SIGNED' AND "signedAt" IS NULL)
    )
);

CREATE UNIQUE INDEX "RentalPayment_companyId_rentalId_idempotencyKey_key"
ON "public"."RentalPayment"("companyId", "rentalId", "idempotencyKey");
CREATE INDEX "RentalPayment_companyId_rentalId_kind_status_idx"
ON "public"."RentalPayment"("companyId", "rentalId", "kind", "status");
CREATE INDEX "RentalPayment_recordedByUserId_recordedAt_idx"
ON "public"."RentalPayment"("recordedByUserId", "recordedAt");

CREATE UNIQUE INDEX "RentalSignature_companyId_rentalId_party_key"
ON "public"."RentalSignature"("companyId", "rentalId", "party");
CREATE INDEX "RentalSignature_companyId_rentalId_status_idx"
ON "public"."RentalSignature"("companyId", "rentalId", "status");
CREATE INDEX "RentalSignature_recordedByUserId_updatedAt_idx"
ON "public"."RentalSignature"("recordedByUserId", "updatedAt");

ALTER TABLE "public"."RentalPayment"
ADD CONSTRAINT "RentalPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalPayment"
ADD CONSTRAINT "RentalPayment_companyId_rentalId_fkey" FOREIGN KEY ("companyId", "rentalId") REFERENCES "public"."Rental"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RentalPayment"
ADD CONSTRAINT "RentalPayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."RentalSignature"
ADD CONSTRAINT "RentalSignature_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."RentalSignature"
ADD CONSTRAINT "RentalSignature_companyId_rentalId_fkey" FOREIGN KEY ("companyId", "rentalId") REFERENCES "public"."Rental"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."RentalSignature"
ADD CONSTRAINT "RentalSignature_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
