CREATE UNIQUE INDEX "RentalPayment_companyId_id_key"
ON "RentalPayment"("companyId", "id");

CREATE TABLE "RentalPaymentReceipt" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "verifiedMime" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "scanEngine" TEXT NOT NULL,
  "signatureVersion" TEXT NOT NULL,
  "scannedAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentalPaymentReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RentalPaymentReceipt_storageKey_key"
ON "RentalPaymentReceipt"("storageKey");

CREATE INDEX "RentalPaymentReceipt_companyId_paymentId_createdAt_idx"
ON "RentalPaymentReceipt"("companyId", "paymentId", "createdAt");

ALTER TABLE "RentalPaymentReceipt"
ADD CONSTRAINT "RentalPaymentReceipt_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalPaymentReceipt"
ADD CONSTRAINT "RentalPaymentReceipt_companyId_paymentId_fkey"
FOREIGN KEY ("companyId", "paymentId") REFERENCES "RentalPayment"("companyId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;
