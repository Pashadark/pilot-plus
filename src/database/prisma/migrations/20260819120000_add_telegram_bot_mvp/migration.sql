CREATE TYPE "TelegramIdentityKind" AS ENUM ('CLIENT', 'STAFF');
CREATE TYPE "BotFulfillmentMode" AS ENUM ('OFFICE', 'DELIVERY');
CREATE TYPE "BotRentalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "BotNotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'ERROR');

ALTER TABLE "MaintenanceRecord"
ADD COLUMN "scheduledEndsAt" TIMESTAMPTZ(3);

CREATE INDEX "MaintenanceRecord_vehicleId_scheduledAt_scheduledEndsAt_idx"
ON "MaintenanceRecord"("vehicleId", "scheduledAt", "scheduledEndsAt");

CREATE TABLE "TelegramIdentity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "kind" "TelegramIdentityKind" NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "TelegramIdentity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TelegramIdentity_exactly_one_owner_check"
      CHECK (("userId" IS NOT NULL)::int + ("clientId" IS NOT NULL)::int = 1),
    CONSTRAINT "TelegramIdentity_kind_owner_check"
      CHECK (
        ("kind" = 'CLIENT' AND "clientId" IS NOT NULL AND "userId" IS NULL)
        OR ("kind" = 'STAFF' AND "userId" IS NOT NULL AND "clientId" IS NULL)
      )
);

CREATE UNIQUE INDEX "TelegramIdentity_companyId_telegramUserId_key"
ON "TelegramIdentity"("companyId", "telegramUserId");
CREATE UNIQUE INDEX "TelegramIdentity_companyId_userId_key"
ON "TelegramIdentity"("companyId", "userId");
CREATE UNIQUE INDEX "TelegramIdentity_companyId_clientId_key"
ON "TelegramIdentity"("companyId", "clientId");
CREATE INDEX "TelegramIdentity_telegramUserId_isActive_idx"
ON "TelegramIdentity"("telegramUserId", "isActive");

CREATE TABLE "TelegramInvite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "TelegramIdentityKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramInvite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TelegramInvite_expiry_check" CHECK ("expiresAt" > "createdAt")
);

CREATE UNIQUE INDEX "TelegramInvite_tokenHash_key" ON "TelegramInvite"("tokenHash");
CREATE INDEX "TelegramInvite_companyId_targetId_expiresAt_idx"
ON "TelegramInvite"("companyId", "targetId", "expiresAt");
CREATE INDEX "TelegramInvite_expiresAt_usedAt_idx"
ON "TelegramInvite"("expiresAt", "usedAt");

CREATE TABLE "BotRentalRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rentalId" TEXT,
    "preferredVehicleId" TEXT,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "fulfillmentMode" "BotFulfillmentMode" NOT NULL,
    "deliveryAddressEncrypted" TEXT,
    "commentEncrypted" TEXT,
    "status" "BotRentalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "BotRentalRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BotRentalRequest_interval_check" CHECK ("startsAt" < "endsAt"),
    CONSTRAINT "BotRentalRequest_fulfillment_address_check"
      CHECK (("fulfillmentMode" = 'DELIVERY') = ("deliveryAddressEncrypted" IS NOT NULL)),
    CONSTRAINT "BotRentalRequest_decision_check"
      CHECK (
        ("status" = 'PENDING' AND "decidedByUserId" IS NULL AND "decidedAt" IS NULL)
        OR ("status" = 'CANCELLED' AND "decidedByUserId" IS NULL)
        OR ("status" IN ('APPROVED', 'REJECTED') AND "decidedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL)
      )
);

CREATE UNIQUE INDEX "BotRentalRequest_companyId_idempotencyKey_key"
ON "BotRentalRequest"("companyId", "idempotencyKey");
CREATE INDEX "BotRentalRequest_companyId_status_createdAt_idx"
ON "BotRentalRequest"("companyId", "status", "createdAt");
CREATE INDEX "BotRentalRequest_companyId_clientId_createdAt_idx"
ON "BotRentalRequest"("companyId", "clientId", "createdAt");
CREATE INDEX "BotRentalRequest_companyId_preferredVehicleId_startsAt_endsAt_idx"
ON "BotRentalRequest"("companyId", "preferredVehicleId", "startsAt", "endsAt");

CREATE TABLE "BotNotificationJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "identityId" TEXT,
    "chatId" TEXT,
    "eventKey" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "BotNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "claimToken" TEXT,
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "availableAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMPTZ(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "BotNotificationJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BotNotificationJob_exactly_one_target_check"
      CHECK (("identityId" IS NOT NULL)::int + ("chatId" IS NOT NULL)::int = 1),
    CONSTRAINT "BotNotificationJob_attempts_check" CHECK ("attempts" >= 0 AND "attempts" <= 5)
);

CREATE UNIQUE INDEX "BotNotificationJob_eventKey_key" ON "BotNotificationJob"("eventKey");
CREATE UNIQUE INDEX "BotNotificationJob_claimToken_key" ON "BotNotificationJob"("claimToken");
CREATE INDEX "BotNotificationJob_status_availableAt_idx"
ON "BotNotificationJob"("status", "availableAt");
CREATE INDEX "BotNotificationJob_companyId_status_availableAt_idx"
ON "BotNotificationJob"("companyId", "status", "availableAt");

ALTER TABLE "TelegramIdentity"
ADD CONSTRAINT "TelegramIdentity_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramIdentity"
ADD CONSTRAINT "TelegramIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramIdentity"
ADD CONSTRAINT "TelegramIdentity_companyId_clientId_fkey"
FOREIGN KEY ("companyId", "clientId") REFERENCES "Client"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TelegramInvite"
ADD CONSTRAINT "TelegramInvite_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramInvite"
ADD CONSTRAINT "TelegramInvite_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BotRentalRequest"
ADD CONSTRAINT "BotRentalRequest_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotRentalRequest"
ADD CONSTRAINT "BotRentalRequest_companyId_clientId_fkey"
FOREIGN KEY ("companyId", "clientId") REFERENCES "Client"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotRentalRequest"
ADD CONSTRAINT "BotRentalRequest_companyId_rentalId_fkey"
FOREIGN KEY ("companyId", "rentalId") REFERENCES "Rental"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BotRentalRequest"
ADD CONSTRAINT "BotRentalRequest_companyId_preferredVehicleId_fkey"
FOREIGN KEY ("companyId", "preferredVehicleId") REFERENCES "Vehicle"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BotRentalRequest"
ADD CONSTRAINT "BotRentalRequest_decidedByUserId_fkey"
FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BotNotificationJob"
ADD CONSTRAINT "BotNotificationJob_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotNotificationJob"
ADD CONSTRAINT "BotNotificationJob_identityId_fkey"
FOREIGN KEY ("identityId") REFERENCES "TelegramIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
