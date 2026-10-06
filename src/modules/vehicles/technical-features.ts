export type VehicleDriveType = 'FRONT' | 'REAR' | 'ALL_WHEEL';

const driveLabels: Record<VehicleDriveType, string> = {
  FRONT: 'Передний',
  REAR: 'Задний',
  ALL_WHEEL: 'Полный',
};

const drivePattern = /^Привод\s*[:—-]\s*(Передний|Задний|Полный)$/i;
const standaloneDrivePattern = /^(Передний|Задний|Полный)\s+привод$/i;
const consumptionPattern = /^Расход\s*[:—-]\s*(\d+(?:[.,]\d+)?)\s*л\s*\/\s*100\s*км$/i;

function normalizedDriveLabel(feature: string) {
  const match = feature.trim().match(drivePattern) ?? feature.trim().match(standaloneDrivePattern);
  if (!match?.[1]) return null;
  const value = match[1].toLowerCase();
  if (value === 'передний') return 'Передний';
  if (value === 'задний') return 'Задний';
  return 'Полный';
}

export function driveTypeFromFeatures(features: readonly string[]) {
  for (const feature of features) {
    const label = normalizedDriveLabel(feature);
    if (label) return label;
  }
  return null;
}

export function driveTypeCodeFromFeatures(
  features: readonly string[],
): VehicleDriveType | undefined {
  const label = driveTypeFromFeatures(features);
  if (label === 'Передний') return 'FRONT';
  if (label === 'Задний') return 'REAR';
  if (label === 'Полный') return 'ALL_WHEEL';
  return undefined;
}

export function fuelConsumptionFromFeatures(features: readonly string[]) {
  for (const feature of features) {
    const match = feature.trim().match(consumptionPattern);
    if (!match?.[1]) continue;
    const value = Number(match[1].replace(',', '.'));
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function mergeTechnicalFeatures(
  features: readonly string[],
  driveType?: VehicleDriveType,
  fuelConsumptionLitersPer100Km?: number,
) {
  const preserved = features.filter(
    (feature) =>
      !drivePattern.test(feature.trim()) &&
      !standaloneDrivePattern.test(feature.trim()) &&
      !consumptionPattern.test(feature.trim()),
  );

  if (driveType) preserved.push(`Привод: ${driveLabels[driveType]}`);
  if (fuelConsumptionLitersPer100Km !== undefined) {
    preserved.push(
      `Расход: ${fuelConsumptionLitersPer100Km.toLocaleString('ru-RU', {
        maximumFractionDigits: 1,
      })} л/100 км`,
    );
  }
  return preserved;
}
