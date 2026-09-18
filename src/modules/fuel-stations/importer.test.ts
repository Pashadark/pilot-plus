import { describe, expect, it } from 'vitest';

import { parseFuelStationFeatures } from './importer';

describe('parseFuelStationFeatures', () => {
  it('keeps fuel points and drops unrelated or malformed features', () => {
    const result = parseFuelStationFeatures({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'node/1', geometry: { type: 'Point', coordinates: [37.61, 55.75] }, properties: { amenity: 'fuel', name: 'АЗС Тест', brand: 'Test' } },
        { type: 'Feature', id: 'node/2', geometry: { type: 'Point', coordinates: [37.62, 55.76] }, properties: { amenity: 'cafe' } },
        { type: 'Feature', id: 'node/3', geometry: { type: 'Point', coordinates: [37.62] }, properties: { amenity: 'fuel' } },
      ],
    });
    expect(result).toEqual([
      expect.objectContaining({ osmType: 'node', osmId: '1', name: 'АЗС Тест', latitude: 55.75, longitude: 37.61 }),
    ]);
  });
});
