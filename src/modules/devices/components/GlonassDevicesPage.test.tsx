import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { GlonassDevicesPage } from './GlonassDevicesPage';

it('называет реальные трекеры ГЛОНАССSoft и ведёт к машине и карте', () => {
  const html = renderToStaticMarkup(
    <GlonassDevicesPage
      data={{
        summary: { total: 1, online: 1, stale: 0, offline: 0 },
        trackers: [
          {
            id: 'link-1',
            externalId: '4821',
            provider: 'GLONASSSOFT',
            status: 'ONLINE',
            lastSeenAt: '2026-09-16T05:09:00.000Z',
            speedKph: 42,
            heading: 127,
            latitude: 55.75,
            longitude: 37.61,
            address: 'Москва',
            vehicle: {
              id: 'vehicle-1',
              internalNumber: 'CAR-008',
              name: 'Kia Cerato',
              registrationNumber: 'С886АУ997',
            },
          },
        ],
      }}
    />,
  );

  expect(html).toContain('Трекеры ГЛОНАССSoft');
  expect(html).toContain('Объект 4821');
  expect(html).toContain('С886АУ997');
  expect(html).toContain('/vehicles/vehicle-1');
  expect(html).toContain('/map?vehicleId=vehicle-1');
  expect(html).not.toContain('Pilot Connect');
});
