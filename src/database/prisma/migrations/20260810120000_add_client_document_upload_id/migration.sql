ALTER TABLE "public"."ClientDocumentVersion"
ADD COLUMN "uploadId" TEXT;

CREATE UNIQUE INDEX "ClientDocumentVersion_uploadId_key" ON "public"."ClientDocumentVersion"("uploadId");

COMMENT ON COLUMN "public"."ClientDocumentVersion"."uploadId" IS
'Nullable during the rolling Task 3 rollout. New code dual-writes uploadId; backfill and NOT NULL require a later migration after every application instance is upgraded.';
