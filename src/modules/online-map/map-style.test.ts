import { expect, it } from 'vitest';

import { getFleetMapFallbackStyle, getFleetMapStyleUrl } from './map-style';

it('использует современную векторную подложку для светлой и тёмной темы', () => {
  expect(getFleetMapStyleUrl('light')).toBe('https://tiles.openfreemap.org/styles/liberty');
  expect(getFleetMapStyleUrl('dark')).toBe('https://tiles.openfreemap.org/styles/dark');
});

it('имеет независимую резервную подложку OpenStreetMap', () => {
  const style = getFleetMapFallbackStyle();

  expect(style.sources).toMatchObject({
    openStreetMap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
    },
  });
  expect(style.layers).toContainEqual(
    expect.objectContaining({ id: 'open-street-map', source: 'openStreetMap' }),
  );
});
