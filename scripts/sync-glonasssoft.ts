import { prisma } from '../src/database/prisma/client';
import { runGlonassSoftScheduler } from '../src/modules/telematics/glonasssoft/scheduler';

async function main() {
  const result = await runGlonassSoftScheduler(
    {
      serviceUrl: process.env.PILOT_APP_INTERNAL_URL ?? '',
      serviceToken: process.env.PILOT_TELEMATICS_SERVICE_TOKEN ?? '',
    },
    prisma,
  );
  if (result.failed > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'GLONASSSOFT_SYNC_FATAL');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
