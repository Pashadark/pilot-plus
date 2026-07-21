import { prisma } from '../src/database/prisma/client';
import {
  getMaintenanceMigrationPreflightError,
  type MaintenancePreflightStatusSummary,
} from '../src/database/prisma/maintenance-preflight';

async function main() {
  const [table] = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('"public"."MaintenanceRecord"') IS NOT NULL AS "exists"
  `;

  if (!table?.exists) {
    console.log('Preflight ТО: legacy-таблица отсутствует, чистое развёртывание безопасно.');
    return;
  }

  const summaries = await prisma.$queryRaw<MaintenancePreflightStatusSummary[]>`
    SELECT
      "status"::text AS "status",
      COUNT(*)::int AS "rowCount",
      COUNT(*) FILTER (
        WHERE "status"::text = 'OVERDUE'
          AND ("scheduledAt" IS NULL OR "scheduledAt" >= CURRENT_TIMESTAMP)
      )::int AS "nonDerivableOverdueCount"
    FROM "public"."MaintenanceRecord"
    GROUP BY "status"::text
    ORDER BY "status"::text
  `;
  const error = getMaintenanceMigrationPreflightError(summaries);

  if (error) throw new Error(error);

  console.log(
    'Preflight ТО пройден: статусы поддерживаются, все OVERDUE имеют прошедшую плановую дату.',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Не удалось выполнить preflight ТО.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
