import {
  buildTimewebSnapshot,
  formatTimewebAlert,
  shouldEnqueueTimewebAlert,
  type TimewebMonitorSnapshot,
} from './timeweb-monitor';

const API_BASE = 'https://api.timeweb.cloud/api/v1';

export async function requestTimewebJson(
  path: string,
  token: string,
  fetcher: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await fetcher(path, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('TIMEWEB_API_UNAVAILABLE');
  }
  if (!response.ok) throw new Error(`TIMEWEB_API_${response.status}`);
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error('TIMEWEB_API_INVALID_JSON');
  }
}

export interface TimewebNotificationCreateManyArgs {
  data: Array<{
    companyId: string;
    chatId: string;
    template: 'SYSTEM_BILLING_ALERT';
    eventKey: string;
    payload: { message: string; parseMode: 'HTML' };
    availableAt: Date;
  }>;
  skipDuplicates: true;
}

export interface TimewebMonitorWorkerDependencies {
  now(): Date;
  request(path: string, token: string): Promise<unknown>;
  readSnapshot(): Promise<TimewebMonitorSnapshot | null>;
  writeSnapshot(snapshot: TimewebMonitorSnapshot): Promise<void>;
  findGroup(companyId: string): Promise<{ telegramChatId: string } | null>;
  enqueue(args: TimewebNotificationCreateManyArgs): Promise<{ count: number }>;
}

function eventKey(companyId: string, depletesAt: string | null) {
  const cycle = depletesAt?.slice(0, 13).replaceAll(':', '-') ?? 'unknown';
  return `timeweb-balance-low:${companyId}:${cycle}`;
}

export async function runTimewebMonitor(
  input: { token: string; companyId: string },
  dependencies: TimewebMonitorWorkerDependencies,
) {
  const previous = await dependencies.readSnapshot();
  const [finances, servers] = await Promise.all([
    dependencies.request(`${API_BASE}/account/finances`, input.token),
    dependencies.request(`${API_BASE}/servers`, input.token),
  ]);
  const checkedAt = dependencies.now();
  const snapshot = buildTimewebSnapshot(finances, servers, previous, checkedAt);

  if (shouldEnqueueTimewebAlert(previous, snapshot)) {
    const group = await dependencies.findGroup(input.companyId);
    if (group) {
      await dependencies.enqueue({
        data: [
          {
            companyId: input.companyId,
            chatId: group.telegramChatId,
            template: 'SYSTEM_BILLING_ALERT',
            eventKey: eventKey(input.companyId, snapshot.depletesAt),
            payload: { message: formatTimewebAlert(snapshot), parseMode: 'HTML' },
            availableAt: checkedAt,
          },
        ],
        skipDuplicates: true,
      });
      snapshot.alertActive = true;
    }
  }

  await dependencies.writeSnapshot(snapshot);
  return snapshot;
}
