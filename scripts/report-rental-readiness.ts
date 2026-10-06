import { prisma } from '../src/database/prisma/client';
import { evaluateClientReadiness } from '../src/modules/rentals/readiness/evaluate-client-readiness';
import { evaluateVehicleReadiness } from '../src/modules/rentals/readiness/evaluate-vehicle-readiness';

async function buildReport() {
  const now = new Date();
  const [clients, vehicles, confirmedRentals, overdueActiveRentals] = await Promise.all([
    prisma.client.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        status: true,
        phoneEncrypted: true,
        passportEncrypted: true,
        driverLicenseEncrypted: true,
        driverLicenseExpiresAt: true,
        documents: {
          where: { archivedAt: null, category: { in: ['PASSPORT', 'DRIVER_LICENSE'] } },
          select: {
            category: true,
            archivedAt: true,
            currentVersion: true,
            versions: { select: { version: true, scanVerdict: true } },
          },
        },
      },
    }),
    prisma.vehicle.findMany({
      where: { archivedAt: null, isDemoImport: false },
      select: {
        id: true,
        archivedAt: true,
        isRentalReady: true,
        registrationNumber: true,
        vin: true,
        registrationCertificateNumber: true,
        vehiclePassportNumber: true,
        osagoInsurer: true,
        osagoPolicyNumber: true,
        osagoStartsAt: true,
        osagoEndsAt: true,
        dailyPriceMinor: true,
        depositMinor: true,
        cascoPolicyNumber: true,
      },
    }),
    prisma.rental.findMany({
      where: { status: 'CONFIRMED' },
      select: {
        totalPriceMinor: true,
        depositMinor: true,
        documentVersions: { where: { format: 'PDF' }, select: { id: true }, take: 1 },
        signatures: { select: { party: true, status: true } },
        payments: {
          where: { status: 'CONFIRMED' },
          select: { kind: true, amountMinor: true },
        },
      },
    }),
    prisma.rental.count({ where: { status: 'ACTIVE', endsAt: { lt: now } } }),
  ]);

  const clientsMissingDocuments = clients.filter(
    (client) =>
      !evaluateClientReadiness(
        {
          id: client.id,
          status: client.status,
          phone: client.phoneEncrypted,
          passport: client.passportEncrypted,
          driverLicense: client.driverLicenseEncrypted,
          driverLicenseExpiresAt: client.driverLicenseExpiresAt,
          documents: client.documents,
        },
        now,
      ).ready,
  ).length;
  const vehiclesWithLegalBlockers = vehicles.filter(
    (vehicle) => !evaluateVehicleReadiness(vehicle).ready,
  ).length;
  const confirmedMissingPdf = confirmedRentals.filter(
    (rental) => rental.documentVersions.length === 0,
  ).length;
  const confirmedMissingSignatures = confirmedRentals.filter(
    (rental) =>
      !rental.signatures.some(
        (signature) => signature.party === 'CLIENT' && signature.status === 'SIGNED',
      ) ||
      !rental.signatures.some(
        (signature) => signature.party === 'COMPANY' && signature.status === 'SIGNED',
      ),
  ).length;
  const confirmedMissingRentPayment = confirmedRentals.filter((rental) => {
    const paid = rental.payments
      .filter((payment) => payment.kind === 'RENT')
      .reduce((total, payment) => total + payment.amountMinor, BigInt(0));
    return paid < rental.totalPriceMinor;
  }).length;
  const confirmedMissingDeposit = confirmedRentals.filter((rental) => {
    const required = rental.depositMinor ?? BigInt(0);
    if (required <= BigInt(0)) return false;
    const paid = rental.payments
      .filter((payment) => payment.kind === 'DEPOSIT')
      .reduce((total, payment) => total + payment.amountMinor, BigInt(0));
    return paid < required;
  }).length;

  return {
    checkedAt: now.toISOString(),
    clientsMissingDocuments,
    vehiclesWithLegalBlockers,
    confirmedRentals: confirmedRentals.length,
    confirmedMissingPdf,
    confirmedMissingSignatures,
    confirmedMissingRentPayment,
    confirmedMissingDeposit,
    overdueActiveRentals,
  };
}

buildReport()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch(() => {
    console.error('Не удалось построить агрегированный отчёт готовности.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
