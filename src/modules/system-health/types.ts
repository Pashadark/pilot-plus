export type ServiceHealthState = 'healthy' | 'unavailable' | 'unconfigured';

export interface ServiceHealthStatus {
  status: ServiceHealthState;
  latencyMs: number;
  checkedAt: string;
}

export interface ServiceHealth extends ServiceHealthStatus {
  key: 'api' | 'postgresql' | 'redis' | 'mqtt';
  label: string;
  message: string;
}

export interface SystemHealthSummary {
  state: 'healthy' | 'degraded' | 'unavailable';
  count: number;
  checkedAt: string;
}
