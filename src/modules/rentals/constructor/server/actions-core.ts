import type { ClientActionState } from '@/modules/clients/types';
import type { RentalActionResult } from '@/modules/rentals/server/actions';

export type ConstructorClientResult =
  | {
      ok: true;
      client: {
        id: string;
        fullName: string;
        phone: string | null;
        status: 'DRAFT';
      };
    }
  | {
      ok: false;
      code: 'CLIENT_INVALID';
      message: string;
      fieldErrors?: Record<string, string>;
    };

type CreateClient = (
  previousState: ClientActionState,
  formData: FormData,
) => Promise<ClientActionState>;

export function createConstructorClientActionWith(createClient: CreateClient) {
  return async function createConstructorClient(
    _previous: ConstructorClientResult | null,
    formData: FormData,
  ): Promise<ConstructorClientResult> {
    formData.set('status', 'DRAFT');
    const result = await createClient({ status: 'idle' }, formData);
    if (result.status !== 'success' || !result.client) {
      return {
        ok: false,
        code: 'CLIENT_INVALID',
        message: result.status === 'error' ? result.message : 'Не удалось создать клиента.',
        ...(result.status === 'error' && result.fieldErrors
          ? { fieldErrors: result.fieldErrors }
          : {}),
      };
    }
    return {
      ok: true,
      client: { ...result.client, status: 'DRAFT' },
    };
  };
}

export type ConstructorDraftResult =
  | {
      ok: true;
      rentalId: string;
      updatedAt: string;
      calculation: {
        days: number;
        totalMinor: number;
        discountMinor: number;
        servicesMinor: number;
      };
    }
  | { ok: false; code: string; message: string };

type SaveRentalDraft = (
  previous: RentalActionResult | null,
  formData: FormData,
) => Promise<RentalActionResult>;

export function saveConstructorDraftActionWith(
  createDraft: SaveRentalDraft,
  updateDraft: SaveRentalDraft,
) {
  return async function saveConstructorDraft(
    _previous: ConstructorDraftResult | null,
    formData: FormData,
  ): Promise<ConstructorDraftResult> {
    const rentalId = String(formData.get('rentalId') ?? '').trim();
    const result = rentalId
      ? await updateDraft(null, formData)
      : await createDraft(null, formData);
    if (!result.ok) return { ok: false, code: result.code, message: result.message };
    if (!result.updatedAt || !result.calculation) {
      return {
        ok: false,
        code: 'SAVE_FAILED',
        message: 'Черновик сохранён без актуальной версии. Обновите страницу.',
      };
    }
    return {
      ok: true,
      rentalId: result.rentalId,
      updatedAt: result.updatedAt,
      calculation: result.calculation,
    };
  };
}

type FinalizedRental = {
  status: string;
  totalPriceMinor: bigint;
  depositMinor: bigint | null;
};

type FinalizeDependencies = {
  requireAccess(companyId: string): Promise<{ user: { id: string; email: string } }>;
  findRental(companyId: string, rentalId: string): Promise<FinalizedRental | null>;
  saveDraft(previous: RentalActionResult | null, formData: FormData): Promise<RentalActionResult>;
  confirm(previous: RentalActionResult | null, formData: FormData): Promise<RentalActionResult>;
  generateDocuments(
    previous: RentalActionResult | null,
    formData: FormData,
  ): Promise<RentalActionResult>;
  recordPayment(input: {
    companyId: string;
    rentalId: string;
    actorUserId: string;
    actorEmail: string;
    kind: 'RENT' | 'DEPOSIT';
    amountMinor: bigint;
    method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
    idempotencyKey: string;
  }): Promise<{ id: string; reused: boolean }>;
};

function paymentMethod(formData: FormData) {
  const value = String(formData.get('paymentMethod') ?? 'OTHER');
  return value === 'CASH' || value === 'CARD' || value === 'TRANSFER' || value === 'OTHER'
    ? value
    : 'OTHER';
}

export function createFinalizeRentalConstructorAction(dependencies: FinalizeDependencies) {
  return async function finalizeRentalConstructor(
    _previous: RentalActionResult | null,
    formData: FormData,
  ): Promise<RentalActionResult> {
    const companyId = String(formData.get('companyId') ?? '').trim();
    const rentalId = String(formData.get('rentalId') ?? '').trim();
    if (!companyId || !rentalId) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: 'Сначала сохраните обязательные данные договора.',
      };
    }
    try {
      const access = await dependencies.requireAccess(companyId);
      const rental = await dependencies.findRental(companyId, rentalId);
      if (!rental) {
        return { ok: false, code: 'NOT_FOUND', message: 'Черновик договора не найден.' };
      }

      let result: RentalActionResult;
      if (rental.status === 'DRAFT') {
        const saved = await dependencies.saveDraft(null, formData);
        if (!saved.ok) return saved;
        result = await dependencies.confirm(null, formData);
      } else if (rental.status === 'CONFIRMED') {
        result = await dependencies.generateDocuments(null, formData);
      } else {
        return {
          ok: false,
          code: 'FINALIZE_FAILED',
          message: 'Договор уже находится в другом статусе.',
        };
      }

      if (!result.ok && result.code !== 'DOCUMENT_FAILED') return result;

      const method = paymentMethod(formData);
      const payments: Promise<unknown>[] = [];
      if (formData.get('rentReceived') === 'true') {
        payments.push(
          dependencies.recordPayment({
            companyId,
            rentalId,
            actorUserId: access.user.id,
            actorEmail: access.user.email,
            kind: 'RENT',
            amountMinor: rental.totalPriceMinor,
            method,
            idempotencyKey: `constructor:${rentalId}:rent`,
          }),
        );
      }
      if (formData.get('depositReceived') === 'true' && rental.depositMinor !== null) {
        payments.push(
          dependencies.recordPayment({
            companyId,
            rentalId,
            actorUserId: access.user.id,
            actorEmail: access.user.email,
            kind: 'DEPOSIT',
            amountMinor: rental.depositMinor,
            method,
            idempotencyKey: `constructor:${rentalId}:deposit`,
          }),
        );
      }
      await Promise.all(payments);
      return result;
    } catch (error) {
      const forbidden = error instanceof Error && error.name === 'RentalAccessDeniedError';
      return forbidden
        ? {
            ok: false,
            code: 'FORBIDDEN',
            message: 'Доступ к договорам аренды запрещён.',
          }
        : {
            ok: false,
            code: 'FINALIZE_FAILED',
            message: 'Не удалось завершить создание договора. Повторите попытку.',
          };
    }
  };
}
