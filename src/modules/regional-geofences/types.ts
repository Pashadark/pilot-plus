export type RegionalGeofenceState =
  'INSIDE' | 'APPROACHING' | 'OUTSIDE_PENDING' | 'OUTSIDE' | 'RETURNED';

export interface RussianRegionOption {
  code: string;
  name: string;
  automaticEnforcementAllowed: boolean;
}

export interface RentalRegionalGeofenceView {
  rentalId: string;
  enabled: boolean;
  version: number;
  regionCodes: string[];
  warningDistanceKm: number;
  attentionDistanceKm: number;
  criticalDistanceKm: number;
  state: RegionalGeofenceState;
  lastDistanceKm: number | null;
  regions: RussianRegionOption[];
  updatedAt: string;
}

export interface RegionalGeofenceMapView {
  rentalId: string;
  enabled: boolean;
  version: number;
  state: RegionalGeofenceState;
  lastDistanceKm: number | null;
  regions: RussianRegionOption[];
  geometry: {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  };
  regionFeatures: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      properties: { code: string; name: string };
      geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
    }>;
  };
}
