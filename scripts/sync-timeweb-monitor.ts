import { prisma } from '../src/database/prisma/client';
import {
  requestTimewebJson,
  runTimewebMonitor,
} from '../src/modules/system-health/timeweb-monitor-worker';
import {
  readTimewebSnapshotFile,
  writeTimewebSnapshotFile,
} from '../src/modules/system-health/timeweb-monitor-storage';

const token = process.env.TIMEWEB_CLOUD_TOKEN?.trim();
const companyId = process.env.TIMEWEB_ALERT_COMPANY_ID?.trim();
const snapshotPath =
  process.env.TIMEWEB_MONITOR_SNAPSHOT_PATH?.trim() ||
  '/opt/pilot-plus/shared/timeweb-monitor.json';

async function main() {
  if (!token) throw new Error('TIMEWEB_TOKEN_MISSING');
  if (!companyId) throw new Error('TIMEWEB_ALERT_COMPANY_MISSING');

  await runTimewebMonitor(
    { token, companyId },
    {
      now: () => new Date(),
      request: requestTimewebJson,
      readSnapshot: () => readTimewebSnapshotFile(snapshotPath),
      writeSnapshot: (snapshot) => writeTimewebSnapshotFile(snapshotPath, snapshot),
      findGroup: (id) =>
        prisma.telegramGroupBinding.findUnique({
          where: { companyId: id },
          select: { telegramChatId: true },
        }),
      enqueue: (args) => prisma.botNotificationJob.createMany(args),
    },
  );
  console.log('TIMEWEB_MONITOR_UPDATED');
}

main()
  .catch((error: unknown) => {
    const code =
      error instanceof Error && /^[A-Z][A-Z0-9_]{1,63}$/u.test(error.message)
        ? error.message
        : 'TIMEWEB_MONITOR_FAILED';
    console.error(code);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
