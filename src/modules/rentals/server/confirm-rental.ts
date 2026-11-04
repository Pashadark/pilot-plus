import 'server-only';

import { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { buildRentalSnapshot } from '@/modules/rentals/domain/build-snapshot';
import { resolveRentalMileagePolicy } from '@/modules/rentals/domain/mileage-policy';
import { isLegalTemplateVersion } from '@/modules/rentals/documents/legal-content-v1';
import { evaluateClientReadiness } from '@/modules/rentals/readiness/evaluate-client-readiness';
import { evaluateVehicleReadiness } from '@/modules/rentals/readiness/evaluate-vehicle-readiness';
import { decryptField } from '@/services/security/field-encryption';

import { requireRentalAccess } from './access';

type Actor = { id: string; email: string };
type ConfirmationTransaction = {
  rental: {
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
    update(args: unknown): Promise<{ id: string }>;
  };
  company: { findFirst(args: unknown): Promise<Record<string, unknown> | null> };
  client: { findFirst(args: unknown): Promise<Record<string, unknown> | null> };
  vehicle: { findFirst(args: unknown): Promise<Record<string, unknown> | null> };
  contractTemplateVersion: { findFirst(args: unknown): Promise<Record<string, unknown> | null> };
  clientDocument: { findMany(args: unknown): Promise<Array<Record<string, unknown>>> };
  rentalNumberCounter: { upsert(args: unknown): Promise<{ nextValue: number }> };
  companyMember?: { findFirst(args: unknown): Promise<{ id: string } | null> };
  user?: { findFirst(args: unknown): Promise<{ id: string } | null> };
  auditLog: { create(args: unknown): Promise<unknown> };
};

type ConfirmationDatabase = {
  transaction<T>(work: (transaction: ConfirmationTransaction) => Promise<T>): Promise<T>;
};
type Authorization = { scope: 'SYSTEM' | 'COMPANY'; actor: Actor };
type ConfirmationOptions = { decrypt?: (value: string) => string; now?: () => Date };

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function date(value: unknown): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime()))
    throw new Error('Некорректная дата аренды.');
  return value;
}
function safeMinor(value: unknown): number {
  const minor = typeof value === 'bigint' ? value : BigInt(typeof value === 'number' ? value : -1);
  if (minor < 0 || minor > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Сумма договора должна быть безопасным неотрицательным minor unit.');
  return Number(minor);
}
function money(value: unknown): bigint {
  if (typeof value !== 'bigint' || value < 0) throw new Error('Сумма договора недействительна.');
  return value;
}
function optionalSafeMinor(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : safeMinor(value);
}
function dateOnly(value: unknown): string | undefined {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().slice(0, 10)
    : undefined;
}
function decrypted(value: unknown, decrypt: (value: string) => string): string {
  const encrypted = text(value);
  return encrypted ? decrypt(encrypted) : '';
}
function fullName(client: Record<string, unknown>): string {
  return [text(client.lastName), text(client.firstName), text(client.middleName)]
    .filter(Boolean)
    .join(' ');
}
function draftIssuance(snapshot: unknown) {
  const raw =
    typeof snapshot === 'object' && snapshot !== null && 'issuance' in snapshot
      ? (snapshot as { issuance?: unknown }).issuance
      : null;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const string = (key: string, maximum = 500) => {
    const value = text(source[key]).trim();
    if (!value) return undefined;
    if (value.length > maximum || /[\u0000-\u001f]/u.test(value))
      throw new Error('Данные выдачи и возврата некорректны.');
    return value;
  };
  const integer = (key: string, maximum: number) => {
    const value = source[key];
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum)
      throw new Error('Показатели выдачи и возврата некорректны.');
    return parsed;
  };
  return {
    pickupAddress: string('pickupAddress'),
    returnAddress: string('returnAddress'),
    conditions: string('conditions', 2000),
    startMileageKm: integer('startMileageKm', 9_999_999),
    returnMileageKm: integer('returnMileageKm', 9_999_999),
    startFuelPercent: integer('startFuelPercent', 100),
    returnFuelPercent: integer('returnFuelPercent', 100),
    territory: string('territory'),
    paymentTerms: string('paymentTerms'),
    allowedDrivers: string('allowedDrivers', 1000),
    depositMinor: integer('depositMinor', Number.MAX_SAFE_INTEGER),
  };
}
function moscowYear(value: Date): number {
  const year = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
  }).format(value);
  return Number(year);
}
function contractNumber(year: number, value: number): string {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Некорректный номер договора.');
  return `ME-${year}-${String(value).padStart(4, '0')}-BK`;
}
export async function allocateRentalContractNumber(
  counter: { upsert(args: unknown): Promise<{ nextValue: number }> },
  companyId: string,
  confirmedAt: Date,
): Promise<string> {
  const year = moscowYear(confirmedAt);
  const result = await counter.upsert({
    where: { companyId_year: { companyId, year } },
    create: { companyId, year, nextValue: 2 },
    update: { nextValue: { increment: 1 } },
    select: { nextValue: true },
  });
  return contractNumber(year, result.nextValue - 1);
}

