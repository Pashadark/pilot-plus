import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireFineManageAccess = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const reserveFine = vi.hoisted(() => vi.fn());
const reconcileFine = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../access', () => ({
  requireFineManageAccess,
  FineAccessDeniedError: class FineAccessDeniedError extends Error {},
}));
vi.mock('@/database/prisma/client', () => ({ prisma: { $transaction: transaction } }));
vi.mock('@/modules/deposits/server/fine-reservation', () => ({
  reserveFineFromDeposit: reserveFine,
  reconcileFineDepositReservation: reconcileFine,
}));

import { assignFineAction } from './assignment-actions';

function assignmentForm(rentalId = 'rental-1') {
  const form = new FormData();
  form.set('companyId', 'company-1');
  form.set('fineId', 'fine-1');
  form.set('rentalId', rentalId);
  return form;
}

function transactionDatabase() {
  return {
    fine: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'fine-1',
        vehicleId: 'vehicle-1',
        rentalId: null,
        clientId: null,
        assignmentSource: null,
        assignmentConfirmedAt: null,
        status: 'UNPAID',
        currentAmountMinor: 250_000n,
      }),
      update: vi.fn().mockResolvedValue({ id: 'fine-1' }),
    },
    rental: {
      findFirst: vi.fn().mockResolvedValue({ id: 'rental-1', clientId: 'client-1' }),
    },
    fineAssignmentHistory: { create: vi.fn().mockResolvedValue({ id: 'history-1' }) },
    clientRatingEvent: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
}

describe('fine assignment action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireFineManageAccess.mockResolvedValue({
      user: {
        id: 'dispatcher-1',
        email: 'dispatcher@example.test',
        role: 'MEMBER',
      },
      scope: 'COMPANY',
      companyIds: ['company-1'],
      rolesByCompany: { 'company-1': 'DISPATCHER' },
    });
  });

  it('allows a dispatcher to assign a same-company rental for the fine vehicle atomically', async () => {
    const database = transactionDatabase();
    transaction.mockImplementation(
      async (operation: (client: typeof database) => Promise<unknown>) => operation(database),
    );

    await expect(assignFineAction(null, assignmentForm())).resolves.toEqual({
      ok: true,
      fineId: 'fine-1',
      assignedRentalId: 'rental-1',
    });

    expect(requireFineManageAccess).toHaveBeenCalledWith('company-1');
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(database.rental.findFirst).toHaveBeenCalledWith({
      where: { id: 'rental-1', companyId: 'company-1', vehicleId: 'vehicle-1' },
      select: { id: true, clientId: true },
    });
    expect(database.fine.update).toHaveBeenCalledWith({
      where: { companyId_id: { companyId: 'company-1', id: 'fine-1' } },
      data: expect.objectContaining({
        rentalId: 'rental-1',
        clientId: 'client-1',
        assignmentSource: 'MANUAL',
        assignmentConfirmedByUserId: 'dispatcher-1',
      }),
      select: { id: true },
    });
    expect(database.fineAssignmentHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        fineId: 'fine-1',
        vehicleId: 'vehicle-1',
        rentalId: 'rental-1',
        clientId: 'client-1',
        source: 'MANUAL',
        actorUserId: 'dispatcher-1',
      }),
      select: { id: true },
    });
    expect(database.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        actorUserId: 'dispatcher-1',
        action: 'ASSIGN',
        entityType: 'FINE',
        entityId: 'fine-1',
        entityLabel: 'Штраф',
        changes: { assigned: true, assignmentSource: 'MANUAL' },
      }),
      select: { id: true },
    });
    expect(JSON.stringify(database.auditLog.create.mock.calls)).not.toContain('client-1');
    expect(reserveFine).toHaveBeenCalledWith(
      database,
      expect.objectContaining({
        companyId: 'company-1',
        clientId: 'client-1',
        rentalId: 'rental-1',
        fineId: 'fine-1',
        fineAmountMinor: 250_000n,
      }),
    );
  });

  it('rejects a foreign or wrong-vehicle rental without changing the fine', async () => {
    const database = transactionDatabase();
    database.rental.findFirst.mockResolvedValue(null);
    transaction.mockImplementation(
      async (operation: (client: typeof database) => Promise<unknown>) => operation(database),
    );

    await expect(assignFineAction(null, assignmentForm('foreign-rental'))).resolves.toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });

    expect(database.rental.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'foreign-rental',
          companyId: 'company-1',
          vehicleId: 'vehicle-1',
        },
      }),
    );
    expect(database.fine.update).not.toHaveBeenCalled();
    expect(database.fineAssignmentHistory.create).not.toHaveBeenCalled();
    expect(database.auditLog.create).not.toHaveBeenCalled();
  });

  it('clears an assignment manually with history and PII-free audit in the same transaction', async () => {
    const database = transactionDatabase();
    database.fine.findFirst.mockResolvedValue({
      id: 'fine-1',
      vehicleId: 'vehicle-1',
      rentalId: 'rental-1',
      clientId: 'client-1',
      assignmentSource: 'AUTO_EXACT',
    });
    transaction.mockImplementation(
      async (operation: (client: typeof database) => Promise<unknown>) => operation(database),
    );

    await expect(assignFineAction(null, assignmentForm(''))).resolves.toEqual({
      ok: true,
      fineId: 'fine-1',
      assignedRentalId: null,
    });

    expect(database.rental.findFirst).not.toHaveBeenCalled();
    expect(database.fine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rentalId: null,
          clientId: null,
          assignmentSource: 'MANUAL',
        }),
      }),
    );
    expect(database.fineAssignmentHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ rentalId: null, clientId: null, source: 'MANUAL' }),
      select: { id: true },
    });
    expect(database.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changes: { assigned: false, assignmentSource: 'MANUAL' },
        }),
      }),
    );
    expect(reconcileFine).toHaveBeenCalledWith(
      database,
      expect.objectContaining({
        companyId: 'company-1',
        clientId: 'client-1',
        rentalId: 'rental-1',
        fineId: 'fine-1',
        status: 'CANCELLED',
      }),
    );
  });

  it('denies inaccessible companies before opening a transaction', async () => {
    const { FineAccessDeniedError } = await import('../access');
    requireFineManageAccess.mockRejectedValue(new FineAccessDeniedError());

    await expect(assignFineAction(null, assignmentForm())).resolves.toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('records an idempotent score event only for an exactly confirmed overdue fine assignment', async () => {
    const database = transactionDatabase();
    database.fine.findFirst.mockResolvedValue({
      id: 'fine-1',
      vehicleId: 'vehicle-1',
      status: 'OVERDUE',
    });
    transaction.mockImplementation(
      async (operation: (client: typeof database) => Promise<unknown>) => operation(database),
    );

    await expect(assignFineAction(null, assignmentForm())).resolves.toMatchObject({ ok: true });

    expect(database.clientRatingEvent.createMany).toHaveBeenCalledWith({
      data: [
        {
          companyId: 'company-1',
          clientId: 'client-1',
          rentalId: 'rental-1',
          fineId: 'fine-1',
          source: 'AUTOMATIC',
          actorUserId: null,
          type: 'UNPAID_CONFIRMED_FINE',
          reason: 'UNPAID_CONFIRMED_FINE',
          delta: -15,
          idempotencyKey: 'fine:fine-1:confirmed-overdue',
        },
      ],
      skipDuplicates: true,
    });
    expect(database.fine.update.mock.invocationCallOrder[0]).toBeLessThan(
      database.clientRatingEvent.createMany.mock.invocationCallOrder[0],
    );
  });
});
