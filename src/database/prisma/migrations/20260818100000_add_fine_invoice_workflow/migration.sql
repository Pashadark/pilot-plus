ALTER TYPE "public"."FineAssignmentSource" ADD VALUE IF NOT EXISTS 'AUTO_EXACT';

CREATE TYPE "public"."FineInvoiceStatus" AS ENUM ('PENDING', 'CREATED', 'SUCCEEDED', 'FAILED', 'ERROR');

ALTER TABLE "public"."Fine"
  ADD COLUMN "comment" TEXT,
  ADD COLUMN "commentedAt" TIMESTAMPTZ(3),
  ADD COLUMN "commentedByUserId" TEXT,
  ADD COLUMN "assignmentSource" "public"."FineAssignmentSource",
  ADD COLUMN "assignmentConfirmedAt" TIMESTAMPTZ(3),
  ADD COLUMN "assignmentConfirmedByUserId" TEXT;

CREATE TABLE "public"."FineInvoice" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'DRIVER_HELPER',
  "providerInvoiceId" TEXT,
  "status" "public"."FineInvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "sandbox" BOOLEAN NOT NULL DEFAULT true,
  "fineAmountMinor" BIGINT NOT NULL,
  "commissionAmountMinor" BIGINT NOT NULL,
  "totalAmountMinor" BIGINT NOT NULL,
  "initiatedByUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "paymentHost" VARCHAR(253),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "FineInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FineInvoice_sandbox_check" CHECK ("sandbox" = true),
  CONSTRAINT "FineInvoice_paymentHost_hostname_check" CHECK (
    "paymentHost" IS NULL OR (
      char_length("paymentHost") BETWEEN 1 AND 253
      AND "paymentHost" ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$'
    )
  )
);

CREATE TABLE "public"."FineInvoiceItem" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "fineId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FineInvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FineInvoice_providerInvoiceId_key" ON "public"."FineInvoice"("providerInvoiceId");
CREATE UNIQUE INDEX "FineInvoice_idempotencyKey_key" ON "public"."FineInvoice"("idempotencyKey");
CREATE UNIQUE INDEX "FineInvoice_companyId_id_key" ON "public"."FineInvoice"("companyId", "id");
CREATE INDEX "FineInvoice_companyId_status_idx" ON "public"."FineInvoice"("companyId", "status");
CREATE INDEX "FineInvoice_initiatedByUserId_createdAt_idx" ON "public"."FineInvoice"("initiatedByUserId", "createdAt");
CREATE UNIQUE INDEX "FineInvoiceItem_invoiceId_fineId_key" ON "public"."FineInvoiceItem"("invoiceId", "fineId");
CREATE INDEX "FineInvoiceItem_companyId_invoiceId_idx" ON "public"."FineInvoiceItem"("companyId", "invoiceId");
CREATE INDEX "FineInvoiceItem_companyId_fineId_idx" ON "public"."FineInvoiceItem"("companyId", "fineId");
CREATE UNIQUE INDEX "Fine_companyId_id_key" ON "public"."Fine"("companyId", "id");

ALTER TABLE "public"."Fine"
  ADD CONSTRAINT "Fine_commentedByUserId_fkey" FOREIGN KEY ("commentedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Fine_assignmentConfirmedByUserId_fkey" FOREIGN KEY ("assignmentConfirmedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."FineInvoice"
  ADD CONSTRAINT "FineInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FineInvoice_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."FineInvoiceItem"
  ADD CONSTRAINT "FineInvoiceItem_companyId_invoiceId_fkey" FOREIGN KEY ("companyId", "invoiceId") REFERENCES "public"."FineInvoice"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FineInvoiceItem_companyId_fineId_fkey" FOREIGN KEY ("companyId", "fineId") REFERENCES "public"."Fine"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
