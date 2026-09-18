import { evaluateFuelStationPosition, type FuelStation } from '../detector';

type VisitDatabase = {
  fuelStation: { findMany(args: unknown): Promise<Array<FuelStation & { latitude: unknown; longitude: unknown }>> };
  fuelStationVisit: {
    findFirst(args: unknown): Promise<{ id: string; stationId: string; enteredAt: Date; lastSeenAt: Date; notifiedAt: Date | null } | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  botNotificationJob?: { createMany(args: unknown): Promise<unknown> };
  telegramGroupBinding?: { findUnique(args: unknown): Promise<{ telegramChatId: string } | null> };
};

export async function processFuelStationPosition(
  database: VisitDatabase,
  input: { companyId: string; vehicleId: string; latitude: number; longitude: number; recordedAt: Date; accuracyMeters?: number | null },
) {
  const delta = 0.003;
  const stations = (await database.fuelStation.findMany({
    where: {
      latitude: { gte: input.latitude - delta, lte: input.latitude + delta },
      longitude: { gte: input.longitude - delta, lte: input.longitude + delta },
    },
    select: { id: true, name: true, address: true, latitude: true, longitude: true },
  })).map((station) => ({ ...station, latitude: Number(station.latitude), longitude: Number(station.longitude) })) as FuelStation[];
  const active = await database.fuelStationVisit.findFirst({
    where: { vehicleId: input.vehicleId, exitedAt: null },
    orderBy: [{ enteredAt: 'desc' }, { id: 'desc' }],
  });
  const result = evaluateFuelStationPosition(input, active ? { stationId: active.stationId, enteredAt: active.enteredAt, lastSeenAt: active.lastSeenAt, notifiedAt: active.notifiedAt } : null, stations, input.recordedAt);
  if (result.kind === 'outside') return result;
  if (result.kind === 'entered') {
    await database.fuelStationVisit.create({ data: { vehicleId: input.vehicleId, stationId: result.state.stationId, enteredAt: result.state.enteredAt, lastSeenAt: result.state.lastSeenAt } });
  } else if (result.kind === 'exited') {
    if (active) await database.fuelStationVisit.update({ where: { id: active.id }, data: { exitedAt: input.recordedAt, lastSeenAt: input.recordedAt } });
  } else if (active) {
    await database.fuelStationVisit.update({ where: { id: active.id }, data: { lastSeenAt: result.state.lastSeenAt, ...(result.kind === 'possibleRefuelling' ? { notifiedAt: result.state.notifiedAt } : {}) } });
    if (result.kind === 'possibleRefuelling' && database.botNotificationJob?.createMany && database.telegramGroupBinding?.findUnique) {
      const binding = await database.telegramGroupBinding.findUnique({ where: { companyId: input.companyId }, select: { telegramChatId: true } });
      if (binding) {
        const stationLabel = [result.station.name, result.station.address].filter(Boolean).join(', ') || 'АЗС без названия';
        await database.botNotificationJob.createMany({ data: [{ companyId: input.companyId, chatId: binding.telegramChatId, template: 'OPERATIONAL_ALERT', eventKey: `fuel-station:${input.vehicleId}:${result.station.id}:${result.state.enteredAt.toISOString()}`, payload: { kind: 'FUEL_STATION_VISIT', vehicleId: input.vehicleId, stationId: result.station.id, stationLabel, enteredAt: result.state.enteredAt.toISOString(), message: `⛽ Возможная заправка. АЗС: ${stationLabel}. Въезд: ${result.state.enteredAt.toLocaleString('ru-RU')}. Стоянка: 7 мин.` }, availableAt: input.recordedAt }], skipDuplicates: true });
      }
    }
  }
  return result;
}
