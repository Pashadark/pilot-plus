export type OnlineMapStatus = 'moving' | 'idle' | 'offline' | 'no-data';

export type OnlineMapFilter = 'all' | OnlineMapStatus;

export interface OnlineMapVehicle {
  id: string;
  name: string;
  plate: string;
  status: OnlineMapStatus;
  longitude: number | null;
  latitude: number | null;
  speedKph: number;
  fuelPercent: number | null;
  lastSeenLabel: string;
  address: string;
  currentRental?: {
    id: string;
    contractNumber: string | null;
    clientName: string;
  } | null;
}
