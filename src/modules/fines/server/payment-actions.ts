'use server';

import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import type { FineInvoiceStatus } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { decryptField } from '@/services/security/field-encryption';

import { FineAccessDeniedError, requireFineViewAccess } from '../access';
import { DriverHelperClient } from '../integrations/driver-helper/client';
import { validateDriverHelperPaymentUrl } from '../integrations/driver-helper/payment-url';
import { PAYMENT_AUDIT_ACTOR_SNAPSHOT } from './payment-audit';
import { createFinePaymentState } from './payment-state';

type PaymentErrorCode =
  'VALIDATION' | 'FORBIDDEN' | 'NOT_PAYABLE' | 'INTEGRATION_UNAVAILABLE' | 'PAYMENT_UNAVAILABLE';

export type FinePaymentActionResult =
  | {
      ok: true;
      fineIds: string[];
      fineAmountMinor: string;
      commissionAmountMinor: string;
      totalAmountMinor: string;
      sandbox: true;
    }
  | { ok: false; code: PaymentErrorCode; message: string };

export type CreateFineInvoiceActionResult =
  | { ok: true; invoiceId: string; paymentUrl: string | null; reused: boolean }
  | { ok: false; code: PaymentErrorCode; message: string };

const MAX_FINE_IDS = 50;
const ACTIVE_INVOICE_STATUSES: readonly FineInvoiceStatus[] = ['PENDING', 'CREATED'];
const messages: Record<PaymentErrorCode, string> = {
  VALIDATION: 'Выберите от одного до 50 штрафов.',
  FORBIDDEN: 'Оплата штрафов запрещена.',
  NOT_PAYABLE: 'Выбранные штрафы недоступны для оплаты.',
  INTEGRATION_UNAVAILABLE: 'Интеграция Driver Helper не настроена.',
  PAYMENT_UNAVAILABLE: 'Не удалось подготовить тестовую оплату.',
};

function failure(code: PaymentErrorCode) {
  return { ok: false as const, code, message: messages[code] };
}

function parsePaymentInput(formData: FormData): { companyId: string; fineIds: string[] } | null {
  const rawCompanyId = formData.get('companyId');
  const rawFineIds = formData.getAll('fineIds');
  const fineIds = rawFineIds.map((value) => (typeof value === 'string' ? value.trim() : ''));
  if (
    typeof rawCompanyId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,191}$/u.test(rawCompanyId) ||
    fineIds.length === 0 ||
    fineIds.length > MAX_FINE_IDS ||
    fineIds.some((id) => !/^[A-Za-z0-9_-]{1,191}$/u.test(id)) ||
    new Set(fineIds).size !== fineIds.length
  ) {
    return null;
  }
  return { companyId: rawCompanyId, fineIds: [...fineIds].sort() };
}

export async function requireFinePaymentAccess(companyId: string) {
  const access = await requireFineViewAccess(companyId);
  const role =
    access.user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : access.rolesByCompany[companyId];
  if (role !== 'SUPER_ADMIN' && role !== 'COMPANY_ADMIN') throw new FineAccessDeniedError();
  return access;
}

async function loadPayableFines(companyId: string, fineIds: string[]) {
  const loaded = await prisma.fine.findMany({
    where: { companyId, id: { in: fineIds } },
    select: { id: true, companyId: true, externalId: true, status: true },
  });
  if (
    loaded.length !== fineIds.length ||
    loaded.some(
      (fine) =>
        fine.companyId !== companyId ||
        !fineIds.includes(fine.id) ||
        !/^\d+$/u.test(fine.externalId) ||
        fine.status === 'PAID' ||
        fine.status === 'CANCELLED' ||
        fine.status === 'ARCHIVED',
    )
  ) {
    return null;
  }
  return loaded.sort((left, right) => left.id.localeCompare(right.id));
}

async function paymentClient(
  companyId: string,
  callbacks?: ConstructorParameters<typeof DriverHelperClient>[0]['paymentCallbacks'],
) {
  const integration = await prisma.fineIntegration.findUnique({
    where: { companyId },
    select: { tokenEncrypted: true, enabled: true },
  });
  const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!integration?.enabled || !encryptionKey) return null;
  const token = decryptField(integration.tokenEncrypted, encryptionKey);
  return new DriverHelperClient({ token, ...(callbacks ? { paymentCallbacks: callbacks } : {}) });
}

async function authorizedSelection(formData: FormData) {
  const input = parsePaymentInput(formData);
  if (!input) return { error: failure('VALIDATION') } as const;
  try {
    const access = await requireFinePaymentAccess(input.companyId);
    const fines = await loadPayableFines(input.companyId, input.fineIds);
    if (!fines) return { error: failure('NOT_PAYABLE') } as const;
    return { input, access, fines } as const;
  } catch (error) {
    return {
      error: failure(error instanceof FineAccessDeniedError ? 'FORBIDDEN' : 'PAYMENT_UNAVAILABLE'),
    } as const;
  }
}

