export type ServiceHealthState = 'healthy' | 'unavailable' | 'unconfigured';

export interface ServiceHealthStatus {
  status: ServiceHealthState;
  latencyMs: number;
  checkedAt: string;
}

export interface ServiceHealth extends ServiceHealthStatus {
  key: 'postgresql' | 'redis' | 'mqtt';
  label: string;
  message: string;
}
