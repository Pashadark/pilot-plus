import 'server-only';

import { prisma } from '@/database/prisma/client';
import { buildRentalSnapshot, type RentalSnapshot } from '@/modules/rentals/domain/build-snapshot';
import { calculateRental } from '@/modules/rentals/domain/calculate-rental';
import { resolveRentalMileagePolicy } from '@/modules/rentals/domain/mileage-policy';
import { generateRentalDocx } from '@/modules/rentals/documents/docx/generate-docx';
import { convertDocxToPdf } from '@/modules/rentals/documents/pdf/convert-docx-to-pdf';
import { getRentalAccess, RentalAccessDeniedError } from '@/modules/rentals/server/access';
import { decryptField } from '@/services/security/field-encryption';

function text(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function dateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

function safeMinor(value: bigint | number | null | undefined, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const result = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error('Сумма черновика договора недействительна.');
  }
  return result;
}

function draftIssuance(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return {};
  const raw = (snapshot as { issuance?: unknown }).issuance;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function optionalString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalInteger(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (value === null || value === undefined || value === '') return undefined;
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(result) && result >= 0 ? result : undefined;
}

function decrypt(value: string | null, key: string) {
  return value ? decryptField(value, key) : '';
}

export async function generateDraftRentalPreviewPdf(rentalId: string) {
  const access = await getRentalAccess();
  if (!access) throw new RentalAccessDeniedError();

  const rental = await prisma.rental.findFirst({
    where: {
      id: rentalId,
      status: 'DRAFT',
      ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
    },
    select: {
      id: true,
      companyId: true,
      clientId: true,
      vehicleId: true,
      agreementType: true,
      startsAt: true,
      endsAt: true,
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
  if (!rental) throw new Error('Черновик договора не найден.');

  const [company, client, vehicle] = await Promise.all([
    prisma.company.findFirst({
      where: { id: rental.companyId },
      select: {
        id: true,
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
    prisma.client.findFirst({
      where: { id: rental.clientId, companyId: rental.companyId, archivedAt: null },
      select: {
        id: true,
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
    prisma.vehicle.findFirst({
      where: { id: rental.vehicleId, companyId: rental.companyId, archivedAt: null },
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
  ]);
  if (!company || !client || !vehicle) {
    throw new Error('Данные черновика договора недоступны.');
  }

  const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('Ключ данных клиентов не настроен.');

  const issuance = draftIssuance(rental.snapshot);
  const calculation = calculateRental({
    startsAt: rental.startsAt,
    endsAt: rental.endsAt,
    dailyMinor: safeMinor(rental.dailyRateMinor),
    discountMinor: safeMinor(rental.discountMinor),
    serviceMinor: safeMinor(rental.servicesMinor),
  });
  const mileage = resolveRentalMileagePolicy({
    agreementType: rental.agreementType,
    billableDays: rental.billableDays,
    includedMileageKm: rental.includedMileageKm,
  });

  const snapshot = buildRentalSnapshot({
    confirmedReady: false,
    company: {
      id: company.id,
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
      id: client.id,
      fullName: [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' '),
      phone: decrypt(client.phoneEncrypted, encryptionKey),
      passport: decrypt(client.passportEncrypted, encryptionKey),
      birthDate: dateOnly(client.birthDate),
      registrationAddress:
        decrypt(client.registrationAddressEncrypted, encryptionKey) || undefined,
      residentialAddress: decrypt(client.actualAddressEncrypted, encryptionKey) || undefined,
      licenseNumber: decrypt(client.driverLicenseEncrypted, encryptionKey) || undefined,
      licenseIssuedAt: dateOnly(client.driverLicenseIssuedAt),
      licenseExpiresAt: dateOnly(client.driverLicenseExpiresAt),
    },
    vehicle: {
      id: vehicle.id,
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
      year: vehicle.manufacturedYear ?? undefined,
      color: text(vehicle.color) || undefined,
      bodyType: text(vehicle.bodyType) || undefined,
      transmission: text(vehicle.transmission) || undefined,
      fuelType: text(vehicle.fuelType) || undefined,
      seats: vehicle.seats ?? undefined,
      includedMileageKm: mileage.dailyLimitKm ?? undefined,
      overageMileagePriceMinor: safeMinor(
        rental.overageMileagePriceMinor ?? vehicle.overageMileagePriceMinor,
      ),
      missingFuelPriceMinor: safeMinor(
        rental.missingFuelPriceMinor ?? vehicle.missingFuelPriceMinor,
      ),
    },
    rental: {
      id: rental.id,
      startsAt: rental.startsAt,
      endsAt: rental.endsAt,
      calculatedTotalMinor: calculation.calculatedTotalMinor,
      agreedTotalMinor: safeMinor(rental.totalPriceMinor),
      currency: rental.currency,
      days: rental.billableDays,
      discountMinor: safeMinor(rental.discountMinor),
      servicesMinor: safeMinor(rental.servicesMinor),
      depositMinor: optionalInteger(issuance, 'depositMinor') ?? safeMinor(rental.depositMinor),
      pickupAddress:
        optionalString(issuance, 'pickupAddress') || text(company.defaultPickupAddress) || undefined,
      returnAddress:
        optionalString(issuance, 'returnAddress') || text(company.defaultReturnAddress) || undefined,
      conditions: optionalString(issuance, 'conditions'),
      createdByUserId: rental.createdByUserId,
      createdAt: rental.createdAt,
    },
  });

  const previewSnapshot = {
    ...snapshot,
    agreementType: rental.agreementType,
    issuance: {
      pickupAddress: optionalString(issuance, 'pickupAddress'),
      returnAddress: optionalString(issuance, 'returnAddress'),
      startMileageKm: optionalInteger(issuance, 'startMileageKm'),
      returnMileageKm: optionalInteger(issuance, 'returnMileageKm'),
      startFuelPercent: optionalInteger(issuance, 'startFuelPercent'),
      returnFuelPercent: optionalInteger(issuance, 'returnFuelPercent'),
      territory: optionalString(issuance, 'territory'),
      paymentTerms: optionalString(issuance, 'paymentTerms'),
      allowedDrivers: optionalString(issuance, 'allowedDrivers'),
      conditions: optionalString(issuance, 'conditions'),
    },
  } as RentalSnapshot;

  const docx = await generateRentalDocx(previewSnapshot, { contractNumber: 'ЧЕРНОВИК' });
  return convertDocxToPdf(docx);
}