export function createRentalConfirmation(
  database: ConfirmationDatabase,
  options: ConfirmationOptions = {},
) {
  const decrypt = options.decrypt ?? ((value: string) => value);
  const now = options.now ?? (() => new Date());
  return async function confirm(input: {
    companyId: string;
    rentalId: string;
    actor?: Actor;
    authorization?: Authorization;
  }) {
    return database.transaction(async (transaction) => {
      if (input.authorization?.scope === 'COMPANY') {
        const membership = await transaction.companyMember?.findFirst({
          where: {
            companyId: input.companyId,
            userId: input.authorization.actor.id,
            role: { in: ['COMPANY_ADMIN', 'DISPATCHER'] },
          },
          select: { id: true },
        });
        if (!membership) throw new Error('Доступ к договорам аренды запрещён.');
      }
      if (input.authorization?.scope === 'SYSTEM') {
        const superAdmin = await transaction.user?.findFirst({
          where: { id: input.authorization.actor.id, role: 'SUPER_ADMIN', isActive: true },
          select: { id: true },
        });
        if (!superAdmin) throw new Error('Доступ к договорам аренды запрещён.');
      }

      const rental = await transaction.rental.findFirst({
        where: { id: input.rentalId, companyId: input.companyId, status: 'DRAFT' },
        select: {
          id: true,
          companyId: true,
          clientId: true,
          vehicleId: true,
          templateVersionId: true,
          startsAt: true,
          endsAt: true,
          status: true,
          agreementType: true,
          currency: true,
          dailyRateMinor: true,
          billableDays: true,
          basePriceMinor: true,
          discountMinor: true,
          servicesMinor: true,
          totalPriceMinor: true,
          depositMinor: true,
          includedMileageKm: true,
          overageMileagePriceMinor: true,
          missingFuelPriceMinor: true,
          createdByUserId: true,
          createdAt: true,
          snapshot: true,
        },
      });
      if (!rental) throw new Error('Черновик аренды недоступен или уже подтверждён.');
      const startsAt = date(rental.startsAt);
      const endsAt = date(rental.endsAt);
      if (endsAt <= startsAt) throw new Error('Некорректный период аренды.');
      const issuance = draftIssuance(rental.snapshot);

      const [company, client, vehicle, template, documents] = await Promise.all([
        transaction.company.findFirst({
          where: { id: input.companyId },
          select: {
            id: true,
            status: true,
            legalName: true,
            inn: true,
            legalAddress: true,
            actualAddress: true,
            phone: true,
            email: true,
            kpp: true,
            ogrn: true,
            entrepreneurName: true,
            lessorBirthDate: true,
            lessorPassportEncrypted: true,
            ogrnip: true,
            bankName: true,
            settlementAccount: true,
            correspondentAccount: true,
            bik: true,
            contractCity: true,
            defaultPickupAddress: true,
            defaultReturnAddress: true,
            signatoryName: true,
            signatoryAuthority: true,
          },
        }),
        transaction.client.findFirst({
          where: { id: rental.clientId, companyId: input.companyId, archivedAt: null },
          select: {
            id: true,
            isRentalReady: true,
            firstName: true,
            middleName: true,
            lastName: true,
            birthDate: true,
            phoneEncrypted: true,
            passportEncrypted: true,
            registrationAddressEncrypted: true,
            actualAddressEncrypted: true,
            driverLicenseEncrypted: true,
            driverLicenseIssuedAt: true,
            driverLicenseExpiresAt: true,
          },
        }),
        transaction.vehicle.findFirst({
          where: {
            id: rental.vehicleId,
            companyId: input.companyId,
            archivedAt: null,
            isRentalReady: true,
          },
          select: {
            id: true,
            make: true,
            modelName: true,
            registrationNumber: true,
            vin: true,
            dailyPriceMinor: true,
            depositMinor: true,
            registrationCertificateNumber: true,
            vehiclePassportNumber: true,
            osagoInsurer: true,
            osagoPolicyNumber: true,
            osagoStartsAt: true,
            osagoEndsAt: true,
            cascoInsurer: true,
            cascoPolicyNumber: true,
            cascoStartsAt: true,
            cascoEndsAt: true,
            manufacturedYear: true,
            color: true,
            bodyType: true,
            transmission: true,
            fuelType: true,
            seats: true,
            includedMileageKm: true,
            overageMileagePriceMinor: true,
            missingFuelPriceMinor: true,
          },
        }),
        transaction.contractTemplateVersion.findFirst({
          where: { id: rental.templateVersionId, companyId: input.companyId, isPublished: true },
          select: {
            id: true,
            version: true,
            documentSchemaVersion: true,
            legalContentVersion: true,
          },
        }),
        transaction.clientDocument.findMany({
          where: {
            companyId: input.companyId,
            clientId: rental.clientId,
            category: { in: ['PASSPORT', 'DRIVER_LICENSE'] },
            archivedAt: null,
          },
          select: {
            category: true,
            archivedAt: true,
            currentVersion: true,
            versions: {
              where: { scanVerdict: 'CLEAN' },
              select: { version: true, scanVerdict: true },
            },
          },
        }),
      ]);
      if (!company || !client || !vehicle || !template)
        throw new Error('Связанные данные аренды недоступны.');
      if (template.documentSchemaVersion !== 1)
        throw new Error('Версия шаблона несовместима со снимком договора.');
      const legalContentVersion = text(template.legalContentVersion) || 'legal-content-v1';
      if (!isLegalTemplateVersion(legalContentVersion))
        throw new Error('Версия юридического текста не поддерживается.');
      const clientReadiness = evaluateClientReadiness(
        {
          id: text(client.id),
          status: text(client.status),
          phone: decrypted(client.phoneEncrypted, decrypt),
          passport: decrypted(client.passportEncrypted, decrypt),
          driverLicense: decrypted(client.driverLicenseEncrypted, decrypt),
          driverLicenseExpiresAt:
            client.driverLicenseExpiresAt instanceof Date ? client.driverLicenseExpiresAt : null,
          documents: documents as unknown as Parameters<
            typeof evaluateClientReadiness
          >[0]['documents'],
        },
        now(),
      );
      if (!clientReadiness.ready)
        throw new Error(`Не готовы документы клиента: ${clientReadiness.blockers[0]?.message}`);

      const vehicleReadiness = evaluateVehicleReadiness(
        {
          id: text(vehicle.id),
          archivedAt: null,
          isRentalReady: vehicle.isRentalReady === true,
          registrationNumber: text(vehicle.registrationNumber),
          vin: text(vehicle.vin),
          registrationCertificateNumber: text(vehicle.registrationCertificateNumber),
          vehiclePassportNumber: text(vehicle.vehiclePassportNumber),
          osagoInsurer: text(vehicle.osagoInsurer),
          osagoPolicyNumber: text(vehicle.osagoPolicyNumber),
          osagoStartsAt: vehicle.osagoStartsAt instanceof Date ? vehicle.osagoStartsAt : null,
          osagoEndsAt: vehicle.osagoEndsAt instanceof Date ? vehicle.osagoEndsAt : null,
          dailyPriceMinor:
            typeof vehicle.dailyPriceMinor === 'bigint' ||
            typeof vehicle.dailyPriceMinor === 'number'
              ? vehicle.dailyPriceMinor
              : null,
          depositMinor:
            typeof vehicle.depositMinor === 'bigint' || typeof vehicle.depositMinor === 'number'
              ? vehicle.depositMinor
              : null,
          cascoPolicyNumber: text(vehicle.cascoPolicyNumber),
        },
        { startsAt, endsAt },
      );
      if (!vehicleReadiness.ready)
        throw new Error(`Автомобиль не готов к аренде: ${vehicleReadiness.blockers[0]?.message}`);

      const overlap = await transaction.rental.findFirst({
        where: {
          companyId: input.companyId,
          vehicleId: rental.vehicleId,
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          id: { not: input.rentalId },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true },
      });
      if (overlap) throw new Error('Автомобиль уже занят на выбранный период.');

      const mileagePolicy = resolveRentalMileagePolicy({
        agreementType: text(rental.agreementType) === 'LEASE_TO_OWN' ? 'LEASE_TO_OWN' : 'STANDARD',
        billableDays: typeof rental.billableDays === 'number' ? rental.billableDays : 1,
        includedMileageKm:
          typeof rental.includedMileageKm === 'number' ? rental.includedMileageKm : null,
      });
      const snapshot = buildRentalSnapshot({
        confirmedReady: true,
        company: {
          id: text(company.id),
          legalName: text(company.legalName),
          inn: text(company.inn),
          address: text(company.legalAddress),
          kpp: text(company.kpp) || undefined,
          ogrn: text(company.ogrn) || undefined,
          actualAddress: text(company.actualAddress) || undefined,
          phone: text(company.phone) || undefined,
          email: text(company.email) || undefined,
          bankName: text(company.bankName) || undefined,
          settlementAccount: text(company.settlementAccount) || undefined,
          correspondentAccount: text(company.correspondentAccount) || undefined,
          bik: text(company.bik) || undefined,
          signatoryName: text(company.signatoryName) || undefined,
          signatoryAuthority: text(company.signatoryAuthority) || undefined,
          contractCity: text(company.contractCity) || undefined,
          entrepreneurName: text(company.entrepreneurName) || undefined,
          lessorBirthDate: dateOnly(company.lessorBirthDate),
          lessorPassportEncrypted: text(company.lessorPassportEncrypted) || undefined,
          ogrnip: text(company.ogrnip) || undefined,
          defaultPickupAddress: text(company.defaultPickupAddress) || undefined,
          defaultReturnAddress: text(company.defaultReturnAddress) || undefined,
        },
        client: {
          id: text(client.id),
          fullName: fullName(client),
          phone: decrypted(client.phoneEncrypted, decrypt),
          passport: decrypted(client.passportEncrypted, decrypt),
          birthDate: dateOnly(client.birthDate),
          registrationAddress: decrypted(client.registrationAddressEncrypted, decrypt) || undefined,
          residentialAddress: decrypted(client.actualAddressEncrypted, decrypt) || undefined,
          licenseNumber: decrypted(client.driverLicenseEncrypted, decrypt) || undefined,
          licenseIssuedAt: dateOnly(client.driverLicenseIssuedAt),
          licenseExpiresAt: dateOnly(client.driverLicenseExpiresAt),
        },
        vehicle: {
          id: text(vehicle.id),
          make: text(vehicle.make),
          model: text(vehicle.modelName),
          registrationNumber: text(vehicle.registrationNumber),
          vin: text(vehicle.vin),
          dailyMinor: safeMinor(vehicle.dailyPriceMinor),
          depositMinor: safeMinor(vehicle.depositMinor),
          registrationCertificateNumber: text(vehicle.registrationCertificateNumber) || undefined,
          vehiclePassportNumber: text(vehicle.vehiclePassportNumber) || undefined,
          osagoInsurer: text(vehicle.osagoInsurer) || undefined,
          osagoPolicyNumber: text(vehicle.osagoPolicyNumber) || undefined,
          osagoStartsAt: dateOnly(vehicle.osagoStartsAt),
          osagoEndsAt: dateOnly(vehicle.osagoEndsAt),
          cascoInsurer: text(vehicle.cascoInsurer) || undefined,
          cascoPolicyNumber: text(vehicle.cascoPolicyNumber) || undefined,
          cascoStartsAt: dateOnly(vehicle.cascoStartsAt),
          cascoEndsAt: dateOnly(vehicle.cascoEndsAt),
          year: typeof vehicle.manufacturedYear === 'number' ? vehicle.manufacturedYear : undefined,
          color: text(vehicle.color) || undefined,
          bodyType: text(vehicle.bodyType) || undefined,
          transmission: text(vehicle.transmission) || undefined,
          fuelType: text(vehicle.fuelType) || undefined,
          seats: typeof vehicle.seats === 'number' ? vehicle.seats : undefined,
          includedMileageKm: mileagePolicy.dailyLimitKm ?? undefined,
          overageMileagePriceMinor: optionalSafeMinor(vehicle.overageMileagePriceMinor),
          missingFuelPriceMinor: optionalSafeMinor(vehicle.missingFuelPriceMinor),
        },
        rental: {
          id: text(rental.id),
          startsAt,
          endsAt,
          calculatedTotalMinor: safeMinor(
            money(rental.basePriceMinor) -
              money(rental.discountMinor) +
              money(rental.servicesMinor),
          ),
          agreedTotalMinor: safeMinor(rental.totalPriceMinor),
          currency: text(rental.currency),
          days: typeof rental.billableDays === 'number' ? rental.billableDays : undefined,
          discountMinor: optionalSafeMinor(rental.discountMinor),
          servicesMinor: optionalSafeMinor(rental.servicesMinor),
          depositMinor: issuance.depositMinor ?? optionalSafeMinor(rental.depositMinor),
          pickupAddress:
            issuance.pickupAddress ?? (text(company.defaultPickupAddress) || undefined),
          returnAddress:
            issuance.returnAddress ?? (text(company.defaultReturnAddress) || undefined),
          conditions: issuance.conditions,
          createdByUserId: text(rental.createdByUserId),
          createdAt: date(rental.createdAt),
        },
      });
      const confirmedAt = now();
      const number = await allocateRentalContractNumber(
        transaction.rentalNumberCounter,
        input.companyId,
        confirmedAt,
      );
      const actor = input.authorization?.actor ?? input.actor;
      const updated = await transaction.rental.update({
        where: { id: input.rentalId },
        data: {
          status: 'CONFIRMED',
          contractNumber: number,
          confirmedAt,
          confirmedByUserId: actor?.id ?? null,
          includedMileageKm: mileagePolicy.dailyLimitKm,
          snapshotVersion: 1,
          snapshot: {
            ...snapshot,
            agreementType: rental.agreementType,
            issuance,
            template: {
              id: text(template.id),
              version: template.version,
              documentSchemaVersion: template.documentSchemaVersion,
              legalContentVersion,
            },
            confirmation: {
              confirmedAt: confirmedAt.toISOString(),
              confirmedByUserId: actor?.id ?? null,
            },
          },
        },
        select: { id: true },
      });
      if (actor)
        await transaction.auditLog.create({
          data: {
            companyId: input.companyId,
            actorUserId: actor.id,
            actorEmailSnapshot: actor.email,
            action: 'UPDATE',
            entityType: 'RENTAL',
            entityId: updated.id,
            entityLabel: 'Договор аренды',
            changes: { status: 'CONFIRMED', contractNumber: number },
          },
        });
      return { rentalId: updated.id, contractNumber: number };
    });
  };
}

export async function retrySerializable<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (!(
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034'
      ))
        throw error;
    }
  }
  throw lastError;
}

function clientEncryptionKey(): string {
  const key = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!key) throw new Error('Ключ защиты клиентских данных не настроен.');
  return key;
}
const confirmation = createRentalConfirmation(
  {
    transaction: (work) =>
      prisma.$transaction(
        (transaction) => work(transaction as unknown as ConfirmationTransaction),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
  },
  { decrypt: (value) => decryptField(value, clientEncryptionKey()) },
);

export async function confirmRental(companyId: string, rentalId: string) {
  const access = await requireRentalAccess(companyId);
  return retrySerializable(() =>
    confirmation({
      companyId,
      rentalId,
      authorization: {
        scope: access.scope,
        actor: { id: access.user.id, email: access.user.email },
      },
    }),
  );
}
