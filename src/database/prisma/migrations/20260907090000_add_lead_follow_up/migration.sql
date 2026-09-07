ALTER TABLE "public"."Lead"
ADD COLUMN "lastName" TEXT,
ADD COLUMN "nextContactAt" TIMESTAMP(3) WITH TIME ZONE;

CREATE INDEX "Lead_companyId_status_nextContactAt_idx"
ON "public"."Lead"("companyId", "status", "nextContactAt");
