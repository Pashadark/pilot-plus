-- Nullable lease keeps rolling deploys compatible with the previous application version.
ALTER TABLE "public"."ClientDocumentVersion"
ADD COLUMN "scanLeaseExpiresAt" TIMESTAMP(3);

CREATE INDEX "ClientDocumentVersion_scanVerdict_scanLeaseExpiresAt_idx"
ON "public"."ClientDocumentVersion"("scanVerdict", "scanLeaseExpiresAt");
