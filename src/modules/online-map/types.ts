export type OnlineMapStatus = 'moving' | 'idle' | 'offline';

export type OnlineMapFilter = 'all' | OnlineMapStatus;

export interface OnlineMapVehicle {
  id: string;
  name: string;
  plate: string;
  status: OnlineMapStatus;
  longitude: number;
  latitude: number;
  speedKph: number;
  fuelPercent: number;
  lastSeenLabel: string;
  address: string;
}
