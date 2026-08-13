-- Additive confirmation provenance for immutable rental legal snapshots.
ALTER TYPE "public"."AuditEntityType" ADD VALUE IF NOT EXISTS 'RENTAL';

ALTER TABLE "public"."Rental" ADD COLUMN "confirmedByUserId" TEXT;

CREATE INDEX "Rental_companyId_confirmedByUserId_confirmedAt_idx"
ON "public"."Rental"("companyId", "confirmedByUserId", "confirmedAt");

ALTER TABLE "public"."Rental"
ADD CONSTRAINT "Rental_confirmedByUserId_fkey"
FOREIGN KEY ("confirmedByUserId") REFERENCES "public"."User"("id")
ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
