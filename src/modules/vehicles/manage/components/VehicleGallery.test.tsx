// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../image-actions', () => ({
  uploadVehicleImageAction: vi.fn(),
  setPrimaryVehicleImageAction: vi.fn(),
  deleteVehicleImageAction: vi.fn(),
  moveVehicleImageAction: vi.fn(),
}));
vi.mock('@/shared/providers/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { VehicleGallery } from './VehicleGallery';

afterEach(cleanup);

describe('VehicleGallery', () => {
  it('показывает загрузку и управление фотографиями', () => {
    render(
      <VehicleGallery
        vehicleId="vehicle-1"
        images={[{ id: 'image-1', localPath: '/one.webp', alt: 'Kia', isPrimary: true }]}
      />,
    );

    expect(screen.getByLabelText('Добавить фотографии автомобиля')).toBeTruthy();
    expect(screen.getByText('Основное фото')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Kia' }).getAttribute('src')).toBe('/one.webp');
    expect(screen.getByRole('button', { name: 'Удалить фото Kia' })).toBeTruthy();
  });
});
