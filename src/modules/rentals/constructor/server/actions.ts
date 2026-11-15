import { createClientAction } from '@/modules/clients/actions';
import type { ClientActionState } from '@/modules/clients/types';
import {
  createRentalDraftAction,
  updateRentalDraftAction,
  type RentalActionResult,
} from '@/modules/rentals/server/actions';

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

const createConstructorClient = createConstructorClientActionWith(createClientAction);

export async function createConstructorClientAction(
  previous: ConstructorClientResult | null,
  formData: FormData,
): Promise<ConstructorClientResult> {
  'use server';
  return createConstructorClient(previous, formData);
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
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }
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

const saveConstructorDraft = saveConstructorDraftActionWith(
  createRentalDraftAction,
  updateRentalDraftAction,
);

export async function saveConstructorDraftAction(
  previous: ConstructorDraftResult | null,
  formData: FormData,
): Promise<ConstructorDraftResult> {
  'use server';
  return saveConstructorDraft(previous, formData);
}
