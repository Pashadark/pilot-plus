-- Выполните этот блок чтения и аудита ДО `prisma migrate deploy` при обновлении заполненной базы,
-- в которой MaintenanceRecord.status ещё хранится как текст.
DO $$
DECLARE
  unsupported_statuses text;
  non_derivable_overdue_count integer;
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
      'Неподдерживаемые статусы MaintenanceRecord: %. Сопоставьте их вручную до миграции.',
      unsupported_statuses;
  END IF;

  SELECT COUNT(*)::integer
  INTO non_derivable_overdue_count
  FROM "public"."MaintenanceRecord"
  WHERE "status"::text = 'OVERDUE'
    AND ("scheduledAt" IS NULL OR "scheduledAt" >= CURRENT_TIMESTAMP);

  IF non_derivable_overdue_count > 0 THEN
    RAISE EXCEPTION
      'Строки OVERDUE без прошедшей плановой даты (% шт.) требуют ручного сопоставления и проверки резервной копии до миграции.',
      non_derivable_overdue_count;
  END IF;
END $$;
