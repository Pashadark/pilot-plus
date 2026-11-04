CREATE TYPE "OwnerProfileStatus" AS ENUM ('ACTIVE', 'BLOCKED');
CREATE TYPE "OwnerLedgerEntryKind" AS ENUM ('ACCRUAL', 'REVERSAL', 'ADJUSTMENT', 'PAYOUT');

CREATE TABLE "OwnerProfile" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "status" "OwnerProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "OwnerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OwnerSession" (
  "id" TEXT NOT NULL,
  "ownerProfileId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "deviceName" TEXT,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3),
  "lastUsedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnerSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OwnerVehicleAccess" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "ownerProfileId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "assignedByUserId" TEXT NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnerVehicleAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OwnerRevenueRule" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "ownerProfileId" TEXT NOT NULL,
  "shareBasisPoints" INTEGER NOT NULL DEFAULT 4000,
  "startsAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnerRevenueRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OwnerRevenueRule_shareBasisPoints_check"
    CHECK ("shareBasisPoints" >= 0 AND "shareBasisPoints" <= 10000)
);

CREATE TABLE "OwnerLedgerEntry" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "ownerProfileId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "rentalPaymentId" TEXT,
  "kind" "OwnerLedgerEntryKind" NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'RUB',
  "shareBasisPoints" INTEGER NOT NULL,
  "recognizedOn" DATE NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnerLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OwnerLedgerEntry_shareBasisPoints_check"
    CHECK ("shareBasisPoints" >= 0 AND "shareBasisPoints" <= 10000)
);

CREATE UNIQUE INDEX "OwnerProfile_phoneE164_key" ON "OwnerProfile"("phoneE164");
CREATE UNIQUE INDEX "OwnerProfile_companyId_id_key" ON "OwnerProfile"("companyId", "id");
CREATE INDEX "OwnerProfile_companyId_status_createdAt_idx" ON "OwnerProfile"("companyId", "status", "createdAt");
CREATE UNIQUE INDEX "OwnerSession_refreshTokenHash_key" ON "OwnerSession"("refreshTokenHash");
CREATE INDEX "OwnerSession_ownerProfileId_expiresAt_idx" ON "OwnerSession"("ownerProfileId", "expiresAt");
CREATE INDEX "OwnerSession_expiresAt_revokedAt_idx" ON "OwnerSession"("expiresAt", "revokedAt");
CREATE UNIQUE INDEX "OwnerVehicleAccess_ownerProfileId_vehicleId_startsAt_key" ON "OwnerVehicleAccess"("ownerProfileId", "vehicleId", "startsAt");
CREATE INDEX "OwnerVehicleAccess_ownerProfileId_startsAt_endsAt_idx" ON "OwnerVehicleAccess"("ownerProfileId", "startsAt", "endsAt");
CREATE INDEX "OwnerVehicleAccess_companyId_vehicleId_startsAt_endsAt_idx" ON "OwnerVehicleAccess"("companyId", "vehicleId", "startsAt", "endsAt");
CREATE INDEX "OwnerVehicleAccess_assignedByUserId_createdAt_idx" ON "OwnerVehicleAccess"("assignedByUserId", "createdAt");
CREATE UNIQUE INDEX "OwnerRevenueRule_ownerProfileId_startsAt_key" ON "OwnerRevenueRule"("ownerProfileId", "startsAt");
CREATE INDEX "OwnerRevenueRule_ownerProfileId_startsAt_endsAt_idx" ON "OwnerRevenueRule"("ownerProfileId", "startsAt", "endsAt");
CREATE UNIQUE INDEX "OwnerLedgerEntry_idempotencyKey_key" ON "OwnerLedgerEntry"("idempotencyKey");
CREATE INDEX "OwnerLedgerEntry_ownerProfileId_recognizedOn_createdAt_idx" ON "OwnerLedgerEntry"("ownerProfileId", "recognizedOn", "createdAt");
CREATE INDEX "OwnerLedgerEntry_companyId_vehicleId_recognizedOn_idx" ON "OwnerLedgerEntry"("companyId", "vehicleId", "recognizedOn");
CREATE INDEX "OwnerLedgerEntry_companyId_rentalPaymentId_idx" ON "OwnerLedgerEntry"("companyId", "rentalPaymentId");

ALTER TABLE "OwnerProfile"
ADD CONSTRAINT "OwnerProfile_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerSession"
ADD CONSTRAINT "OwnerSession_ownerProfileId_fkey"
FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerVehicleAccess"
ADD CONSTRAINT "OwnerVehicleAccess_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerVehicleAccess"
ADD CONSTRAINT "OwnerVehicleAccess_companyId_ownerProfileId_fkey"
FOREIGN KEY ("companyId", "ownerProfileId") REFERENCES "OwnerProfile"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerVehicleAccess"
ADD CONSTRAINT "OwnerVehicleAccess_companyId_vehicleId_fkey"
FOREIGN KEY ("companyId", "vehicleId") REFERENCES "Vehicle"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerVehicleAccess"
ADD CONSTRAINT "OwnerVehicleAccess_assignedByUserId_fkey"
FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OwnerRevenueRule"
ADD CONSTRAINT "OwnerRevenueRule_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerRevenueRule"
ADD CONSTRAINT "OwnerRevenueRule_companyId_ownerProfileId_fkey"
FOREIGN KEY ("companyId", "ownerProfileId") REFERENCES "OwnerProfile"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnerLedgerEntry"
ADD CONSTRAINT "OwnerLedgerEntry_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OwnerLedgerEntry"
ADD CONSTRAINT "OwnerLedgerEntry_companyId_ownerProfileId_fkey"
FOREIGN KEY ("companyId", "ownerProfileId") REFERENCES "OwnerProfile"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OwnerLedgerEntry"
ADD CONSTRAINT "OwnerLedgerEntry_companyId_vehicleId_fkey"
FOREIGN KEY ("companyId", "vehicleId") REFERENCES "Vehicle"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OwnerLedgerEntry"
ADD CONSTRAINT "OwnerLedgerEntry_companyId_rentalPaymentId_fkey"
FOREIGN KEY ("companyId", "rentalPaymentId") REFERENCES "RentalPayment"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
