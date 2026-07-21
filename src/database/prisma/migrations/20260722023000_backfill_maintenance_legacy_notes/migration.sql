-- Preserve legacy maintenance descriptions in the new user-visible notes field.
-- This follow-up intentionally leaves the already-applied 20260721230000 migration unchanged.
UPDATE "public"."MaintenanceRecord"
SET "notes" = COALESCE("notes", "description")
WHERE "description" IS NOT NULL;

-- OVERDUE is now an effective read status derived from PLANNED + a past scheduledAt.
UPDATE "public"."MaintenanceRecord"
SET "status" = 'PLANNED'
WHERE "status" = 'OVERDUE';

-- Audit the typed result. Unknown text values must be handled by the preflight before the enum
-- conversion; once the preceding migration has run, PostgreSQL only permits these enum values.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."MaintenanceRecord"
    WHERE "status"::text NOT IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED')
  ) THEN
    RAISE EXCEPTION 'MaintenanceRecord contains an unsupported status after enum migration';
  END IF;
END $$;
