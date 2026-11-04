-- Add optional derived WebP preview metadata while preserving canonical originals.
ALTER TABLE "ClientDocumentVersion"
ADD COLUMN "previewStorageKey" TEXT,
ADD COLUMN "previewMime" TEXT,
ADD COLUMN "previewBytes" INTEGER,
ADD COLUMN "previewSha256" TEXT,
ADD COLUMN "previewGeneratedAt" TIMESTAMP(3);

ALTER TABLE "RentalOperationMedia"
ADD COLUMN "previewStorageKey" TEXT,
ADD COLUMN "previewMime" TEXT,
ADD COLUMN "previewBytes" INTEGER,
ADD COLUMN "previewSha256" TEXT,
ADD COLUMN "previewGeneratedAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "ClientDocumentVersion_previewStorageKey_key"
ON "ClientDocumentVersion"("previewStorageKey");

CREATE UNIQUE INDEX "RentalOperationMedia_previewStorageKey_key"
ON "RentalOperationMedia"("previewStorageKey");
