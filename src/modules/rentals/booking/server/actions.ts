'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/database/prisma/client';
import {
  confirmAndGenerateRentalAction,
  createRentalDraftAction,
  updateRentalDraftAction,
} from '@/modules/rentals/server/actions';
import { requireRentalAccess, RentalAccessDeniedError } from '@/modules/rentals/server/access';
import { ClamAvClient } from '@/services/malware-scanner/clamav-client';
import { LocalPrivateStorage } from '@/services/storage/local-private-storage';

import type { BookingActionState } from '../types';
import { admitBookingReceipt } from './payment-receipt';
import { createBookingFinalizer } from './workflow';

const finalizeBooking = createBookingFinalizer(prisma as never);
type BookingErrorCode = Extract<BookingActionState, { ok: false }>['code'];

function privateStorageRoot() {
  const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (root) return root;
  if (process.env.NODE_ENV !== 'production') return './.pilot-private-storage';
  throw new Error('Приватное хранилище не настроено.');
}

function failure(code: BookingErrorCode, message: string, rentalId?: string): BookingActionState {
  return { ok: false, code, message, rentalId };
}

export async function saveBookingDraftAction(
  _previous: BookingActionState | null,
  formData: FormData,
): Promise<BookingActionState> {
  const rentalId = String(formData.get('rentalId') ?? '').trim();
  const result = rentalId
    ? await updateRentalDraftAction(null, formData)
    : await createRentalDraftAction(null, formData);
  return result.ok
    ? { ok: true, rentalId: result.rentalId }
    : failure(result.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'SAVE_FAILED', result.message);
}

export async function confirmBookingAction(
  _previous: BookingActionState | null,
  formData: FormData,
): Promise<BookingActionState> {
  const companyId = String(formData.get('companyId') ?? '').trim();
  const rentalId = String(formData.get('rentalId') ?? '').trim();
  const receiptFile = formData.get('receipt');
  if (!companyId || !rentalId || !(receiptFile instanceof File) || receiptFile.size === 0) {
    return failure(
      'VALIDATION',
      'Создайте черновик и добавьте фотографию чека.',
      rentalId || undefined,
    );
  }

  let storage: Awaited<ReturnType<typeof LocalPrivateStorage.create>> | null = null;
  let storageKey: string | null = null;
  try {
    const access = await requireRentalAccess(companyId);
    storage = await LocalPrivateStorage.create(privateStorageRoot());
    const admitted = await admitBookingReceipt({
      companyId,
      rentalId,
      file: { name: receiptFile.name, bytes: new Uint8Array(await receiptFile.arrayBuffer()) },
      storage,
      scanner: ClamAvClient.fromEnvironment(),
      randomId: randomUUID,
      now: () => new Date(),
    });
    storageKey = admitted.storageKey;

    const confirmed = await confirmAndGenerateRentalAction(null, formData);
    if (!confirmed.ok) {
      await storage.removePrivate(admitted.storageKey).catch(() => undefined);
      if (confirmed.code === 'OVERLAP')
        return failure('VEHICLE_UNAVAILABLE', confirmed.message, confirmed.rentalId);
      return failure(
        confirmed.code === 'DOCUMENT_FAILED' ? 'DOCUMENT_FAILED' : 'SAVE_FAILED',
        confirmed.message,
        confirmed.rentalId,
      );
    }

    const finalized = await finalizeBooking({
      companyId,
      rentalId,
      actorUserId: access.user.id,
      actorEmail: access.user.email,
      idempotencyKey: `booking:${rentalId}`,
      method:
        formData.get('paymentMethod') === 'CASH' ||
        formData.get('paymentMethod') === 'CARD' ||
        formData.get('paymentMethod') === 'OTHER'
          ? (formData.get('paymentMethod') as 'CASH' | 'CARD' | 'OTHER')
          : 'TRANSFER',
      receipt: admitted,
    });
    revalidatePath('/rentals');
    revalidatePath(`/rentals/${rentalId}`);
    return {
      ok: true,
      rentalId,
      contractNumber: finalized.contractNumber,
      documentVersion: confirmed.documentVersion,
    };
  } catch (error) {
    if (storage && storageKey) await storage.removePrivate(storageKey).catch(() => undefined);
    if (error instanceof RentalAccessDeniedError)
      return failure('FORBIDDEN', 'Доступ к бронированиям запрещён.', rentalId);
    if (error instanceof Error && error.message === 'VEHICLE_UNAVAILABLE')
      return failure('VEHICLE_UNAVAILABLE', 'Автомобиль уже занят на выбранный период.', rentalId);
    return failure(
      'RECEIPT_FAILED',
      error instanceof Error && !/prisma|P\d{4}/iu.test(error.message)
        ? error.message
        : 'Не удалось проверить и сохранить фотографию чека.',
      rentalId,
    );
  }
}
