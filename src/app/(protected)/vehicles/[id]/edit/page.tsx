import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/database/prisma/client';
import { requireVehicleManagementAccess } from '@/modules/vehicles/manage/access';
import { VehicleForm } from '@/modules/vehicles/manage/components/VehicleForm';
import { VehicleGallery } from '@/modules/vehicles/manage/components/VehicleGallery';
import { VehicleDocumentsPanel } from '@/modules/vehicles/manage/components/VehicleDocumentsPanel';
import { ArchiveVehiclePanel } from '@/modules/vehicles/manage/components/ArchiveVehiclePanel';
import { latestFuelLevelPercent } from '@/modules/vehicles/current-fuel';
import {
  driveTypeCodeFromFeatures,
  fuelConsumptionFromFeatures,
} from '@/modules/vehicles/technical-features';
import { AppShell } from '@/shared/components/app-shell/AppShell';

function moneyFromMinor(value: bigint | null) {
  if (value === null) return '';
  const rubles = value / BigInt(100);
  const kopecks = (value % BigInt(100)).toString().padStart(2, '0');
  return `${rubles}.${kopecks}`;
}

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, archivedAt: null },
    select: {
      id: true,
      companyId: true,
      internalNumber: true,
      registrationNumber: true,
      make: true,
      modelName: true,
      manufacturedYear: true,
      vin: true,
      city: true,
      dailyPriceMinor: true,
      transmission: true,
      fuelType: true,
      seats: true,
      status: true,
      isRentalReady: true,
      color: true,
      category: true,
      bodyType: true,
      features: true,
      engineLiters: true,
      odometerKm: true,
      valueMinor: true,
      rangePriceMinor: true,
      depositMinor: true,
      includedMileageKm: true,
      overageMileagePriceMinor: true,
      missingFuelPriceMinor: true,
      office: true,
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
      positions: {
        where: { provider: 'GLONASSSOFT', fuelLevelPercent: { not: null } },
        select: { fuelLevelPercent: true, recordedAt: true },
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
      rentalOperations: {
        where: {
          status: 'COMMITTED',
          type: { in: ['HANDOVER', 'RETURN'] },
          fuelLevelPercent: { not: null },
        },
        select: { fuelLevelPercent: true, occurredAt: true },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 1,
      },
      fuelRecords: {
        where: { levelPercent: { not: null } },
        select: { levelPercent: true, recordedAt: true },
        orderBy: { recordedAt: 'desc' },
        take: 1,
      },
      company: { select: { name: true } },
      images: {
        select: { id: true, localPath: true, alt: true, isPrimary: true },
        orderBy: { position: 'asc' },
      },
      documents: {
        select: {
          id: true,
          title: true,
          type: true,
          expiresAt: true,
          originalName: true,
          storageKey: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!vehicle) notFound();
  await requireVehicleManagementAccess(vehicle.companyId);
  if (
    !vehicle.registrationNumber ||
    !vehicle.make ||
    !vehicle.modelName ||
    !vehicle.manufacturedYear
  )
    notFound();

  return (
    <AppShell
      breadcrumbs={[
        { label: 'СУПА ПРО', href: '/' },
        { label: 'Автомобили', href: '/vehicles' },
        { label: vehicle.modelName, href: `/vehicles/${vehicle.id}` },
        { label: 'Редактирование' },
      ]}
    >
      <main className="mx-auto grid w-full max-w-4xl gap-5 p-4 sm:p-6">
        <div>
          <Link
            href={`/vehicles/${vehicle.id}`}
            className="text-sm font-semibold text-[var(--color-primary)]"
          >
            ← К автомобилю
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Редактировать автомобиль
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Изменения сохраняются в журнале действий компании.
          </p>
        </div>
        <VehicleForm
          companies={[{ id: vehicle.companyId, label: vehicle.company.name, canArchive: true }]}
          vehicle={{
            id: vehicle.id,
            companyId: vehicle.companyId,
            internalNumber: vehicle.internalNumber,
            registrationNumber: vehicle.registrationNumber,
            make: vehicle.make,
            model: vehicle.modelName,
            year: vehicle.manufacturedYear,
            vin: vehicle.vin,
            city: vehicle.city,
            dailyPriceRubles: (vehicle.dailyPriceMinor / 100).toFixed(2),
            transmission: vehicle.transmission,
            fuelType: vehicle.fuelType,
            seats: vehicle.seats,
            status: vehicle.status,
            isRentalReady: vehicle.isRentalReady,
            color: vehicle.color,
            category: vehicle.category,
            bodyType: vehicle.bodyType,
            engineLiters: vehicle.engineLiters?.toString() ?? null,
            driveType: driveTypeCodeFromFeatures(vehicle.features),
            fuelConsumptionLitersPer100Km:
              fuelConsumptionFromFeatures(vehicle.features)?.toString() ?? null,
            odometerKm: vehicle.odometerKm?.toString() ?? null,
            fuelLevelPercent: latestFuelLevelPercent(
              {
                value: vehicle.positions[0]?.fuelLevelPercent,
                recordedAt: vehicle.positions[0]?.recordedAt,
              },
              {
                value: vehicle.rentalOperations[0]?.fuelLevelPercent,
                recordedAt: vehicle.rentalOperations[0]?.occurredAt,
              },
              {
                value: vehicle.fuelRecords[0]?.levelPercent,
                recordedAt: vehicle.fuelRecords[0]?.recordedAt,
              },
            ),
            valueRubles: moneyFromMinor(vehicle.valueMinor),
            rangePriceRubles: moneyFromMinor(vehicle.rangePriceMinor),
            depositRubles: moneyFromMinor(vehicle.depositMinor),
            includedMileageKm: vehicle.includedMileageKm,
            overageMileagePriceRubles: moneyFromMinor(vehicle.overageMileagePriceMinor),
            missingFuelPriceRubles: moneyFromMinor(vehicle.missingFuelPriceMinor),
            office: vehicle.office,
            registrationCertificateNumber: vehicle.registrationCertificateNumber,
            vehiclePassportNumber: vehicle.vehiclePassportNumber,
            osagoInsurer: vehicle.osagoInsurer,
            osagoPolicyNumber: vehicle.osagoPolicyNumber,
            osagoStartsAt: vehicle.osagoStartsAt?.toISOString().slice(0, 10) ?? '',
            osagoEndsAt: vehicle.osagoEndsAt?.toISOString().slice(0, 10) ?? '',
            cascoInsurer: vehicle.cascoInsurer,
            cascoPolicyNumber: vehicle.cascoPolicyNumber,
            cascoStartsAt: vehicle.cascoStartsAt?.toISOString().slice(0, 10) ?? '',
            cascoEndsAt: vehicle.cascoEndsAt?.toISOString().slice(0, 10) ?? '',
          }}
        />
        <VehicleGallery vehicleId={vehicle.id} images={vehicle.images} />
        <VehicleDocumentsPanel
          vehicleId={vehicle.id}
          compact
          documents={vehicle.documents.map((document) => ({
            id: document.id,
            title: document.title,
            type: document.type,
            expiresAt: document.expiresAt?.toISOString() ?? null,
            originalName: document.originalName,
            hasFile: Boolean(document.storageKey),
          }))}
        />
        <ArchiveVehiclePanel
          companyId={vehicle.companyId}
          vehicleId={vehicle.id}
          vehicleLabel={`${vehicle.make} ${vehicle.modelName} · ${vehicle.registrationNumber}`}
        />
      </main>
    </AppShell>
  );
}
