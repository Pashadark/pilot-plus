export type MaintenanceOdometerProgressInput = {
  startOdometerKm: number | null;
  currentOdometerKm: number | null;
  targetOdometerKm: number | null;
};

export function calculateMaintenanceOdometerProgress({
  startOdometerKm,
  currentOdometerKm,
  targetOdometerKm,
}: MaintenanceOdometerProgressInput) {
  const remainingKm =
    currentOdometerKm === null || targetOdometerKm === null
      ? null
      : Math.max(0, Math.round((targetOdometerKm - currentOdometerKm) * 10) / 10);
  let progressPercent: number | null = null;
  if (
    startOdometerKm !== null &&
    currentOdometerKm !== null &&
    targetOdometerKm !== null &&
    targetOdometerKm > startOdometerKm
  ) {
    progressPercent = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          ((currentOdometerKm - startOdometerKm) / (targetOdometerKm - startOdometerKm)) * 100,
        ),
      ),
    );
  }

  return { remainingKm, progressPercent };
}
