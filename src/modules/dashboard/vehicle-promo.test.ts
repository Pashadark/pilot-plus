import { describe, expect, it } from 'vitest';
import { getVehiclePromo, getVehiclePromoForFine } from './vehicle-promo';
describe('vehicle promo assets', () => {
  it('uses transparent model-specific assets for verified fleet identities', () => {
    expect(getVehiclePromo('cmu6nohbq0001e7adgf3u3vb1', 'BMW 520d')?.localPath).toBe(
      '/vehicles/promo/bmw-520d-black.png',
    );
  });
  it('does not guess a promo for an unknown vehicle', () => {
    expect(getVehiclePromo('another-company-vehicle', 'BMW 520d')).toBeNull();
  });

  it('falls back to the exact vehicle model from a fine label when the provider omitted a local id', () => {
    expect(getVehiclePromoForFine(null, 'Kia K5 · М022АН997')?.localPath).toBe(
      '/vehicles/promo/kia-k5-white.png',
    );
  });
});
