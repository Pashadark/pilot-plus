export type FleetMapTheme = 'light' | 'dark';

export function getFleetMapStyleUrl(theme: FleetMapTheme): string {
  return `https://tiles.openfreemap.org/styles/${theme === 'dark' ? 'dark' : 'liberty'}`;
}

export function getFleetMapFallbackStyle() {
  return {
    version: 8 as const,
    sources: {
      openStreetMap: {
        type: 'raster' as const,
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'open-street-map',
        type: 'raster' as const,
        source: 'openStreetMap',
      },
    ],
  };
}
