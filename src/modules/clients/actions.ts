'use server';

import { revalidatePath } from 'next/cache';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { writeAuditLog, type ClientAuditChanges } from '@/modules/admin/audit';
import { getClientAccess, type ClientAccess } from '@/modules/clients/access';
import type { ClientActionState, ClientInput } from '@/modules/clients/types';
import { parseClientInput } from '@/modules/clients/validation';
import { blindIndex, encryptField } from '@/services/security/field-encryption';
import { normalizeRussianPhone } from '@/shared/utils/phone';

const ACCESS_ERROR: ClientActionState = {
  status: 'error',
  message: 'Доступ к клиентам запрещён.',
};
const COMPANY_ACCESS_ERROR: ClientActionState = {
  status: 'error',
  message: 'Доступ к выбранной компании запрещён.',
};
const CONFLICT_ERROR: ClientActionState = {
  status: 'error',
  message: 'Карточка клиента уже изменилась. Обновите страницу и повторите попытку.',
};
const ARCHIVE_ACCESS_ERROR: ClientActionState = {
  status: 'error',
  message: 'Архивировать клиентов может только администратор компании.',
};
const SAVE_ERROR: ClientActionState = {
  status: 'error',
  message: 'Не удалось сохранить клиента. Попробуйте позже.',
};
const DUPLICATE_PHONE_ERROR = 'Клиент с таким номером телефона уже существует.';
function formString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

function parseExpectedUpdatedAt(formData: FormData): Date | null {
  const value = formString(formData, 'expectedUpdatedAt');
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.toISOString() !== value ? null : date;
}

function includesCompany(access: ClientAccess, companyId: string): boolean {
  return access.scope === 'SYSTEM' || access.companyIds.includes(companyId);
}

function scopedCompanyIds(access: ClientAccess): string[] | undefined {
  return access.scope === 'SYSTEM' ? undefined : [...access.companyIds];
}

function normalizedDocument(value: string): string {
  return value.replace(/\D/g, '');
}

function keys(): { encryptionKey: string; searchKey: string } {
  const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  const searchKey = process.env.CLIENT_SEARCH_KEY;
  if (!encryptionKey || !searchKey) throw new Error('Ключи защиты клиентских данных не настроены.');
  return { encryptionKey, searchKey };
}

function initialClientStatus(status: ClientInput['status']): ClientInput['status'] {
  return status === 'DRAFT' || status === 'BLOCKED' ? status : 'VERIFYING';
}

function encryptedCreateData(input: ClientInput, userId: string) {
  const { encryptionKey, searchKey } = keys();
  return {
    companyId: input.companyId,
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    birthDate: input.birthDate,
    phoneEncrypted: input.phone ? encryptField(input.phone, encryptionKey) : null,
    phoneIndex: input.phone ? blindIndex(input.phone, searchKey, normalizeRussianPhone) : null,
    additionalPhoneEncrypted: input.additionalPhone
      ? encryptField(input.additionalPhone, encryptionKey)
      : null,
    email: input.email,
    passportEncrypted: input.passport ? encryptField(input.passport, encryptionKey) : null,
    registrationAddressEncrypted: input.registrationAddress
      ? encryptField(input.registrationAddress, encryptionKey)
      : null,
    actualAddressEncrypted: input.actualAddress
      ? encryptField(input.actualAddress, encryptionKey)
      : null,
    passportIndex: input.passport
      ? blindIndex(input.passport, searchKey, normalizedDocument)
      : null,
    driverLicenseEncrypted: input.driverLicense
      ? encryptField(input.driverLicense, encryptionKey)
      : null,
    driverLicenseIndex: input.driverLicense
      ? blindIndex(input.driverLicense, searchKey, normalizedDocument)
      : null,
    driverCategories: [],
    driverLicenseIssuedAt: input.driverLicenseIssuedAt,
    driverLicenseExpiresAt: input.driverLicenseExpiresAt,
    status: initialClientStatus(input.status),
    createdByUserId: userId,
  };
}

function encryptedUpdateData(input: ClientInput) {
  const { encryptionKey, searchKey } = keys();
  return {
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    birthDate: input.birthDate,
    phoneEncrypted: input.phone ? encryptField(input.phone, encryptionKey) : null,
    phoneIndex: input.phone ? blindIndex(input.phone, searchKey, normalizeRussianPhone) : null,
    additionalPhoneEncrypted: input.additionalPhone
      ? encryptField(input.additionalPhone, encryptionKey)
      : null,
    email: input.email,
    passportEncrypted: input.passport ? encryptField(input.passport, encryptionKey) : null,
    registrationAddressEncrypted: input.registrationAddress
      ? encryptField(input.registrationAddress, encryptionKey)
      : null,
    actualAddressEncrypted: input.actualAddress
      ? encryptField(input.actualAddress, encryptionKey)
      : null,
    passportIndex: input.passport
      ? blindIndex(input.passport, searchKey, normalizedDocument)
      : null,
    driverLicenseEncrypted: input.driverLicense
      ? encryptField(input.driverLicense, encryptionKey)
      : null,
    driverLicenseIndex: input.driverLicense
      ? blindIndex(input.driverLicense, searchKey, normalizedDocument)
      : null,
    driverLicenseIssuedAt: input.driverLicenseIssuedAt,
    driverLicenseExpiresAt: input.driverLicenseExpiresAt,
    status: input.status,
  };
}

