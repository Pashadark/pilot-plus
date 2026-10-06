-- A committed extension is legal history stored in RentalOperation. Permit only the coordinated
-- forward interval and calculated price changes made by that operation while keeping every other
-- confirmed-contract field immutable.
CREATE OR REPLACE FUNCTION "public"."prevent_rental_legal_snapshot_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  is_extension BOOLEAN := FALSE;
BEGIN
  IF NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'CONFIRMED', 'CANCELLED'))
    OR (OLD."status" = 'CONFIRMED' AND NEW."status" IN ('CONFIRMED', 'ACTIVE', 'CANCELLED'))
    OR (OLD."status" = 'ACTIVE' AND NEW."status" IN ('ACTIVE', 'COMPLETED', 'CANCELLED'))
    OR (OLD."status" = 'COMPLETED' AND NEW."status" = 'COMPLETED')
    OR (OLD."status" = 'CANCELLED' AND NEW."status" = 'CANCELLED')
  ) THEN
    RAISE EXCEPTION 'Invalid rental lifecycle transition from % to %.', OLD."status", NEW."status";
  END IF;

  is_extension :=
    OLD."status" = 'ACTIVE'
    AND NEW."status" = 'ACTIVE'
    AND NEW."endsAt" > OLD."endsAt"
    AND NEW."billableDays" > OLD."billableDays"
    AND NEW."basePriceMinor" > OLD."basePriceMinor"
    AND NEW."totalPriceMinor" > OLD."totalPriceMinor";

  IF OLD."confirmedAt" IS NOT NULL AND (
    NEW."companyId" IS DISTINCT FROM OLD."companyId"
    OR NEW."clientId" IS DISTINCT FROM OLD."clientId"
    OR NEW."vehicleId" IS DISTINCT FROM OLD."vehicleId"
    OR NEW."startsAt" IS DISTINCT FROM OLD."startsAt"
    OR (NEW."endsAt" IS DISTINCT FROM OLD."endsAt" AND NOT is_extension)
    OR NEW."contractNumber" IS DISTINCT FROM OLD."contractNumber"
    OR NEW."snapshotVersion" IS DISTINCT FROM OLD."snapshotVersion"
    OR NEW."snapshot" IS DISTINCT FROM OLD."snapshot"
    OR NEW."templateVersionId" IS DISTINCT FROM OLD."templateVersionId"
    OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."dailyRateMinor" IS DISTINCT FROM OLD."dailyRateMinor"
    OR (NEW."billableDays" IS DISTINCT FROM OLD."billableDays" AND NOT is_extension)
    OR (NEW."basePriceMinor" IS DISTINCT FROM OLD."basePriceMinor" AND NOT is_extension)
    OR NEW."discountMinor" IS DISTINCT FROM OLD."discountMinor"
    OR NEW."servicesMinor" IS DISTINCT FROM OLD."servicesMinor"
    OR (NEW."totalPriceMinor" IS DISTINCT FROM OLD."totalPriceMinor" AND NOT is_extension)
    OR NEW."depositMinor" IS DISTINCT FROM OLD."depositMinor"
    OR NEW."includedMileageKm" IS DISTINCT FROM OLD."includedMileageKm"
    OR NEW."overageMileagePriceMinor" IS DISTINCT FROM OLD."overageMileagePriceMinor"
    OR NEW."missingFuelPriceMinor" IS DISTINCT FROM OLD."missingFuelPriceMinor"
    OR NEW."priceOverrideReason" IS DISTINCT FROM OLD."priceOverrideReason"
    OR NEW."confirmedAt" IS DISTINCT FROM OLD."confirmedAt"
    OR (OLD."activatedAt" IS NOT NULL AND NEW."activatedAt" IS DISTINCT FROM OLD."activatedAt")
    OR (
      OLD."activatedAt" IS NULL
      AND NEW."activatedAt" IS NOT NULL
      AND NOT (OLD."status" = 'CONFIRMED' AND NEW."status" = 'ACTIVE')
    )
    OR (OLD."completedAt" IS NOT NULL AND NEW."completedAt" IS DISTINCT FROM OLD."completedAt")
    OR (
      OLD."completedAt" IS NULL
      AND NEW."completedAt" IS NOT NULL
      AND NOT (OLD."status" = 'ACTIVE' AND NEW."status" = 'COMPLETED')
    )
    OR (OLD."cancelledAt" IS NOT NULL AND NEW."cancelledAt" IS DISTINCT FROM OLD."cancelledAt")
    OR (
      OLD."cancelledAt" IS NULL
      AND NEW."cancelledAt" IS NOT NULL
      AND NOT (OLD."status" IN ('CONFIRMED', 'ACTIVE') AND NEW."status" = 'CANCELLED')
    )
  ) THEN
    RAISE EXCEPTION 'Confirmed rental legal snapshot fields are immutable.';
  END IF;
  RETURN NEW;
END;
$$;
