CREATE TABLE "TelematicsIntegration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'GLONASSSOFT',
    "baseUrl" TEXT NOT NULL,
    "usernameEncrypted" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastAttemptAt" TIMESTAMP(3) WITH TIME ZONE,
    "lastSuccessAt" TIMESTAMP(3) WITH TIME ZONE,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelematicsIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelematicsVehicleLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'GLONASSSOFT',
    "externalId" TEXT NOT NULL,
    "registrationNumberNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelematicsVehicleLink_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "VehiclePosition"
    ADD COLUMN "provider" TEXT,
    ADD COLUMN "externalId" TEXT,
    ADD COLUMN "providerRecordedAt" TIMESTAMP(3) WITH TIME ZONE,
    ADD COLUMN "receivedAt" TIMESTAMP(3) WITH TIME ZONE;

ALTER TABLE "VehicleEvent"
    ADD COLUMN "provider" TEXT,
    ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "TelematicsIntegration_companyId_key"
    ON "TelematicsIntegration"("companyId");

CREATE UNIQUE INDEX "TelematicsVehicleLink_companyId_provider_externalId_key"
    ON "TelematicsVehicleLink"("companyId", "provider", "externalId");

CREATE UNIQUE INDEX "TelematicsVehicleLink_companyId_provider_vehicleId_key"
    ON "TelematicsVehicleLink"("companyId", "provider", "vehicleId");

CREATE UNIQUE INDEX "VehiclePosition_vehicleId_provider_externalId_key"
    ON "VehiclePosition"("vehicleId", "provider", "externalId");

CREATE UNIQUE INDEX "VehicleEvent_vehicleId_provider_externalId_key"
    ON "VehicleEvent"("vehicleId", "provider", "externalId");

ALTER TABLE "TelematicsIntegration"
    ADD CONSTRAINT "TelematicsIntegration_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TelematicsVehicleLink"
    ADD CONSTRAINT "TelematicsVehicleLink_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TelematicsVehicleLink"
    ADD CONSTRAINT "TelematicsVehicleLink_companyId_vehicleId_fkey"
    FOREIGN KEY ("companyId", "vehicleId") REFERENCES "Vehicle"("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