function isDuplicatePhone(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2002') {
    return false;
  }
  const meta =
    'meta' in error && typeof error.meta === 'object' && error.meta !== null ? error.meta : null;
  const target = meta && 'target' in meta ? meta.target : undefined;
  const fields = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  return fields.includes('phoneIndex');
}

function duplicatePhoneState(): ClientActionState {
  return {
    status: 'error',
    message: DUPLICATE_PHONE_ERROR,
    fieldErrors: { phone: DUPLICATE_PHONE_ERROR },
  };
}

function invalidInputState(fieldErrors: Record<string, string>): ClientActionState {
  return { status: 'error', message: 'Проверьте заполнение полей.', fieldErrors };
}

async function audit(
  access: ClientAccess,
  companyId: string,
  action: 'CREATE' | 'UPDATE' | 'ARCHIVE',
  clientId: string,
  changes: ClientAuditChanges,
  transaction: Prisma.TransactionClient,
): Promise<void> {
  await writeAuditLog(
    {
      actor: { id: access.user.id, email: access.user.email },
      companyId,
      action,
      entityType: 'CLIENT',
      entityId: clientId,
      entityLabel: 'Клиент',
      changes,
    },
    transaction,
  );
}

function revalidateClient(clientId: string): void {
  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
}

export async function createClientAction(
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return ACCESS_ERROR;

  const parsed = parseClientInput(formData);
  if (!parsed.ok) return invalidInputState(parsed.fieldErrors);
  if (!includesCompany(access, parsed.data.companyId)) return COMPANY_ACCESS_ERROR;

  try {
    const client = await prisma.$transaction(async (transaction) => {
      const created = await transaction.client.create({
        data: encryptedCreateData(parsed.data, access.user.id),
        select: { id: true },
      });
      await audit(
        access,
        parsed.data.companyId,
        'CREATE',
        created.id,
        {
          created: true,
          status: initialClientStatus(parsed.data.status),
        },
        transaction,
      );
      return created;
    });
    revalidateClient(client.id);
    return {
      status: 'success',
      message: 'Клиент создан.',
      clientId: client.id,
      client: {
        id: client.id,
        fullName: [parsed.data.lastName, parsed.data.firstName, parsed.data.middleName]
          .filter(Boolean)
          .join(' '),
        phone: parsed.data.phone,
      },
    };
  } catch (error) {
    return isDuplicatePhone(error) ? duplicatePhoneState() : SAVE_ERROR;
  }
}

export async function updateClientAction(
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return ACCESS_ERROR;

  const clientId = formString(formData, 'clientId');
  const expectedUpdatedAt = parseExpectedUpdatedAt(formData);
  const parsed = parseClientInput(formData);
  if (!clientId || !expectedUpdatedAt) return CONFLICT_ERROR;
  if (!parsed.ok) return invalidInputState(parsed.fieldErrors);
  if (!includesCompany(access, parsed.data.companyId)) return COMPANY_ACCESS_ERROR;

  try {
    const companyIds = scopedCompanyIds(access);
    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.client.updateMany({
        where: {
          id: clientId,
          ...(companyIds ? { companyId: { in: companyIds } } : {}),
          AND: { companyId: parsed.data.companyId },
          updatedAt: expectedUpdatedAt,
          archivedAt: null,
        },
        data: encryptedUpdateData(parsed.data),
      });
      if (result.count !== 1) return result;
      await audit(
        access,
        parsed.data.companyId,
        'UPDATE',
        clientId,
        {
          status: parsed.data.status,
        },
        transaction,
      );
      return result;
    });
    if (updated.count !== 1) return CONFLICT_ERROR;

    revalidateClient(clientId);
    return { status: 'success', message: 'Карточка клиента обновлена.', clientId };
  } catch (error) {
    return isDuplicatePhone(error) ? duplicatePhoneState() : SAVE_ERROR;
  }
}

export async function archiveClientAction(
  _previousState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return ACCESS_ERROR;

  const clientId = formString(formData, 'clientId');
  const expectedUpdatedAt = parseExpectedUpdatedAt(formData);
  if (!clientId || !expectedUpdatedAt) return CONFLICT_ERROR;

  try {
    const archiveCompanyIds =
      access.scope === 'SYSTEM'
        ? undefined
        : (
            await prisma.companyMember.findMany({
              where: {
                userId: access.user.id,
                role: 'COMPANY_ADMIN',
                companyId: { in: [...access.companyIds] },
              },
              select: { companyId: true },
            })
          ).map(({ companyId }) => companyId);
    if (archiveCompanyIds?.length === 0) return ARCHIVE_ACCESS_ERROR;

    const archived = await prisma.$transaction(async (transaction) => {
      const client = await transaction.client.findFirst({
        where: {
          id: clientId,
          ...(archiveCompanyIds ? { companyId: { in: archiveCompanyIds } } : {}),
          archivedAt: null,
        },
        select: { companyId: true },
      });
      if (!client) return false;

      const updated = await transaction.client.updateMany({
        where: {
          id: clientId,
          companyId: { in: [client.companyId] },
          updatedAt: expectedUpdatedAt,
          archivedAt: null,
        },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      if (updated.count !== 1) return false;
      await audit(
        access,
        client.companyId,
        'ARCHIVE',
        clientId,
        {
          archived: true,
          status: 'ARCHIVED',
        },
        transaction,
      );
      return true;
    });
    if (!archived) return CONFLICT_ERROR;
    revalidateClient(clientId);
    return { status: 'success', message: 'Клиент архивирован.', clientId };
  } catch {
    return SAVE_ERROR;
  }
}
