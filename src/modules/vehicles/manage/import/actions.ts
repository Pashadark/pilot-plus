'use server';

import { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { revalidatePath } from 'next/cache';

import {
  canArchiveVehicleCompany,
  requireVehicleManagementAccess,
  VehicleManagementAccessDeniedError,
} from '../access';

import { applyFleetImport } from './apply';
import { parseExampleFleetWorkbook } from './parser';
import {
  createFleetImportPreview,
  signFleetImportPreview,
  verifyFleetImportPreview,
} from './preview';

export type FleetImportActionState =
  | {
      ok: true;
      token: string;
      rows: ReturnType<typeof createFleetImportPreview>['rows'];
      optionalArchives: ReturnType<typeof createFleetImportPreview>['optionalArchives'];
      message: string;
    }
  | {
      ok: true;
      created: number;
      updated: number;
      unchanged: number;
      archived: number;
      message: string;
    }
  | { ok: false; code: string; message: string };

const PREVIEW_TTL_MS = 15 * 60 * 1000;

function secret(): string {
  const value = process.env.FLEET_IMPORT_PREVIEW_SECRET;
  if (!value) throw new Error('Секрет импорта не настроен.');
  return value;
}

function safeFailure(error: unknown): FleetImportActionState {
  if (error instanceof VehicleManagementAccessDeniedError) {
    return { ok: false, code: 'FORBIDDEN', message: 'Управление автопарком недоступно.' };
  }
  return { ok: false, code: 'IMPORT_FAILED', message: 'Не удалось обработать импорт автопарка.' };
}

function getFile(formData: FormData): { name: string; arrayBuffer(): Promise<ArrayBuffer> } | null {
  const file = formData.get('workbook');
  if (
    !file ||
    typeof file === 'string' ||
    typeof (file as { name?: unknown }).name !== 'string' ||
    typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== 'function'
  ) {
    return null;
  }
  return file as { name: string; arrayBuffer(): Promise<ArrayBuffer> };
}

export async function previewFleetImportAction(
  _previousState: FleetImportActionState | null,
  formData: FormData,
): Promise<FleetImportActionState> {
  const companyId = String(formData.get('companyId') ?? '').trim();
  const workbook = getFile(formData);
  if (!companyId || !workbook) {
    return { ok: false, code: 'VALIDATION', message: 'Выберите компанию и файл .xlsx.' };
  }
  try {
    const access = await requireVehicleManagementAccess(companyId);
    const parsed = parseExampleFleetWorkbook({
      filename: workbook.name,
      bytes: new Uint8Array(await workbook.arrayBuffer()),
    });
    if (parsed.errors.length > 0) {
      return { ok: false, code: 'VALIDATION', message: 'Исправьте ошибки строк в файле Excel.' };
    }
    const existing = await prisma.vehicle.findMany({
      where: { companyId, archivedAt: null },
      select: {
        id: true,
        internalNumber: true,
        registrationNumberNormalized: true,
        vinNormalized: true,
        make: true,
        modelName: true,
        manufacturedYear: true,
      },
    });
    const preview = createFleetImportPreview(parsed.rows, existing);
    const token = signFleetImportPreview(
      {
        companyId,
        userId: access.user.id,
        expiresAt: Date.now() + PREVIEW_TTL_MS,
        rows: parsed.rows,
        archiveIds: preview.optionalArchives.map((vehicle) => vehicle.id),
      },
      secret(),
    );
    return { ok: true, token, ...preview, message: 'Предпросмотр импорта подготовлен.' };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function applyFleetImportAction(
  _previousState: FleetImportActionState | null,
  formData: FormData,
): Promise<FleetImportActionState> {
  const token = String(formData.get('token') ?? '');
  let payload;
  try {
    payload = verifyFleetImportPreview(token, secret());
  } catch {
    return {
      ok: false,
      code: 'PREVIEW_INVALID',
      message: 'Предпросмотр истёк или недействителен.',
    };
  }
  try {
    const access = await requireVehicleManagementAccess(payload.companyId);
    if (access.user.id !== payload.userId) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Предпросмотр принадлежит другому пользователю.',
      };
    }
    const rawArchiveIds = String(formData.get('archiveIds') ?? '[]');
    let archiveIds: string[];
    try {
      const value: unknown = JSON.parse(rawArchiveIds);
      archiveIds = Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : [];
    } catch {
      return { ok: false, code: 'VALIDATION', message: 'Некорректный выбор архивирования.' };
    }
    const allowedArchives = new Set(payload.archiveIds);
    if (archiveIds.some((id) => !allowedArchives.has(id))) {
      return { ok: false, code: 'ARCHIVE_SELECTION', message: 'Некорректный выбор архивирования.' };
    }
    const result = await applyFleetImport({
      companyId: payload.companyId,
      actor: { id: access.user.id, email: access.user.email },
      rows: payload.rows,
      archiveIds,
      allowArchive: canArchiveVehicleCompany(access, payload.companyId),
      transaction: (callback) =>
        prisma.$transaction(
          (transaction) => callback(transaction as unknown as Parameters<typeof callback>[0]),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
    });
    if (!result.ok) return result;
    revalidatePath('/vehicles');
    return { ...result, message: 'Импорт автопарка применён.' };
  } catch (error) {
    if (error instanceof Error && error.message === 'ACTIVE_RENTAL')
      return {
        ok: false,
        code: 'ACTIVE_RENTAL',
        message: 'Нельзя архивировать автомобиль с активной арендой.',
      };
    if (error instanceof Error && error.message === 'ARCHIVE_FORBIDDEN')
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Диспетчер не может архивировать автомобили.',
      };
    return safeFailure(error);
  }
}
