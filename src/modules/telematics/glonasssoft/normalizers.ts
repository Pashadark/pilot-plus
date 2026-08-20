import { normalizeRegistrationNumber } from '@/modules/vehicles/manage/validation';

export function normalizeGlonassSoftPlate(value: string): string {
  try {
    return normalizeRegistrationNumber(value);
  } catch {
    throw new Error('Госномер GLONASSSoft имеет неверный формат.');
  }
}
