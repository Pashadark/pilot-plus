import { vehicleTrackFixtures } from './track-fixtures';
import type { VehicleTrack } from './track-types';

export function getVehicleTrackDates(vehicleId: string): readonly string[] {
  return vehicleTrackFixtures
    .filter((track) => track.vehicleId === vehicleId)
    .map((track) => track.date)
    .sort((left, right) => right.localeCompare(left));
}

export function getVehicleTrack(vehicleId: string, date: string): VehicleTrack | null {
  return vehicleTrackFixtures.find(
    (track) => track.vehicleId === vehicleId && track.date === date,
  ) ?? null;
}

export function getVehicleTracks(
  vehicleId: string,
  dates: readonly string[],
): readonly VehicleTrack[] {
  const requestedDates = new Set(dates);
  return vehicleTrackFixtures
    .filter((track) => track.vehicleId === vehicleId && requestedDates.has(track.date))
    .sort((left, right) => right.date.localeCompare(left.date));
}
