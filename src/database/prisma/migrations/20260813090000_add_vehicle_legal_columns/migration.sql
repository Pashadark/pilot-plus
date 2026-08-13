-- Short Vehicle metadata wave. Prisma Migrate executes PostgreSQL migrations transactionally;
-- SET LOCAL therefore bounds only this migration and its ACCESS EXCLUSIVE ALTER TABLE lock.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "public"."Vehicle"
ADD COLUMN "registrationNumberNormalized" TEXT,
ADD COLUMN "vinNormalized" TEXT,
ADD COLUMN "make" TEXT,
ADD COLUMN "modelName" TEXT,
ADD COLUMN "generation" TEXT,
ADD COLUMN "trim" TEXT,
ADD COLUMN "manufacturedYear" INTEGER,
ADD COLUMN "color" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "bodyType" TEXT,
ADD COLUMN "odometerKm" DECIMAL(12,1),
ADD COLUMN "valueMinor" BIGINT,
ADD COLUMN "depositMinor" BIGINT,
ADD COLUMN "rangePriceMinor" BIGINT,
ADD COLUMN "includedMileageKm" INTEGER,
ADD COLUMN "overageMileagePriceMinor" BIGINT,
ADD COLUMN "missingFuelPriceMinor" BIGINT,
ADD COLUMN "registrationCertificateNumber" TEXT,
ADD COLUMN "vehiclePassportNumber" TEXT,
ADD COLUMN "osagoInsurer" TEXT,
ADD COLUMN "osagoPolicyNumber" TEXT,
ADD COLUMN "osagoStartsAt" DATE,
ADD COLUMN "osagoEndsAt" DATE,
ADD COLUMN "cascoInsurer" TEXT,
ADD COLUMN "cascoPolicyNumber" TEXT,
ADD COLUMN "cascoStartsAt" DATE,
ADD COLUMN "cascoEndsAt" DATE,
ADD COLUMN "isRentalReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rentalReadyAt" TIMESTAMPTZ(3),
ADD COLUMN "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN "archivedByUserId" TEXT;

CREATE FUNCTION "public"."normalize_vehicle_registration_number"(value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT NULLIF(
    regexp_replace(
      translate(upper(value), 'ABCEHKMOPTXY', 'АВСЕНКМОРТХУ'),
      '[^0-9А-ЯЁ]',
      '',
      'g'
    ),
    ''
  );
$$;

CREATE FUNCTION "public"."normalize_vehicle_vin"(value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT NULLIF(upper(btrim(value)), '');
$$;

CREATE FUNCTION "public"."set_vehicle_legal_identifiers_normalized"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW."registrationNumberNormalized" := "public"."normalize_vehicle_registration_number"(NEW."registrationNumber");
  NEW."vinNormalized" := "public"."normalize_vehicle_vin"(NEW."vin");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Vehicle_normalize_legal_identifiers"
BEFORE INSERT OR UPDATE OF "registrationNumber", "vin" ON "public"."Vehicle"
FOR EACH ROW EXECUTE FUNCTION "public"."set_vehicle_legal_identifiers_normalized"();
