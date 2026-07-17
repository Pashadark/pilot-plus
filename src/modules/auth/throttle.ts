import { prisma } from '@/database/prisma/client';

const MAX_FAILED_ATTEMPTS = 5;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;

export async function isLoginLocked(email: string, now = new Date()): Promise<boolean> {
  const throttle = await prisma.loginThrottle.findUnique({ where: { email } });
  return Boolean(throttle?.lockedUntil && throttle.lockedUntil > now);
}

export async function recordLoginFailure(email: string, now = new Date()): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const current = await transaction.loginThrottle.findUnique({ where: { email } });
    const seriesExpired =
      !current?.lastFailedAt ||
      now.getTime() - current.lastFailedAt.getTime() >= THROTTLE_WINDOW_MS;
    const failedAttempts = seriesExpired ? 1 : current.failedAttempts + 1;
    const lockedUntil =
      failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + THROTTLE_WINDOW_MS) : null;

    await transaction.loginThrottle.upsert({
      where: { email },
      create: { email, failedAttempts, lastFailedAt: now, lockedUntil },
      update: { failedAttempts, lastFailedAt: now, lockedUntil },
    });
  });
}

export async function clearLoginFailures(email: string): Promise<void> {
  await prisma.loginThrottle.deleteMany({ where: { email } });
}
