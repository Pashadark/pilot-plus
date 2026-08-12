-- Additive durable accounting and worker ownership fields keep rolling deploys compatible.
ALTER TABLE "public"."Client"
ADD COLUMN "photoBytes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "public"."ClientPhotoUpload"
ADD COLUMN "sourceBytes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "finalBytes" INTEGER,
ADD COLUMN "previousPhotoBytes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ledgerCommittedBytes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "claimToken" TEXT;

CREATE UNIQUE INDEX "ClientPhotoUpload_claimToken_key"
ON "public"."ClientPhotoUpload"("claimToken");

ALTER TABLE "public"."ClientDocumentVersion"
ADD COLUMN "claimToken" TEXT,
ADD COLUMN "ledgerCommittedBytes" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "ClientDocumentVersion_claimToken_key"
ON "public"."ClientDocumentVersion"("claimToken");

CREATE TABLE "public"."ClientStorageLedger" (
  "companyId" TEXT NOT NULL,
  "committedBytes" BIGINT NOT NULL DEFAULT 0,
  "reservedBytes" BIGINT NOT NULL DEFAULT 0,
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientStorageLedger_pkey" PRIMARY KEY ("companyId")
);

ALTER TABLE "public"."ClientStorageLedger"
ADD CONSTRAINT "ClientStorageLedger_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exact document sizes are already durable, so initialize their committed accounting.
UPDATE "public"."ClientDocumentVersion"
SET "ledgerCommittedBytes" = "bytes"
WHERE "scanVerdict" = 'CLEAN' AND "storageDeletedAt" IS NULL;

INSERT INTO "public"."ClientStorageLedger"
  ("companyId", "committedBytes", "reservedBytes", "reconciledAt", "updatedAt")
SELECT
  company."id",
  COALESCE(document_usage."bytes", 0),
  COALESCE(active_permits."bytes", 0),
  NULL,
  CURRENT_TIMESTAMP
FROM "public"."Company" AS company
LEFT JOIN (
  SELECT document."companyId", SUM(version."ledgerCommittedBytes")::BIGINT AS "bytes"
  FROM "public"."ClientDocumentVersion" AS version
  INNER JOIN "public"."ClientDocument" AS document ON document."id" = version."documentId"
  GROUP BY document."companyId"
) AS document_usage ON document_usage."companyId" = company."id"
LEFT JOIN (
  SELECT "companyId", SUM("reservedBytes")::BIGINT AS "bytes"
  FROM "public"."ClientUploadPermit"
  WHERE "status" IN ('ACTIVE', 'RECONCILING')
  GROUP BY "companyId"
) AS active_permits ON active_permits."companyId" = company."id";
