'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/database/prisma/client';

import { FineAccessDeniedError, requireFineManageAccess } from '../access';

export type FineAssignmentActionResult =
  | { ok: true; fineId: string; assignedRentalId: string | null }
  | { ok: false; code: 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'SAVE_FAILED'; message: string };

const validationError = {
  ok: false as const,
  code: 'VALIDATION' as const,
  message: 'Некорректные данные привязки штрафа.',
};
const forbiddenError = {
  ok: false as const,
  code: 'FORBIDDEN' as const,
  message: 'Доступ к штрафам запрещён.',
};
const notFoundError = {
  ok: false as const,
  code: 'NOT_FOUND' as const,
  message: 'Штраф или договор аренды недоступен.',
};
const saveError = {
  ok: false as const,
  code: 'SAVE_FAILED' as const,
  message: 'Не удалось изменить привязку штрафа.',
};

function formIdentifier(formData: FormData, key: string, required: boolean) {
  const raw = formData.get(key);
  if (typeof raw !== 'string') return required ? null : '';
  const value = raw.trim();
  if (value.length > 128 || (required && value.length === 0)) return null;
  return value;
}

export async function assignFineAction(
  _previousState: FineAssignmentActionResult | null,
  formData: FormData,
): Promise<FineAssignmentActionResult> {
  const companyId = formIdentifier(formData, 'companyId', true);
  const fineId = formIdentifier(formData, 'fineId', true);
  const rentalId = formIdentifier(formData, 'rentalId', false);
  if (companyId === null || fineId === null || rentalId === null) return validationError;

  let access;
  try {
    access = await requireFineManageAccess(companyId);
  } catch (error) {
    return error instanceof FineAccessDeniedError ? forbiddenError : saveError;
  }

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const fine = await transaction.fine.findFirst({
          where: { id: fineId, companyId },
          select: { id: true, vehicleId: true },
        });
        if (!fine) return notFoundError;

        const rental = rentalId
          ? fine.vehicleId
            ? await transaction.rental.findFirst({
                where: { id: rentalId, companyId, vehicleId: fine.vehicleId },
                select: { id: true, clientId: true },
              })
            : null
          : null;
        if (rentalId && !rental) return notFoundError;

        const assignedRentalId = rental?.id ?? null;
        const assignedClientId = rental?.clientId ?? null;
        await transaction.fine.update({
          where: { companyId_id: { companyId, id: fine.id } },
          data: {
            rentalId: assignedRentalId,
            clientId: assignedClientId,
            assignmentSource: 'MANUAL',
            assignmentConfirmedAt: new Date(),
            assignmentConfirmedByUserId: access.user.id,
          },
          select: { id: true },
        });
        await transaction.fineAssignmentHistory.create({
          data: {
            companyId,
            fineId: fine.id,
            vehicleId: fine.vehicleId,
            rentalId: assignedRentalId,
            clientId: assignedClientId,
            source: 'MANUAL',
            reason: assignedRentalId ? 'Назначено оператором.' : 'Привязка снята оператором.',
            actorUserId: access.user.id,
          },
          select: { id: true },
        });
        await transaction.auditLog.create({
          data: {
            companyId,
            actorUserId: access.user.id,
            actorEmailSnapshot: access.user.email,
            action: 'ASSIGN',
            entityType: 'FINE',
            entityId: fine.id,
            entityLabel: 'Штраф',
            changes: { assigned: Boolean(assignedRentalId), assignmentSource: 'MANUAL' },
          },
          select: { id: true },
        });
        return { ok: true as const, fineId: fine.id, assignedRentalId };
      },
      { isolationLevel: 'Serializable' },
    );
    if (result.ok) revalidatePath('/fines');
    return result;
  } catch {
    return saveError;
  }
}
