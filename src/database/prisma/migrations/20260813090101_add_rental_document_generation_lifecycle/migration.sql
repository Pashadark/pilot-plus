-- Preserve the code-selected legal text version with every immutable template row.
ALTER TABLE "ContractTemplateVersion"
ADD COLUMN "legalContentVersion" TEXT NOT NULL DEFAULT 'legal-content-v1';

CREATE TYPE "RentalDocumentGenerationStatus" AS ENUM ('PENDING', 'PROMOTED', 'CLEANING', 'COMMITTED', 'ERROR');

CREATE TABLE "RentalDocumentGeneration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "RentalDocumentGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "docxUploadId" TEXT NOT NULL,
    "pdfUploadId" TEXT NOT NULL,
    "docxQuarantineKey" TEXT NOT NULL,
    "pdfQuarantineKey" TEXT NOT NULL,
    "docxStorageKey" TEXT NOT NULL,
    "pdfStorageKey" TEXT NOT NULL,
    "docxDocumentId" TEXT NOT NULL,
    "pdfDocumentId" TEXT NOT NULL,
    "docxDocumentVersionId" TEXT NOT NULL,
    "pdfDocumentVersionId" TEXT NOT NULL,
    "docxSha256" TEXT,
    "pdfSha256" TEXT,
    "docxScanEngine" TEXT,
    "pdfScanEngine" TEXT,
    "docxSignatureVersion" TEXT,
    "pdfSignatureVersion" TEXT,
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "claimToken" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "promotedAt" TIMESTAMPTZ(3),
    "committedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "RentalDocumentGeneration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RentalDocumentGeneration_rentalId_version_key" ON "RentalDocumentGeneration"("rentalId", "version");
CREATE UNIQUE INDEX "RentalDocumentGeneration_docxUploadId_key" ON "RentalDocumentGeneration"("docxUploadId");
CREATE UNIQUE INDEX "RentalDocumentGeneration_pdfUploadId_key" ON "RentalDocumentGeneration"("pdfUploadId");
CREATE UNIQUE INDEX "RentalDocumentGeneration_docxQuarantineKey_key" ON "RentalDocumentGeneration"("docxQuarantineKey");
CREATE UNIQUE INDEX "RentalDocumentGeneration_pdfQuarantineKey_key" ON "RentalDocumentGeneration"("pdfQuarantineKey");
CREATE UNIQUE INDEX "RentalDocumentGeneration_docxStorageKey_key" ON "RentalDocumentGeneration"("docxStorageKey");
CREATE UNIQUE INDEX "RentalDocumentGeneration_pdfStorageKey_key" ON "RentalDocumentGeneration"("pdfStorageKey");
CREATE UNIQUE INDEX "RentalDocumentGeneration_claimToken_key" ON "RentalDocumentGeneration"("claimToken");
CREATE INDEX "RentalDocumentGeneration_companyId_status_leaseExpiresAt_idx" ON "RentalDocumentGeneration"("companyId", "status", "leaseExpiresAt");
CREATE INDEX "RentalDocumentGeneration_companyId_rentalId_status_idx" ON "RentalDocumentGeneration"("companyId", "rentalId", "status");

ALTER TABLE "RentalDocumentGeneration"
ADD CONSTRAINT "RentalDocumentGeneration_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalDocumentGeneration"
ADD CONSTRAINT "RentalDocumentGeneration_companyId_clientId_rentalId_fkey"
FOREIGN KEY ("companyId", "clientId", "rentalId") REFERENCES "Rental"("companyId", "clientId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
