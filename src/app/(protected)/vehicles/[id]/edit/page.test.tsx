import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  requireVehicleManagementAccess: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/database/prisma/client', () => ({
  prisma: { vehicle: { findFirst: mocks.findFirst } },
}));
vi.mock('@/modules/vehicles/manage/access', () => ({
  requireVehicleManagementAccess: mocks.requireVehicleManagementAccess,
}));
vi.mock('@/modules/vehicles/current-fuel', () => ({ latestFuelLevelPercent: () => null }));
vi.mock('@/modules/vehicles/technical-features', () => ({
  driveTypeCodeFromFeatures: () => null,
  fuelConsumptionFromFeatures: () => null,
}));
vi.mock('@/modules/vehicles/manage/components/VehicleForm', () => ({ VehicleForm: () => null }));
vi.mock('@/modules/vehicles/manage/components/VehicleGallery', () => ({
  VehicleGallery: () => null,
}));
vi.mock('@/modules/vehicles/manage/components/VehicleDocumentsPanel', () => ({
  VehicleDocumentsPanel: () => null,
}));
vi.mock('@/modules/vehicles/manage/components/ArchiveVehiclePanel', () => ({
  ArchiveVehiclePanel: () => null,
}));
vi.mock('@/shared/components/app-shell/AppShell', () => ({ AppShell: () => null }));

import EditVehiclePage from './page';

const incompleteVehicle = {
  id: 'vehicle-incomplete',
  companyId: 'company-1',
  internalNumber: 'REAL-001',
  registrationNumber: 'Х139АК997',
  make: 'Skoda',
  modelName: 'Karoq',
  manufacturedYear: null,
  vin: null,
  city: 'Москва',
  dailyPriceMinor: 0,
  transmission: 'Не указана',
  fuelType: 'OTHER',
  seats: 0,
  status: 'IDLE',
  isRentalReady: false,
  color: null,
  category: null,
  bodyType: null,
  features: [],
  engineLiters: null,
  odometerKm: null,
  valueMinor: null,
  rangePriceMinor: null,
  depositMinor: null,
  includedMileageKm: null,
  overageMileagePriceMinor: null,
  missingFuelPriceMinor: null,
  office: null,
  registrationCertificateNumber: '99 93 511523',
  vehiclePassportNumber: null,
  osagoInsurer: null,
  osagoPolicyNumber: null,
  osagoStartsAt: null,
  osagoEndsAt: null,
  cascoInsurer: null,
  cascoPolicyNumber: null,
  cascoStartsAt: null,
  cascoEndsAt: null,
  positions: [],
  rentalOperations: [],
  fuelRecords: [],
  company: { name: 'Пилот Плюс' },
  images: [],
  documents: [],
};

describe('редактор автомобиля', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(incompleteVehicle);
    mocks.requireVehicleManagementAccess.mockResolvedValue(undefined);
  });

  it('открывает существующую неполную карточку, чтобы владелец мог заполнить данные', async () => {
    await expect(
      EditVehiclePage({ params: Promise.resolve({ id: incompleteVehicle.id }) }),
    ).resolves.toBeTruthy();

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.requireVehicleManagementAccess).toHaveBeenCalledWith('company-1');
  });

  it('оставляет 404 для реально отсутствующего автомобиля', async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      EditVehiclePage({ params: Promise.resolve({ id: 'missing-vehicle' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.requireVehicleManagementAccess).not.toHaveBeenCalled();
  });
});
