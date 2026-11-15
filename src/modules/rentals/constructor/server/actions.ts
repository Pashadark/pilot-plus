'use server';

import { prisma } from '@/database/prisma/client';
import { createClientAction } from '@/modules/clients/actions';
import { createRentalPaymentRecorder } from '@/modules/rentals/booking/server/workflow';
import {
  confirmAndGenerateRentalAction,
  createRentalDraftAction,
  generateRentalDocumentsAction,
  updateRentalDraftAction,
  type RentalActionResult,
} from '@/modules/rentals/server/actions';
import { requireRentalAccess } from '@/modules/rentals/server/access';

import {
  createConstructorClientActionWith,
  createFinalizeRentalConstructorAction,
  saveConstructorDraftActionWith,
  type ConstructorClientResult,
  type ConstructorDraftResult,
} from './actions-core';

const createConstructorClient = createConstructorClientActionWith(createClientAction);
const saveConstructorDraft = saveConstructorDraftActionWith(
  createRentalDraftAction,
  updateRentalDraftAction,
);
const recordRentalPayment = createRentalPaymentRecorder(prisma as never);
const finalizeRentalConstructor = createFinalizeRentalConstructorAction({
  requireAccess: requireRentalAccess,
  findRental: (companyId, rentalId) =>
    prisma.rental.findFirst({
      where: { id: rentalId, companyId },
      select: { status: true, totalPriceMinor: true, depositMinor: true },
    }),
  saveDraft: updateRentalDraftAction,
  confirm: confirmAndGenerateRentalAction,
  generateDocuments: generateRentalDocumentsAction,
  recordPayment: recordRentalPayment,
});

export async function createConstructorClientAction(
  previous: ConstructorClientResult | null,
  formData: FormData,
): Promise<ConstructorClientResult> {
  return createConstructorClient(previous, formData);
}

export async function saveConstructorDraftAction(
  previous: ConstructorDraftResult | null,
  formData: FormData,
): Promise<ConstructorDraftResult> {
  return saveConstructorDraft(previous, formData);
}

export async function finalizeRentalConstructorAction(
  previous: RentalActionResult | null,
  formData: FormData,
): Promise<RentalActionResult> {
  return finalizeRentalConstructor(previous, formData);
}
