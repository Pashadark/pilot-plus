import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

import type { TimewebMonitorSnapshot } from './timeweb-monitor';

const optionalMetric = z.number().finite().nonnegative().nullable();
const snapshotSchema = z
  .object({
    checkedAt: z.iso.datetime(),
    balance: z.number().finite().nonnegative(),
    currency: z.string().min(1).max(8),
    hourlyCost: optionalMetric,
    dailyCost: optionalMetric,
    monthlyCost: optionalMetric,
    hoursLeft: optionalMetric,
    depletesAt: z.iso.datetime().nullable(),
    autopayEnabled: z.boolean(),
    discountPercent: z.number().finite().nonnegative(),
    discountEndsAt: z.iso.datetime().nullable(),
    alertActive: z.boolean(),
    servers: z
      .array(
        z.object({ name: z.string().min(1).max(100), status: z.string().min(1).max(40) }).strict(),
      )
      .max(50),
  })
  .strict();

export async function readTimewebSnapshotFile(
  path: string,
): Promise<TimewebMonitorSnapshot | null> {
  try {
    const parsed = snapshotSchema.safeParse(JSON.parse(await readFile(path, 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeTimewebSnapshotFile(path: string, snapshot: TimewebMonitorSnapshot) {
  const validated = snapshotSchema.parse(snapshot);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(validated)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}