export async function checkFinePaymentAction(
  _previousState: FinePaymentActionResult | null,
  formData: FormData,
): Promise<FinePaymentActionResult> {
  const selection = await authorizedSelection(formData);
  if ('error' in selection && selection.error) return selection.error;
  try {
    const client = await paymentClient(selection.input.companyId);
    if (!client) return failure('INTEGRATION_UNAVAILABLE');
    const amounts = await client.checkInvoice(selection.fines.map(({ externalId }) => externalId));
    return {
      ok: true,
      fineIds: selection.input.fineIds,
      ...amounts,
      sandbox: true,
    };
  } catch {
    return failure('PAYMENT_UNAVAILABLE');
  }
}

function idempotencyKey(companyId: string, userId: string, fineIds: string[]): string {
  return createHash('sha256')
    .update(JSON.stringify({ companyId, userId, fineIds }), 'utf8')
    .digest('hex');
}

function isConcurrencyConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

async function activeInvoice(key: string) {
  const invoice = await prisma.fineInvoice.findUnique({
    where: { idempotencyKey: key },
    select: { id: true, status: true },
  });
  return invoice && ACTIVE_INVOICE_STATUSES.includes(invoice.status) ? invoice : null;
}

export async function createSandboxFineInvoiceAction(
  _previousState: CreateFineInvoiceActionResult | null,
  formData: FormData,
): Promise<CreateFineInvoiceActionResult> {
  const selection = await authorizedSelection(formData);
  if ('error' in selection && selection.error) return selection.error;

  let persistedPending: {
    id: string;
    amounts: {
      fineAmountMinor: string;
      commissionAmountMinor: string;
      totalAmountMinor: string;
    };
  } | null = null;
  try {
    const key = idempotencyKey(
      selection.input.companyId,
      selection.access.user.id,
      selection.input.fineIds,
    );
    const reusable = await activeInvoice(key);
    if (reusable) {
      return { ok: true, invoiceId: reusable.id, paymentUrl: null, reused: true };
    }

    const checkClient = await paymentClient(selection.input.companyId);
    if (!checkClient) return failure('INTEGRATION_UNAVAILABLE');
    const externalIds = selection.fines.map(({ externalId }) => externalId);
    const amounts = await checkClient.checkInvoice(externalIds);
    let pending: { id: string; status: FineInvoiceStatus; reused: boolean };
    try {
      pending = await prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.fineInvoice.findUnique({
            where: { idempotencyKey: key },
            select: { id: true, status: true },
          });
          if (existing && ACTIVE_INVOICE_STATUSES.includes(existing.status)) {
            return { ...existing, reused: true };
          }
          if (existing) {
            const rotated = await transaction.fineInvoice.updateMany({
              where: { id: existing.id, idempotencyKey: key, status: existing.status },
              data: { idempotencyKey: `${key}:inactive:${existing.id}` },
            });
            if (rotated.count !== 1) throw { code: 'P2002' };
            await transaction.fineInvoiceItem.updateMany({
              where: {
                companyId: selection.input.companyId,
                invoiceId: existing.id,
                active: true,
              },
              data: { active: false },
            });
          }

          const currentFines = await transaction.fine.findMany({
            where: { companyId: selection.input.companyId, id: { in: selection.input.fineIds } },
            select: { id: true, companyId: true, externalId: true, status: true },
          });
          if (
            currentFines.length !== selection.input.fineIds.length ||
            currentFines.some(
              (fine) =>
                fine.companyId !== selection.input.companyId ||
                fine.status === 'PAID' ||
                fine.status === 'CANCELLED' ||
                fine.status === 'ARCHIVED',
            )
          ) {
            throw new Error('Fine selection changed');
          }

          const invoice = await transaction.fineInvoice.create({
            data: {
              companyId: selection.input.companyId,
              status: 'PENDING',
              sandbox: true,
              fineAmountMinor: BigInt(amounts.fineAmountMinor),
              commissionAmountMinor: BigInt(amounts.commissionAmountMinor),
              totalAmountMinor: BigInt(amounts.totalAmountMinor),
              initiatedByUserId: selection.access.user.id,
              idempotencyKey: key,
              items: {
                create: selection.input.fineIds.map((fineId) => ({
                  companyId: selection.input.companyId,
                  fineId,
                  active: true,
                })),
              },
            },
            select: { id: true, status: true },
          });
          await transaction.auditLog.create({
            data: {
              companyId: selection.input.companyId,
              actorUserId: selection.access.user.id,
              actorEmailSnapshot: PAYMENT_AUDIT_ACTOR_SNAPSHOT,
              action: 'CREATE',
              entityType: 'FINE',
              entityId: invoice.id,
              entityLabel: 'Sandbox-счёт штрафов',
              changes: {
                status: 'PENDING',
                fineIds: selection.input.fineIds,
                fineCount: selection.input.fineIds.length,
                ...amounts,
                sandbox: true,
              },
            },
            select: { id: true },
          });
          return { ...invoice, reused: false };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (!isConcurrencyConflict(error)) throw error;
      const existing = await activeInvoice(key);
      if (!existing) throw error;
      pending = { ...existing, reused: true };
    }

    if (pending.reused) {
      return { ok: true, invoiceId: pending.id, paymentUrl: null, reused: true };
    }
    persistedPending = { id: pending.id, amounts };

    const callbackBase = process.env.FINE_PAYMENT_CALLBACK_BASE_URL;
    const stateSecret = process.env.FINE_PAYMENT_STATE_SECRET;
    if (!callbackBase || !stateSecret) throw new Error('Payment callback configuration missing');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const commonState = {
      companyId: selection.input.companyId,
      invoiceId: pending.id,
      userId: selection.access.user.id,
      nonce: randomBytes(18).toString('base64url'),
      expiresAt,
    };
    const createClient = await paymentClient(selection.input.companyId, {
      successUrl: new URL('/fines/payment/success', callbackBase).toString(),
      failUrl: new URL('/fines/payment/fail', callbackBase).toString(),
      successState: createFinePaymentState({ ...commonState, outcome: 'success' }, stateSecret),
      failState: createFinePaymentState({ ...commonState, outcome: 'fail' }, stateSecret),
    });
    if (!createClient) throw new Error('Payment integration unavailable');
    const created = await createClient.createSandboxInvoice({ ids: externalIds, sandbox: true });
    const safePayment = validateDriverHelperPaymentUrl(created.paymentUrl);
    if (
      !safePayment ||
      created.fineAmountMinor !== amounts.fineAmountMinor ||
      created.commissionAmountMinor !== amounts.commissionAmountMinor ||
      created.totalAmountMinor !== amounts.totalAmountMinor
    ) {
      throw new Error('Payment response mismatch');
    }

    await prisma.$transaction(
      async (transaction) => {
        const updated = await transaction.fineInvoice.updateMany({
          where: { id: pending.id, companyId: selection.input.companyId, status: 'PENDING' },
          data: {
            status: 'CREATED',
            providerInvoiceId: created.providerInvoiceId,
            paymentHost: safePayment.paymentHost,
          },
        });
        if (updated.count !== 1) throw new Error('Invoice state conflict');
        await transaction.auditLog.create({
          data: {
            companyId: selection.input.companyId,
            actorUserId: selection.access.user.id,
            actorEmailSnapshot: PAYMENT_AUDIT_ACTOR_SNAPSHOT,
            action: 'UPDATE',
            entityType: 'FINE',
            entityId: pending.id,
            entityLabel: 'Sandbox-счёт штрафов',
            changes: {
              status: 'CREATED',
              fineIds: selection.input.fineIds,
              fineCount: selection.input.fineIds.length,
              ...amounts,
              sandbox: true,
            },
          },
          select: { id: true },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    persistedPending = null;
    return { ok: true, invoiceId: pending.id, paymentUrl: safePayment.paymentUrl, reused: false };
  } catch {
    if (persistedPending) {
      const failedInvoice = persistedPending;
      try {
        await prisma.$transaction(
          async (transaction) => {
            const updated = await transaction.fineInvoice.updateMany({
              where: {
                id: failedInvoice.id,
                companyId: selection.input.companyId,
                status: 'PENDING',
              },
              data: { status: 'ERROR' },
            });
            if (updated.count !== 1) return;
            await transaction.fineInvoiceItem.updateMany({
              where: {
                companyId: selection.input.companyId,
                invoiceId: failedInvoice.id,
                active: true,
              },
              data: { active: false },
            });
            await transaction.auditLog.create({
              data: {
                companyId: selection.input.companyId,
                actorUserId: selection.access.user.id,
                actorEmailSnapshot: PAYMENT_AUDIT_ACTOR_SNAPSHOT,
                action: 'UPDATE',
                entityType: 'FINE',
                entityId: failedInvoice.id,
                entityLabel: 'Sandbox-счёт штрафов',
                changes: {
                  status: 'ERROR',
                  fineIds: selection.input.fineIds,
                  fineCount: selection.input.fineIds.length,
                  ...failedInvoice.amounts,
                  sandbox: true,
                },
              },
              select: { id: true },
            });
          },
          { isolationLevel: 'Serializable' },
        );
      } catch {
        // A stale PENDING row is reconciled by the bounded invoice worker in Task 6.
      }
    }
    return failure('PAYMENT_UNAVAILABLE');
  }
}
