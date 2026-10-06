import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readTimewebSnapshotFile, writeTimewebSnapshotFile } from './timeweb-monitor-storage';
import type { TimewebMonitorSnapshot } from './timeweb-monitor';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

const snapshot: TimewebMonitorSnapshot = {
  checkedAt: '2026-10-07T09:00:00.000Z',
  balance: 2450,
  currency: 'RUB',
  hourlyCost: 14.5,
  dailyCost: 348,
  monthlyCost: 10_440,
  hoursLeft: 160,
  depletesAt: '2026-10-14T01:00:00.000Z',
  autopayEnabled: false,
  discountPercent: 0,
  discountEndsAt: null,
  alertActive: true,
  servers: [{ name: 'Mysterious Lacerta', status: 'on' }],
};

async function path() {
  const directory = await mkdtemp(join(tmpdir(), 'pilot-timeweb-'));
  directories.push(directory);
  return join(directory, 'monitor.json');
}

describe('Timeweb monitor snapshot storage', () => {
  it('writes and reads a validated sanitized snapshot atomically', async () => {
    const target = await path();

    await writeTimewebSnapshotFile(target, snapshot);

    expect(await readTimewebSnapshotFile(target)).toEqual(snapshot);
    expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(snapshot);
  });

  it('returns null for absent, malformed or structurally invalid snapshots', async () => {
    const target = await path();
    expect(await readTimewebSnapshotFile(target)).toBeNull();
    await writeFile(target, '{broken', 'utf8');
    expect(await readTimewebSnapshotFile(target)).toBeNull();
    await writeFile(target, JSON.stringify({ ...snapshot, hoursLeft: '160' }), 'utf8');
    expect(await readTimewebSnapshotFile(target)).toBeNull();
  });
});
