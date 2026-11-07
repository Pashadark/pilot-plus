import { SERVICE_ZONE, nextServiceVisitState, type ServiceVisitSnapshot } from '../service-zone';

type PersistedVisit = ServiceVisitSnapshot & {
  id: string;
  notificationQueuedAt: Date | null;
};

type ServiceVisitDatabase = {
  vehicleServiceVisit: {
    findFirst(args: unknown): Promise<PersistedVisit | null>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<unknown>;
  };
  telegramGroupBinding?: {
    findUnique(args: unknown): Promise<{ telegramChatId: string } | null>;
  };
  botNotificationJob?: {
    createMany(args: unknown): Promise<unknown>;
  };
};

export type VehicleServicePosition = {
  companyId: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  recordedAt: Date;
  receivedAt: Date;
};

export async function processVehicleServicePosition(
  database: ServiceVisitDatabase,
  input: VehicleServicePosition,
) {
  const active = await database.vehicleServiceVisit.findFirst({
    where: { companyId: input.companyId, vehicleId: input.vehicleId, exitedAt: null },
    orderBy: [{ enteredAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      enteredAt: true,
      lastInsideAt: true,
      confirmedAt: true,
      exitedAt: true,
      notificationQueuedAt: true,
    },
  });
  const transition = nextServiceVisitState({
    latitude: input.latitude,
    longitude: input.longitude,
    recordedAt: input.recordedAt,
    observedAt: input.receivedAt,
    activeVisit: active,
  });

  if (transition.type === 'ENTER') {
    await createVisit(database, input, input.recordedAt);
  } else if (transition.type === 'RESET') {
    if (active) {
      await database.vehicleServiceVisit.update({
        where: { id: active.id },
        data: { exitedAt: input.recordedAt },
      });
    }
    await createVisit(database, input, input.recordedAt);
  } else if (transition.type === 'EXIT') {
    if (active) {
      await database.vehicleServiceVisit.update({
        where: { id: active.id },
        data: { exitedAt: input.recordedAt },
      });
    }
  } else if (transition.type === 'CONFIRM' && active) {
    const notificationQueued = await enqueueServiceArrival(database, input, active.id);
    await database.vehicleServiceVisit.update({
      where: { id: active.id },
      data: {
        confirmedAt: input.recordedAt,
        lastInsideAt: input.recordedAt,
        ...(notificationQueued ? { notificationQueuedAt: input.recordedAt } : {}),
      },
    });
  } else if (transition.type === 'CONTINUE' && active) {
    const notificationQueued =
      active.confirmedAt && !active.notificationQueuedAt
        ? await enqueueServiceArrival(database, input, active.id)
        : false;
    await database.vehicleServiceVisit.update({
      where: { id: active.id },
      data: {
        lastInsideAt: input.recordedAt,
        ...(notificationQueued ? { notificationQueuedAt: input.recordedAt } : {}),
      },
    });
  }

  return transition;
}

async function createVisit(
  database: ServiceVisitDatabase,
  input: VehicleServicePosition,
  enteredAt: Date,
) {
  return database.vehicleServiceVisit.create({
    data: {
      companyId: input.companyId,
      vehicleId: input.vehicleId,
      enteredAt,
      lastInsideAt: enteredAt,
    },
    select: { id: true },
  });
}

async function enqueueServiceArrival(
  database: ServiceVisitDatabase,
  input: VehicleServicePosition,
  visitId: string,
) {
  if (!database.telegramGroupBinding?.findUnique || !database.botNotificationJob?.createMany) {
    return false;
  }
  const binding = await database.telegramGroupBinding.findUnique({
    where: { companyId: input.companyId },
    select: { telegramChatId: true },
  });
  if (!binding) return false;

  await database.botNotificationJob.createMany({
    data: [
      {
        companyId: input.companyId,
        chatId: binding.telegramChatId,
        template: 'OPERATIONAL_ALERT',
        eventKey: `service-arrival:${visitId}`,
        payload: {
          kind: 'SERVICE_CENTER_ARRIVAL',
          vehicleId: input.vehicleId,
          visitId,
          recordedAt: input.recordedAt.toISOString(),
          serviceAddress: SERVICE_ZONE.address,
        },
        availableAt: input.recordedAt,
      },
    ],
    skipDuplicates: true,
  });
  return true;
}
