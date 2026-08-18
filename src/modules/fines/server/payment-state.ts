import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { FineInvoiceStatus, Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

export type FinePaymentOutcome = 'success' | 'fail';

export interface FinePaymentState {
  companyId: string;
  invoiceId: string;
  userId: string;
  outcome: FinePaymentOutcome;
  nonce: string;
  expiresAt: Date;
}

interface SerializedFinePaymentState {
  c: string;
  i: string;
  u: string;
  o: FinePaymentOutcome;
  n: string;
  e: number;
}

interface VerifyFinePaymentStateOptions {
  secret: string | undefined;
  expectedOutcome: FinePaymentOutcome;
  now?: Date;
}

const identifierPattern = /^[A-Za-z0-9_-]{1,191}$/u;
const statePartPattern = /^[A-Za-z0-9_-]+$/u;

function validSecret(secret: string | undefined): secret is string {
  return typeof secret === 'string' && Buffer.byteLength(secret, 'utf8') >= 32;
}

function signature(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload, 'utf8').digest();
}

function isSerializedState(value: unknown): value is SerializedFinePaymentState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<SerializedFinePaymentState>;
  return (
    typeof candidate.c === 'string' &&
    identifierPattern.test(candidate.c) &&
    typeof candidate.i === 'string' &&
    identifierPattern.test(candidate.i) &&
    typeof candidate.u === 'string' &&
    identifierPattern.test(candidate.u) &&
    (candidate.o === 'success' || candidate.o === 'fail') &&
    typeof candidate.n === 'string' &&
    identifierPattern.test(candidate.n) &&
    typeof candidate.e === 'number' &&
    Number.isSafeInteger(candidate.e) &&
    candidate.e > 0
  );
}

export function createFinePaymentState(state: FinePaymentState, secret: string): string {
  if (!validSecret(secret)) throw new Error('Подпись callback оплаты не настроена.');
  const serialized: SerializedFinePaymentState = {
    c: state.companyId,
    i: state.invoiceId,
    u: state.userId,
    o: state.outcome,
    n: state.nonce,
    e: state.expiresAt.getTime(),
  };
  if (!isSerializedState(serialized)) throw new Error('Некорректный callback оплаты.');
  const payload = Buffer.from(JSON.stringify(serialized), 'utf8').toString('base64url');
  return `${payload}.${signature(payload, secret).toString('base64url')}`;
}

export function verifyFinePaymentState(
  token: string | null,
  options: VerifyFinePaymentStateOptions,
): FinePaymentState | null {
  if (!token || token.length > 4096 || !validSecret(options.secret)) return null;
  const [payload, encodedSignature, extra] = token.split('.');
  if (
    extra !== undefined ||
    !payload ||
    !encodedSignature ||
    !statePartPattern.test(payload) ||
    !statePartPattern.test(encodedSignature)
  ) {
    return null;
  }

  try {
    const providedSignature = Buffer.from(encodedSignature, 'base64url');
    if (
      providedSignature.toString('base64url') !== encodedSignature ||
      providedSignature.length !== 32 ||
      !timingSafeEqual(providedSignature, signature(payload, options.secret))
    ) {
      return null;
    }
    if (Buffer.from(payload, 'base64url').toString('base64url') !== payload) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
    if (!isSerializedState(parsed)) return null;
    if (parsed.o !== options.expectedOutcome || parsed.e <= (options.now ?? new Date()).getTime()) {
      return null;
    }
    return {
      companyId: parsed.c,
      invoiceId: parsed.i,
      userId: parsed.u,
      outcome: parsed.o,
      nonce: parsed.n,
      expiresAt: new Date(parsed.e),
    };
  } catch {
    return null;
  }
}

type CallbackStatus = Extract<FineInvoiceStatus, 'SUCCEEDED' | 'FAILED'>;

export async function consumeFinePaymentCallback(
  state: FinePaymentState,
  options: { actor: { id: string; email: string }; status: CallbackStatus },
): Promise<boolean> {
  if (state.userId !== options.actor.id) return false;

  return prisma.$transaction(
    async (transaction) => {
      const invoice = await transaction.fineInvoice.findFirst({
        where: {
          id: state.invoiceId,
          companyId: state.companyId,
          initiatedByUserId: state.userId,
          status: 'CREATED',
          sandbox: true,
        },
        select: {
          id: true,
          fineAmountMinor: true,
          commissionAmountMinor: true,
          totalAmountMinor: true,
          sandbox: true,
          items: { select: { fineId: true }, orderBy: { fineId: 'asc' } },
        },
      });
      if (!invoice) return false;

      const updated = await transaction.fineInvoice.updateMany({
        where: {
          id: state.invoiceId,
          companyId: state.companyId,
          initiatedByUserId: state.userId,
          status: 'CREATED',
          sandbox: true,
        },
        data: { status: options.status },
      });
      if (updated.count !== 1) return false;

      await transaction.auditLog.create({
        data: {
          companyId: state.companyId,
          actorUserId: options.actor.id,
          actorEmailSnapshot: options.actor.email,
          action: 'UPDATE',
          entityType: 'FINE',
          entityId: invoice.id,
          entityLabel: 'Sandbox-счёт штрафов',
          changes: {
            status: options.status,
            fineIds: invoice.items.map(({ fineId }) => fineId),
            fineCount: invoice.items.length,
            fineAmountMinor: invoice.fineAmountMinor.toString(),
            commissionAmountMinor: invoice.commissionAmountMinor.toString(),
            totalAmountMinor: invoice.totalAmountMinor.toString(),
            sandbox: invoice.sandbox,
          } satisfies Prisma.InputJsonObject,
        },
        select: { id: true },
      });
      return true;
    },
    { isolationLevel: 'Serializable' },
  );
}
