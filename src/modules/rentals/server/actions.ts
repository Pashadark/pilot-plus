'use server';

import { prisma } from '@/database/prisma/client';

import { requireRentalAccess, RentalAccessDeniedError } from './access';

export type RentalActionResult =
  { ok: true; rentalId: string } | { ok: false; code: string; message: string };
const forbidden = {
  ok: false as const,
  code: 'FORBIDDEN',
  message: 'Доступ к договорам аренды запрещён.',
};

function input(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '').trim();
  const rentalId = String(formData.get('rentalId') ?? '').trim();
  if (!companyId || !rentalId) throw new Error('VALIDATION');
  return { companyId, rentalId };
}

export async function cancelRentalAction(
  _state: RentalActionResult | null,
  formData: FormData,
): Promise<RentalActionResult> {
  try {
    const value = input(formData);
    const access = await requireRentalAccess(value.companyId);
    const updated = await prisma.$transaction(async (tx) => {
      const rental = await tx.rental.findFirst({
        where: {
          id: value.rentalId,
          companyId: value.companyId,
          status: { in: ['DRAFT', 'CONFIRMED'] },
        },
        select: { id: true },
      });
      if (!rental) return null;
      const result = await tx.rental.update({
        where: { id: rental.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          companyId: value.companyId,
          actorUserId: access.user.id,
          actorEmailSnapshot: access.user.email,
          action: 'UPDATE',
          entityType: 'SYSTEM',
          entityId: result.id,
          entityLabel: 'Договор аренды',
          changes: { status: 'CANCELLED' },
        },
      });
      return result;
    });
    return updated
      ? { ok: true, rentalId: updated.id }
      : { ok: false, code: 'NOT_FOUND', message: 'Договор недоступен для отмены.' };
  } catch (error) {
    return error instanceof RentalAccessDeniedError
      ? forbidden
      : { ok: false, code: 'SAVE_FAILED', message: 'Не удалось отменить договор.' };
  }
}

