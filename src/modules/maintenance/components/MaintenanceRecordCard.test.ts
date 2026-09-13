// @vitest-environment jsdom

import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { MaintenanceRecordDto } from '../server/queries';
import { MaintenanceRecordCard } from './MaintenanceRecordCard';

const repair: MaintenanceRecordDto = {
  id: 'repair-1',
  vehicleId: 'vehicle-1',
  title: 'Повреждение заднего бампера',
  description: 'Повреждён подкрылок и нижняя часть бампера',
  recordType: 'REPAIR',
  kind: 'OTHER',
  status: 'IN_PROGRESS',
  damageReportedAt: '2026-09-12T09:00:00.000Z',
  startedAt: '2026-09-12T10:00:00.000Z',
  scheduledAt: null,
  completedAt: null,
  odometerKm: null,
  currentOdometerKm: 94000,
  targetOdometerKm: null,
  provider: null,
  costMinor: null,
  notes: null,
  createdAt: '2026-09-12T10:00:00.000Z',
  rental: { id: 'rental-1', contractNumber: 'ME-2026-0030-GA' },
  client: { id: 'client-1', fullName: 'Горбунов Артём Денисович' },
  workItems: [
    { id: 'work-1', title: 'Дефектовка', description: null, costMinor: null, position: 0 },
  ],
  attachments: [
    {
      id: 'photo-1',
      kind: 'DAMAGE_BEFORE',
      originalName: 'damage.jpg',
      verifiedMime: 'image/jpeg',
      bytes: 1024,
      caption: null,
      createdAt: '2026-09-12T10:00:00.000Z',
      url: '/maintenance/repair-1/attachments/photo-1',
      isImage: true,
    },
  ],
  vehicle: {
    id: 'vehicle-1',
    internalNumber: 'CAR-001',
    model: 'Toyota Camry',
    registrationNumber: 'Х069АЕ997',
    imagePath: null,
  },
};

describe('карточка ремонта', () => {
  afterEach(cleanup);

  it('показывает повреждение, клиента, договор, работы и фотографии', () => {
    render(
      createElement(MaintenanceRecordCard, {
        record: repair,
        formAction: () => undefined,
        pending: false,
      }),
    );

    expect(screen.getByText('Ремонт и повреждение')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Горбунов Артём Денисович' }).getAttribute('href'),
    ).toBe('/clients/client-1');
    expect(screen.getByRole('link', { name: 'ME-2026-0030-GA' }).getAttribute('href')).toBe(
      '/rentals/rental-1',
    );
    expect(screen.getByText('Дефектовка')).toBeTruthy();
    expect(screen.getByAltText('Повреждение заднего бампера — фото повреждения')).toBeTruthy();
  });
});
