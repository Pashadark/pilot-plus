export type MaintenancePreflightStatusSummary = {
  status: string;
  rowCount: number;
  nonDerivableOverdueCount: number;
};

const KNOWN_MAINTENANCE_STATUSES = new Set([
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
  'CANCELLED',
]);

export function getMaintenanceMigrationPreflightError(
  summaries: readonly MaintenancePreflightStatusSummary[],
): string | null {
  const unsupported = summaries
    .filter((summary) => !KNOWN_MAINTENANCE_STATUSES.has(summary.status))
    .map((summary) => `${summary.status} (${summary.rowCount})`);
  const nonDerivableOverdueCount = summaries.reduce(
    (count, summary) => count + summary.nonDerivableOverdueCount,
    0,
  );
  const errors: string[] = [];

  if (unsupported.length) {
    errors.push(
      `Найдены неподдерживаемые legacy-статусы: ${unsupported.join(', ')}. Сопоставьте их вручную до миграции.`,
    );
  }
  if (nonDerivableOverdueCount) {
    errors.push(
      `Найдены недоказуемые строки OVERDUE (${nonDerivableOverdueCount}): плановая дата отсутствует или ещё не наступила. Сопоставьте их вручную и проверьте резервную копию до миграции.`,
    );
  }

  return errors.length ? errors.join('\n') : null;
}
