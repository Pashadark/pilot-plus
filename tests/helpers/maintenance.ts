import { prisma } from '../../src/database/prisma/client';

export const E2E_MAINTENANCE_TITLE_PREFIX = `[Pilot+ E2E maintenance:${process.pid}] `;
const createdPositionIds: string[] = [];

export async function createE2EMaintenanceOdometerPosition() {
  const email = process.env.PILOT_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('Для E2E-позиции ТО нужен PILOT_ADMIN_EMAIL.');

  const vehicle = await prisma.vehicle.findFirst({
    where: { company: { members: { some: { user: { email } } } } },
    orderBy: { internalNumber: 'asc' },
    select: { id: true },
  });
  if (!vehicle) throw new Error('Автомобиль для E2E-позиции ТО не найден.');

  const position = await prisma.vehiclePosition.create({
    data: {
      vehicleId: vehicle.id,
      latitude: 55.7558,
      longitude: 37.6176,
      odometerKm: 12_000,
      recordedAt: new Date(Date.now() + 60_000),
    },
    select: { id: true },
  });
  createdPositionIds.push(position.id);
  return vehicle.id;
}

export async function cleanupE2EMaintenanceRecords() {
  const email = process.env.PILOT_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error('Для очистки E2E-записей ТО нужен PILOT_ADMIN_EMAIL.');
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    throw new Error('Администратор для очистки E2E-записей ТО не найден.');
  }

  await prisma.maintenanceRecord.deleteMany({
    where: {
      title: { startsWith: E2E_MAINTENANCE_TITLE_PREFIX },
      vehicle: { company: { members: { some: { userId: user.id } } } },
    },
  });

  if (createdPositionIds.length) {
    await prisma.vehiclePosition.deleteMany({ where: { id: { in: createdPositionIds } } });
  }

  await prisma.$disconnect();
}
