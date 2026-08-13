import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createRentalConfirmation, retrySerializable } from './confirm-rental';

const start = new Date('2026-08-20T09:00:00.000Z');
const end = new Date('2026-08-22T09:00:00.000Z');

function transactionFixture(overrides: Record<string, unknown> = {}) {
  const rental = {
    id: 'rental-1',
    companyId: 'company-1',
    clientId: 'client-1',
    vehicleId: 'vehicle-1',
    templateVersionId: 'template-1',
    status: 'DRAFT',
    startsAt: start,
    endsAt: end,
    currency: 'RUB',
    dailyRateMinor: BigInt(470000),
    billableDays: 2,
    basePriceMinor: BigInt(940000),
    discountMinor: BigInt(0),
    servicesMinor: BigInt(0),
    totalPriceMinor: BigInt(940000),
    depositMinor: BigInt(1000000),
    includedMileageKm: 300,
    overageMileagePriceMinor: BigInt(1000),
    missingFuelPriceMinor: BigInt(5000),
    priceOverrideReason: null,
    createdByUserId: 'creator-1',
    createdAt: new Date('2026-08-01T09:00:00.000Z'),
  };
  const update = vi.fn(async () => ({ id: rental.id }));
  const fixture = {
    rental: {
      findFirst: vi.fn(async (args: { where: { status?: unknown } }) =>
        args.where.status === 'DRAFT' ? rental : null,
      ),
      update,
    },
    company: {
      findFirst: vi.fn(async () => ({
        id: 'company-1',
        legalName: 'ООО Пилот',
        inn: '1234567890',
        legalAddress: 'Москва',
        actualAddress: 'Москва',
        phone: '+74950000000',
        email: 'rent@example.test',
        bankName: 'Банк',
        settlementAccount: '40702810000000000001',
        correspondentAccount: '30101810000000000001',
        bik: '044525225',
        signatoryName: 'Павел Седов',
        signatoryAuthority: 'Устав',
        contractCity: 'Москва',
        defaultPickupAddress: 'Выдача',
        defaultReturnAddress: 'Возврат',
      })),
    },
    client: {
      findFirst: vi.fn(async () => ({
        id: 'client-1',
        firstName: 'Иван',
        middleName: 'Иванович',
        lastName: 'Иванов',
        phoneEncrypted: '+79990000000',
        passportEncrypted: '4510 123456',
        birthDate: new Date('1990-01-02T00:00:00.000Z'),
        registrationAddressEncrypted: 'Москва',
        actualAddressEncrypted: 'Москва',
        driverLicenseEncrypted: '9910 123456',
        driverLicenseIssuedAt: new Date('2010-01-02T00:00:00.000Z'),
        driverLicenseExpiresAt: new Date('2030-01-02T00:00:00.000Z'),
      })),
    },
    vehicle: {
      findFirst: vi.fn(async () => ({
        id: 'vehicle-1',
        make: 'Volkswagen',
        modelName: 'Polo',
        registrationNumber: 'А156АХ997',
        vin: 'VIN123',
        dailyPriceMinor: 470000,
        depositMinor: BigInt(1000000),
        registrationCertificateNumber: 'СТС',
        vehiclePassportNumber: 'ПТС',
        osagoInsurer: 'Страховщик',
        osagoPolicyNumber: 'ОСАГО',
        osagoStartsAt: new Date('2026-01-01T00:00:00.000Z'),
        osagoEndsAt: new Date('2027-01-01T00:00:00.000Z'),
        cascoInsurer: 'Страховщик',
        cascoPolicyNumber: 'КАСКО',
        cascoStartsAt: new Date('2026-01-01T00:00:00.000Z'),
        cascoEndsAt: new Date('2027-01-01T00:00:00.000Z'),
        manufacturedYear: 2020,
        color: 'Белый',
        bodyType: 'Седан',
        transmission: 'AUTOMATIC',
        fuelType: 'PETROL',
        seats: 5,
        includedMileageKm: 300,
        overageMileagePriceMinor: BigInt(1000),
        missingFuelPriceMinor: BigInt(5000),
      })),
    },
    contractTemplateVersion: {
      findFirst: vi.fn(async () => ({
        id: 'template-1',
        version: 1,
        documentSchemaVersion: 1,
        isPublished: true,
      })),
    },
    clientDocument: {
      findMany: vi.fn(async () => [
        { category: 'PASSPORT', status: 'CLEAN', archivedAt: null, currentVersion: 1 },
        { category: 'DRIVER_LICENSE', status: 'CLEAN', archivedAt: null, currentVersion: 1 },
      ]),
    },
    rentalNumberCounter: { upsert: vi.fn(async () => ({ nextValue: 2 })) },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  return { ...fixture, ...overrides, update, rentalRecord: rental };
}

describe('atomic rental confirmation', () => {
  it('rejects overlapping confirmed rentals using half-open intervals', async () => {
    const transaction = transactionFixture();
    transaction.rental.findFirst.mockImplementation(
      async (args: { where: { status?: unknown } }) =>
        args.where.status === 'DRAFT'
          ? transaction.rentalRecord
          : { ...transaction.rentalRecord, id: 'occupied', status: 'CONFIRMED' },
    );
    const confirm = createRentalConfirmation({
      async transaction(work) {
        return work(transaction as never);
      },
    });
    await expect(confirm({ companyId: 'company-1', rentalId: 'rental-1' })).rejects.toThrow(
      'Автомобиль уже занят',
    );
  });

  it('numbers, snapshots, confirms, and audits a fully reloaded legal rental together', async () => {
    const transaction = transactionFixture();
    const confirm = createRentalConfirmation({
      async transaction(work) {
        return work(transaction as never);
      },
    });

    await expect(
      confirm({
        companyId: 'company-1',
        rentalId: 'rental-1',
        actor: { id: 'actor-1', email: 'a@test' },
      }),
    ).resolves.toEqual({ rentalId: 'rental-1', contractNumber: 'ME-2026-0001-BK' });
    expect(transaction.rentalNumberCounter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_year: { companyId: 'company-1', year: 2026 } },
        create: { companyId: 'company-1', year: 2026, nextValue: 2 },
      }),
    );
    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CONFIRMED',
          contractNumber: 'ME-2026-0001-BK',
          snapshotVersion: 1,
          snapshot: expect.objectContaining({
            company: expect.objectContaining({ legalName: 'ООО Пилот' }),
            client: expect.objectContaining({ passport: '4510 123456' }),
            vehicle: expect.objectContaining({ osagoPolicyNumber: 'ОСАГО' }),
          }),
        }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorUserId: 'actor-1' }) }),
    );
  });

  it('rolls back before numbering when current clean passport and licence documents are absent', async () => {
    const transaction = transactionFixture({
      clientDocument: { findMany: vi.fn(async () => [{ category: 'PASSPORT', status: 'CLEAN' }]) },
    });
    const confirm = createRentalConfirmation({
      async transaction(work) {
        return work(transaction as never);
      },
    });

    await expect(confirm({ companyId: 'company-1', rentalId: 'rental-1' })).rejects.toThrow(
      'документы клиента',
    );
    expect(transaction.rentalNumberCounter.upsert).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('retries a serializable transaction conflict no more than three times', async () => {
    const work = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockResolvedValueOnce('confirmed');

    await expect(retrySerializable(work)).resolves.toBe('confirmed');
    expect(work).toHaveBeenCalledTimes(3);
  });
});
