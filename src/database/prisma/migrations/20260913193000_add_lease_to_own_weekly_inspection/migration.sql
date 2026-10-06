CREATE TYPE "public"."RentalAgreementType" AS ENUM ('STANDARD', 'LEASE_TO_OWN');

ALTER TABLE "public"."Rental"
ADD COLUMN "agreementType" "public"."RentalAgreementType" NOT NULL DEFAULT 'STANDARD';

ALTER TYPE "public"."RentalOperationType"
ADD VALUE IF NOT EXISTS 'WEEKLY_INSPECTION';
