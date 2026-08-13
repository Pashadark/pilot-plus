import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAccessMock = vi.hoisted(() => vi.fn());
const transactionMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock('./access', () => ({ requireVehicleManagementAccess: requireAccessMock }));
vi.mock('@/database/prisma/client', () => ({ prisma: { $transaction: transactionMock } }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

import { archiveVehicleAction, createVehicleAction, updateVehicleAction } from './actions';

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

const baseInput = {
  companyId: 'company-1',
  internalNumber: 'RNT-001',
  make: 'Kia',
  model: "Cee'd",
  registrationNumber: 'А429АУ97',
  vin: 'XW8ZZZNZ8VG000001',
  year: '2020',
  city: 'Москва',
  transmission: 'АКПП',
  fuelType: 'PETROL',
  seats: '5',
  dailyPriceRubles: '3500',
  depositRubles: '10000',
  isRentalReady: 'true',
  status: 'UNKNOWN',
};

function transactionClient() {
  return {
    company: { findUnique: vi.fn().mockResolvedValue({ id: 'company-1' }) },
    vehicle: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'vehicle-1', internalNumber: 'RNT-001' }),
      update: vi.fn().mockResolvedValue({ id: 'vehicle-1', internalNumber: 'RNT-001' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    rental: { findFirst: vi.fn().mockResolvedValue(null) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
}

describe('Server Actions управления автопарком', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAccessMock.mockResolvedValue({ user: { id: 'user-1', email: 'admin@pilot.test' } });
  });

  it('создаёт машину и sanitised audit в одной tenant-scoped транзакции', async () => {
    const database = transactionClient();
    transactionMock.mockImplementation((callback: (tx: typeof database) => unknown) =>
      callback(database),
    );

    const result = await createVehicleAction(null, formData(baseInput));

    expect(result).toEqual({ ok: true, vehicleId: 'vehicle-1' });
    expect(requireAccessMock).toHaveBeenCalledWith('company-1');
    expect(database.vehicle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-1' }),
      }),
    );
    expect(database.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityType: 'VEHICLE', entityLabel: 'Автомобиль RNT-001' }),
      }),
    );
    expect(JSON.stringify(database.auditLog.create.mock.calls[0]?.[0])).not.toContain('XW8ZZZ');
    expect(JSON.stringify(database.auditLog.create.mock.calls[0]?.[0])).not.toContain('А429');
  });

  it('не изменяет автомобиль чужой компании', async () => {
    const database = transactionClient();
    database.vehicle.findFirst.mockResolvedValueOnce(null);
    transactionMock.mockImplementation((callback: (tx: typeof database) => unknown) =>
      callback(database),
    );

    const result = await updateVehicleAction(
      null,
      formData({ ...baseInput, vehicleId: 'vehicle-foreign' }),
    );

    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(requireAccessMock).toHaveBeenCalledWith('company-1');
    expect(database.vehicle.updateMany).not.toHaveBeenCalled();
    expect(database.auditLog.create).not.toHaveBeenCalled();
  });

  it('обновляет только tenant-scoped автомобиль и добавляет audit в той же транзакции', async () => {
    const database = transactionClient();
    database.vehicle.findFirst
      .mockResolvedValueOnce({ id: 'vehicle-1', internalNumber: 'RNT-001' })
      .mockResolvedValueOnce(null);
    transactionMock.mockImplementation((callback: (tx: typeof database) => unknown) =>
      callback(database),
    );

    const result = await updateVehicleAction(
      null,
      formData({ ...baseInput, vehicleId: 'vehicle-1' }),
    );

    expect(result).toEqual({ ok: true, vehicleId: 'vehicle-1' });
    expect(database.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'vehicle-1' } }),
    );
    expect(database.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'UPDATE' }) }),
    );
  });

  it('возвращает стабильную ошибку дубликата номера', async () => {
    const database = transactionClient();
    database.vehicle.findFirst.mockResolvedValueOnce({
      id: 'vehicle-existing',
      registrationNumberNormalized: 'А429АУ97',
      vinNormalized: null,
      internalNumber: 'RNT-999',
    });
    transactionMock.mockImplementation((callback: (tx: typeof database) => unknown) =>
      callback(database),
    );

    const result = await createVehicleAction(null, formData(baseInput));

    expect(result).toMatchObject({
      ok: false,
      code: 'DUPLICATE',
      fieldErrors: { registrationNumber: expect.any(Array) },
    });
  });

  it('не архивирует автомобиль с подтверждённой или активной арендой', async () => {
    const database = transactionClient();
    database.vehicle.findFirst.mockResolvedValueOnce({
      id: 'vehicle-1',
      internalNumber: 'RNT-001',
    });
    database.rental.findFirst.mockResolvedValueOnce({ id: 'rental-1' });
    transactionMock.mockImplementation((callback: (tx: typeof database) => unknown) =>
      callback(database),
    );

    const result = await archiveVehicleAction(
      null,
      formData({ companyId: 'company-1', vehicleId: 'vehicle-1' }),
    );

    expect(result).toMatchObject({ ok: false, code: 'ACTIVE_RENTAL' });
    expect(database.vehicle.updateMany).not.toHaveBeenCalled();
  });

  it('не считает DRAFT, CANCELLED и COMPLETED аренды блокирующими архив', async () => {
    const database = transactionClient();
    database.vehicle.findFirst.mockResolvedValueOnce({
      id: 'vehicle-1',
      internalNumber: 'RNT-001',
    });
    database.rental.findFirst.mockImplementation(async ({ where }) =>
      where.status.in.includes('DRAFT') ? { id: 'draft-rental' } : null,
    );
    transactionMock.mockImplementation((callback: (tx: typeof database) => unknown) =>
      callback(database),
    );

    const result = await archiveVehicleAction(
      null,
      formData({ companyId: 'company-1', vehicleId: 'vehicle-1' }),
    );

    expect(result).toEqual({ ok: true, vehicleId: 'vehicle-1' });
    expect(database.rental.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['CONFIRMED', 'ACTIVE'] } }),
      }),
    );
    expect(database.vehicle.updateMany).toHaveBeenCalledOnce();
  });

  it('преобразует конфликт уникальности базы данных в стабильную ошибку поля', async () => {
    transactionMock.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['companyId', 'registrationNumberNormalized'] },
    });

    const result = await createVehicleAction(null, formData(baseInput));

    expect(result).toMatchObject({
      ok: false,
      code: 'DUPLICATE',
      fieldErrors: { registrationNumber: expect.any(Array) },
    });
  });

  it('преобразует serializable-конфликт в стабильный результат', async () => {
    transactionMock.mockRejectedValue({ code: 'P2034' });

    const result = await createVehicleAction(null, formData(baseInput));

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
  });
});
