-- Run this read/audit block BEFORE `prisma migrate deploy` when upgrading a populated database
-- that still has MaintenanceRecord.status as text.
DO $$
DECLARE
  unsupported_statuses text;
BEGIN
  SELECT string_agg(format('%s (%s)', "status", row_count), ', ' ORDER BY "status")
  INTO unsupported_statuses
  FROM (
    SELECT "status"::text AS "status", COUNT(*) AS row_count
    FROM "public"."MaintenanceRecord"
    WHERE "status"::text NOT IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED')
    GROUP BY "status"::text
  ) AS unsupported;

  IF unsupported_statuses IS NOT NULL THEN
    RAISE EXCEPTION
      'Unsupported MaintenanceRecord statuses: %. Map them explicitly before migration.',
      unsupported_statuses;
  END IF;
END $$;
