-- Клиентские персональные данные хранятся шифротекстом на уровне приложения.
CREATE TYPE "public"."ClientStatus" AS ENUM (
  'DRAFT',
  'NEW',
  'VERIFYING',
  'VERIFIED',
  'REGULAR',
  'BLOCKED',
  'ARCHIVED'
);

CREATE TABLE "public"."Client" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "middleName" TEXT,
  "lastName" TEXT NOT NULL,
  "birthDate" TIMESTAMP(3),
  "gender" TEXT,
  "phoneEncrypted" TEXT NOT NULL,
  "phoneIndex" TEXT NOT NULL,
  "additionalPhoneEncrypted" TEXT,
  "email" TEXT,
  "telegramUsername" TEXT,
  "telegramUserId" TEXT,
  "maxUserId" TEXT,
  "photoPath" TEXT,
  "registrationAddressEncrypted" TEXT,
  "actualAddressEncrypted" TEXT,
  "passportEncrypted" TEXT,
  "passportIndex" TEXT,
  "driverLicenseEncrypted" TEXT,
  "driverLicenseIndex" TEXT,
  "driverCategories" TEXT[] NOT NULL,
  "driverLicenseIssuedAt" TIMESTAMP(3),
  "driverLicenseExpiresAt" TIMESTAMP(3),
  "drivingSince" TIMESTAMP(3),
  "emergencyContactEncrypted" TEXT,
  "source" TEXT,
  "note" TEXT,
  "status" "public"."ClientStatus" NOT NULL DEFAULT 'NEW',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Client_companyId_phoneIndex_key" ON "public"."Client"("companyId", "phoneIndex");
CREATE INDEX "Client_companyId_status_updatedAt_idx" ON "public"."Client"("companyId", "status", "updatedAt");
CREATE INDEX "Client_companyId_lastName_firstName_idx" ON "public"."Client"("companyId", "lastName", "firstName");

ALTER TABLE "public"."Client"
ADD CONSTRAINT "Client_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."Client"
ADD CONSTRAINT "Client_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
