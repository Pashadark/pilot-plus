import 'server-only';

export type ClientUploadLimits = {
  windowMs: number;
  userRate: number;
  companyRate: number;
  userConcurrent: number;
  companyConcurrent: number;
  companyQuotaBytes: number;
  leaseMs: number;
};

type Count = { count: number };
type UploadPermitRepository = {
  count(args: unknown): Promise<number>;
  aggregate(args: unknown): Promise<{ _sum: { reservedBytes: number | null } }>;
  create(args: unknown): Promise<{ id: string; uploadId: string; leaseExpiresAt: Date }>;
  updateMany(args: unknown): Promise<Count>;
};

export type UploadPermitDatabase = {
  clientUploadPermit: UploadPermitRepository;
  $transaction<T>(
    operation: (transaction: { clientUploadPermit: UploadPermitRepository }) => Promise<T>,
    options?: { isolationLevel: 'Serializable' },
  ): Promise<T>;
};

type AcquireInput = {
  database: UploadPermitDatabase;
  now: Date;
  uploadId: string;
  companyId: string;
  userId: string;
  kind: 'DOCUMENT' | 'PHOTO';
  requestedBytes: number;
  privateBytes: number;
  limits: ClientUploadLimits;
};

type RejectionReason =
  'USER_RATE' | 'COMPANY_RATE' | 'USER_CONCURRENT' | 'COMPANY_CONCURRENT' | 'COMPANY_QUOTA';

export type AcquireUploadPermitResult =
  | { ok: true; permitId: string; leaseExpiresAt: Date }
  | { ok: false; reason: RejectionReason; message: string };

const rateMessage = 'Слишком много загрузок. Повторите через несколько минут.';
const concurrentMessage = 'Одновременно проверяется слишком много файлов. Повторите попытку позже.';
const quotaMessage =
  'Лимит приватного хранилища компании исчерпан. Освободите место и повторите загрузку.';

function prismaCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export function clientUploadLimitsFromEnvironment(): ClientUploadLimits {
  const integer = (
    value: string | undefined,
    fallback: number,
    minimum: number,
    maximum: number,
  ) => {
    const parsed = value ? Number.parseInt(value, 10) : fallback;
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
  };
  return {
    windowMs: integer(process.env.CLIENT_UPLOAD_RATE_WINDOW_MINUTES, 10, 1, 60) * 60_000,
    userRate: integer(process.env.CLIENT_UPLOAD_RATE_USER_MAX, 20, 1, 1_000),
    companyRate: integer(process.env.CLIENT_UPLOAD_RATE_COMPANY_MAX, 100, 1, 10_000),
    userConcurrent: integer(process.env.CLIENT_UPLOAD_CONCURRENT_USER_MAX, 2, 1, 20),
    companyConcurrent: integer(process.env.CLIENT_UPLOAD_CONCURRENT_COMPANY_MAX, 6, 1, 100),
    companyQuotaBytes:
      integer(process.env.CLIENT_PRIVATE_STORAGE_QUOTA_MB, 1024, 50, 102_400) * 1024 * 1024,
    leaseMs: integer(process.env.CLIENT_DOCUMENT_STALE_UPLOAD_MINUTES, 15, 5, 24 * 60) * 60_000,
  };
}

export async function acquireClientUploadPermit({
  database,
  now,
  uploadId,
  companyId,
  userId,
  kind,
  requestedBytes,
  privateBytes,
  limits,
}: AcquireInput): Promise<AcquireUploadPermitResult> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          const since = new Date(now.getTime() - limits.windowMs);
          const userRate = await transaction.clientUploadPermit.count({
            where: { userId, createdAt: { gte: since } },
          });
          if (userRate >= limits.userRate) {
            return { ok: false, reason: 'USER_RATE', message: rateMessage };
          }
          const companyRate = await transaction.clientUploadPermit.count({
            where: { companyId, createdAt: { gte: since } },
          });
          if (companyRate >= limits.companyRate) {
            return { ok: false, reason: 'COMPANY_RATE', message: rateMessage };
          }
          const userConcurrent = await transaction.clientUploadPermit.count({
            where: { userId, status: 'ACTIVE' },
          });
          if (userConcurrent >= limits.userConcurrent) {
            return { ok: false, reason: 'USER_CONCURRENT', message: concurrentMessage };
          }
          const companyConcurrent = await transaction.clientUploadPermit.count({
            where: { companyId, status: 'ACTIVE' },
          });
          if (companyConcurrent >= limits.companyConcurrent) {
            return { ok: false, reason: 'COMPANY_CONCURRENT', message: concurrentMessage };
          }
          const reserved = await transaction.clientUploadPermit.aggregate({
            where: { companyId, status: { in: ['ACTIVE', 'RECONCILING'] } },
            _sum: { reservedBytes: true },
          });
          if (
            privateBytes + (reserved._sum.reservedBytes ?? 0) + requestedBytes >
            limits.companyQuotaBytes
          ) {
            return { ok: false, reason: 'COMPANY_QUOTA', message: quotaMessage };
          }

          const leaseExpiresAt = new Date(now.getTime() + limits.leaseMs);
          const permit = await transaction.clientUploadPermit.create({
            data: {
              uploadId,
              companyId,
              userId,
              kind,
              status: 'ACTIVE',
              reservedBytes: requestedBytes,
              leaseExpiresAt,
            },
            select: { id: true, uploadId: true, leaseExpiresAt: true },
          });
          return { ok: true, permitId: permit.id, leaseExpiresAt: permit.leaseExpiresAt };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (!prismaCode(error, 'P2034') || attempt === 3) throw error;
    }
  }
  throw new Error('Не удалось зарезервировать ресурсы загрузки.');
}

export async function renewClientUploadPermit(
  database: UploadPermitDatabase,
  input: { uploadId: string; companyId: string; now: Date; leaseMs: number },
) {
  const result = await database.clientUploadPermit.updateMany({
    where: { uploadId: input.uploadId, companyId: input.companyId, status: 'ACTIVE' },
    data: { leaseExpiresAt: new Date(input.now.getTime() + input.leaseMs) },
  });
  return result.count === 1;
}

export async function releaseClientUploadPermit(
  database: UploadPermitDatabase,
  input: {
    uploadId: string;
    companyId: string;
    now: Date;
    status: 'COMPLETED' | 'RELEASED';
  },
) {
  const result = await database.clientUploadPermit.updateMany({
    where: { uploadId: input.uploadId, companyId: input.companyId, status: 'ACTIVE' },
    data: { status: input.status, completedAt: input.now, leaseExpiresAt: input.now },
  });
  return result.count === 1;
}
