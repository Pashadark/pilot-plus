ALTER TABLE "CompanyGpsSettings"
  ADD COLUMN "brakingDetectionEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "harshBrakingThresholdMps2" DECIMAL(5,2) NOT NULL DEFAULT 3.0,
  ADD COLUMN "criticalBrakingThresholdMps2" DECIMAL(5,2) NOT NULL DEFAULT 4.0;

ALTER TABLE "VehicleGpsSettingsOverride"
  ADD COLUMN "brakingDetectionEnabled" BOOLEAN,
  ADD COLUMN "harshBrakingThresholdMps2" DECIMAL(5,2),
  ADD COLUMN "criticalBrakingThresholdMps2" DECIMAL(5,2);
