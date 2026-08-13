-- This migration intentionally follows the committed metadata ALTER wave, so its potentially
-- long row update never retains the earlier ACCESS EXCLUSIVE table lock.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

UPDATE "public"."Vehicle"
SET
  "registrationNumberNormalized" = "public"."normalize_vehicle_registration_number"("registrationNumber"),
  "vinNormalized" = "public"."normalize_vehicle_vin"("vin")
WHERE
  "registrationNumberNormalized" IS DISTINCT FROM "public"."normalize_vehicle_registration_number"("registrationNumber")
  OR "vinNormalized" IS DISTINCT FROM "public"."normalize_vehicle_vin"("vin");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "public"."Vehicle" WHERE "registrationNumberNormalized" IS NOT NULL GROUP BY "companyId", "registrationNumberNormalized" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Cannot add vehicle plate uniqueness: duplicate normalized registration numbers exist. Resolve duplicates explicitly before retrying; this migration does not alter legacy records.';
  END IF;
  IF EXISTS (SELECT 1 FROM "public"."Vehicle" WHERE "vinNormalized" IS NOT NULL GROUP BY "companyId", "vinNormalized" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Cannot add vehicle VIN uniqueness: duplicate VIN values exist. Resolve duplicates explicitly before retrying; this migration does not alter legacy records.';
  END IF;
END;
$$;
