import { PILOT_BUSINESS_TIME_ZONE } from '@/shared/business-time';

import type { OnlineMapTrackHistoryDto, VehicleTrack } from './track-types';

export function attachFinesToTracks(history: OnlineMapTrackHistoryDto): readonly VehicleTrack[] {
  return history.tracks.map((track) => ({
    ...track,
    events: [
      ...track.events,
      ...history.fines
        .filter(
          (fine) => fine.coordinates !== null && formatMoscowDate(fine.offenseAt) === track.date,
        )
        .map((fine) => ({
          id: `fine-${fine.id}`,
          type: 'fine' as const,
          pointId: fine.pointId ?? `fine-${fine.id}`,
          title: `Штраф · ${formatMoney(fine.amountMinor)}`,
          description: fine.description ?? 'Нарушение ПДД',
          coordinates: fine.coordinates ?? undefined,
          timestamp: formatMoscowTime(fine.offenseAt),
          speedKph: 0,
          address: fine.address ?? 'Адрес не указан',
          fine,
        })),
    ],
  }));
}

function formatMoscowDate(value: string): string {
  const date = new Date(value);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PILOT_BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatMoscowTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: PILOT_BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function formatMoney(amountMinor: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(amountMinor / 100))} ₽`;
}
