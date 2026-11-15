import { createClientAction } from '@/modules/clients/actions';
import type { ClientActionState } from '@/modules/clients/types';

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
