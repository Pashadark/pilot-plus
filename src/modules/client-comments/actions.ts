'use server';

import type { Prisma } from '@/database/generated/prisma';
import { revalidatePath } from 'next/cache';

import { prisma } from '@/database/prisma/client';
import { getClientAccess, type ClientAccess } from '@/modules/clients/access';

import { parseClientCommentInput } from './validation';

export type ClientCommentActionState =
  | { ok: true; message: string; commentId: string }
  | {
      ok: false;
      code: 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'SAVE_FAILED';
      message: string;
    };

type Transaction = Prisma.TransactionClient;
const forbidden: ClientCommentActionState = {
  ok: false,
  code: 'FORBIDDEN',
  message: 'Комментарии клиента недоступны.',
};

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
}

async function canWriteManualRating(
  transaction: Transaction,
  access: ClientAccess,
  companyId: string,
) {
  if (access.scope === 'SYSTEM') return true;
  const membership = await transaction.companyMember.findFirst({
    where: { companyId, userId: access.user.id, role: 'COMPANY_ADMIN' },
    select: { id: true },
  });
  return Boolean(membership);
}

async function writeAudit(
  transaction: Transaction,
  input: {
    companyId: string;
    clientId: string;
    commentId: string;
    actor: { id: string; email: string };
    action: 'CREATE' | 'UPDATE' | 'ARCHIVE';
    changes: Record<string, unknown>;
  },
) {
  await transaction.auditLog.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.actor.id,
      actorEmailSnapshot: input.actor.email,
      action: input.action,
      entityType: 'CLIENT',
      entityId: input.clientId,
      entityLabel: 'Внутренний комментарий клиента',
      changes: { commentId: input.commentId, ...input.changes },
    },
  });
}

async function managedClient(
  transaction: Transaction,
  clientId: string,
  companyIds: readonly string[],
  system: boolean,
) {
  return transaction.client.findFirst({
    where: {
      id: clientId,
      archivedAt: null,
      ...(system ? {} : { companyId: { in: [...companyIds] } }),
    },
    select: { id: true, companyId: true },
  });
}

export async function createClientCommentAction(
  formData: FormData,
): Promise<ClientCommentActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return forbidden;
  const parsed = parseClientCommentInput({
    clientId: value(formData, 'clientId'),
    rentalId: value(formData, 'rentalId'),
    category: value(formData, 'category') || 'GENERAL',
    severity: value(formData, 'severity') || 'INFO',
    text: value(formData, 'text'),
    affectsRating: value(formData, 'affectsRating'),
    ratingDelta: value(formData, 'ratingDelta'),
  });
  if (!parsed.ok) return { ok: false, code: 'VALIDATION', message: parsed.message };
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const client = await managedClient(
        transaction,
        parsed.data.clientId,
        access.companyIds,
        access.scope === 'SYSTEM',
      );
      if (!client) return { kind: 'NOT_FOUND' as const };
      if (parsed.data.rentalId) {
        const rental = await transaction.rental.findFirst({
          where: { id: parsed.data.rentalId, clientId: client.id, companyId: client.companyId },
          select: { id: true },
        });
        if (!rental) return { kind: 'NOT_FOUND' as const };
      }
      if (
        parsed.data.affectsRating &&
        !(await canWriteManualRating(transaction, access, client.companyId))
      ) {
        return { kind: 'FORBIDDEN' as const };
      }
      const comment = await transaction.clientComment.create({
        data: {
          companyId: client.companyId,
          clientId: client.id,
          rentalId: parsed.data.rentalId,
          authorUserId: access.user.id,
          category: parsed.data.category,
          severity: parsed.data.severity,
          text: parsed.data.text,
          problemStatus: parsed.data.problemStatus,
          affectsRating: parsed.data.affectsRating,
          ratingDelta: parsed.data.ratingDelta,
        },
        select: { id: true },
      });
      if (parsed.data.affectsRating && parsed.data.ratingDelta !== null) {
        await transaction.clientRatingEvent.create({
          data: {
            companyId: client.companyId,
            clientId: client.id,
            source: 'MANUAL',
            type: parsed.data.ratingDelta > 0 ? 'MANUAL_POSITIVE' : 'MANUAL_NEGATIVE',
            reason: 'MANUAL_COMMENT',
            delta: parsed.data.ratingDelta,
            idempotencyKey: `manual-comment:${comment.id}`,
            commentId: comment.id,
            rentalId: parsed.data.rentalId,
            actorUserId: access.scope === 'SYSTEM' ? null : access.user.id,
          },
        });
      }
      await writeAudit(transaction, {
        companyId: client.companyId,
        clientId: client.id,
        commentId: comment.id,
        actor: access.user,
        action: 'CREATE',
        changes: {
          category: parsed.data.category,
          severity: parsed.data.severity,
          problemStatus: parsed.data.problemStatus,
          affectsRating: parsed.data.affectsRating,
          ratingDelta: parsed.data.ratingDelta,
        },
      });
      return { kind: 'CREATED' as const, comment };
    });
    if (result.kind === 'FORBIDDEN') return forbidden;
    if (result.kind === 'NOT_FOUND')
      return { ok: false, code: 'NOT_FOUND', message: 'Клиент или аренда недоступны.' };
    refresh(parsed.data.clientId);
    return { ok: true, message: 'Комментарий добавлен.', commentId: result.comment.id };
  } catch {
    return { ok: false, code: 'SAVE_FAILED', message: 'Не удалось добавить комментарий.' };
  }
}

export async function updateClientCommentAction(
  formData: FormData,
): Promise<ClientCommentActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return forbidden;
  const commentId = value(formData, 'commentId');
  const parsed = parseClientCommentInput({
    clientId: value(formData, 'clientId'),
    rentalId: value(formData, 'rentalId'),
    category: value(formData, 'category') || 'GENERAL',
    severity: value(formData, 'severity') || 'INFO',
    text: value(formData, 'text'),
    affectsRating: value(formData, 'affectsRating'),
    ratingDelta: value(formData, 'ratingDelta'),
  });
  if (!parsed.ok || !commentId)
    return { ok: false, code: 'VALIDATION', message: 'Проверьте комментарий.' };
  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const client = await managedClient(
        transaction,
        parsed.data.clientId,
        access.companyIds,
        access.scope === 'SYSTEM',
      );
      if (!client) return 'NOT_FOUND' as const;
      const comment = await transaction.clientComment.findFirst({
        where: {
          id: commentId,
          companyId: client.companyId,
          clientId: client.id,
          hiddenAt: null,
        },
        select: { problemStatus: true, resolvedAt: true, resolvedByUserId: true },
      });
      if (!comment) return 'NOT_FOUND' as const;
      if (
        parsed.data.affectsRating &&
        !(await canWriteManualRating(transaction, access, client.companyId))
      ) {
        return 'FORBIDDEN' as const;
      }
      const lifecycle: {
        problemStatus: 'OPEN' | 'RESOLVED' | null;
        resolvedAt: Date | null;
        resolvedByUserId: string | null;
      } = parsed.data.problemStatus
        ? {
            problemStatus: comment.problemStatus === 'RESOLVED' ? 'RESOLVED' : 'OPEN',
            resolvedAt: comment.problemStatus === 'RESOLVED' ? comment.resolvedAt : null,
            resolvedByUserId:
              comment.problemStatus === 'RESOLVED' ? comment.resolvedByUserId : null,
          }
        : { problemStatus: null, resolvedAt: null, resolvedByUserId: null };
      const result = await transaction.clientComment.updateMany({
        where: {
          id: commentId,
          companyId: client.companyId,
          clientId: client.id,
          hiddenAt: null,
          problemStatus: comment.problemStatus,
        },
        data: {
          rentalId: parsed.data.rentalId,
          category: parsed.data.category,
          severity: parsed.data.severity,
          text: parsed.data.text,
          ...lifecycle,
        },
      });
      if (result.count !== 1) return 'NOT_FOUND' as const;
      await writeAudit(transaction, {
        companyId: client.companyId,
        clientId: client.id,
        commentId,
        actor: access.user,
        action: 'UPDATE',
        changes: {
          category: parsed.data.category,
          severity: parsed.data.severity,
          problemStatus: lifecycle.problemStatus,
        },
      });
      return 'UPDATED' as const;
    });
    if (updated === 'FORBIDDEN') return forbidden;
    if (updated === 'NOT_FOUND')
      return { ok: false, code: 'NOT_FOUND', message: 'Комментарий недоступен.' };
    refresh(parsed.data.clientId);
    return { ok: true, message: 'Комментарий обновлён.', commentId };
  } catch {
    return { ok: false, code: 'SAVE_FAILED', message: 'Не удалось обновить комментарий.' };
  }
}

export async function toggleClientCommentPinAction(
  formData: FormData,
): Promise<ClientCommentActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return forbidden;
  const clientId = value(formData, 'clientId');
  const commentId = value(formData, 'commentId');
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const client = await managedClient(
        transaction,
        clientId,
        access.companyIds,
        access.scope === 'SYSTEM',
      );
      if (!client) return null;
      const comment = await transaction.clientComment.findFirst({
        where: { id: commentId, companyId: client.companyId, clientId, hiddenAt: null },
        select: { isPinned: true },
      });
      if (!comment) return null;
      const isPinned = !comment.isPinned;
      await transaction.clientComment.update({ where: { id: commentId }, data: { isPinned } });
      await writeAudit(transaction, {
        companyId: client.companyId,
        clientId,
        commentId,
        actor: access.user,
        action: 'UPDATE',
        changes: { isPinned },
      });
      return isPinned;
    });
    if (result === null)
      return { ok: false, code: 'NOT_FOUND', message: 'Комментарий недоступен.' };
    refresh(clientId);
    return {
      ok: true,
      message: result ? 'Комментарий закреплён.' : 'Комментарий откреплён.',
      commentId,
    };
  } catch {
    return { ok: false, code: 'SAVE_FAILED', message: 'Не удалось изменить комментарий.' };
  }
}

export async function hideClientCommentAction(
  formData: FormData,
): Promise<ClientCommentActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return forbidden;
  const clientId = value(formData, 'clientId');
  const commentId = value(formData, 'commentId');
  try {
    const hidden = await prisma.$transaction(async (transaction) => {
      const client = await managedClient(
        transaction,
        clientId,
        access.companyIds,
        access.scope === 'SYSTEM',
      );
      if (!client) return false;
      const comment = await transaction.clientComment.findFirst({
        where: { id: commentId, companyId: client.companyId, clientId, hiddenAt: null },
        select: { id: true, authorUserId: true },
      });
      if (!comment) return false;
      let authorConstraint: string | undefined;
      if (access.scope !== 'SYSTEM') {
        const membership = await transaction.companyMember.findFirst({
          where: { companyId: client.companyId, userId: access.user.id },
          select: { role: true },
        });
        if (!membership || !['COMPANY_ADMIN', 'DISPATCHER'].includes(membership.role)) return false;
        if (membership.role === 'DISPATCHER') authorConstraint = access.user.id;
      }
      const result = await transaction.clientComment.updateMany({
        where: {
          id: comment.id,
          companyId: client.companyId,
          clientId,
          hiddenAt: null,
          ...(authorConstraint ? { authorUserId: authorConstraint } : {}),
        },
        data: { hiddenAt: new Date(), hiddenByUserId: access.user.id },
      });
      if (result.count !== 1) return false;
      await writeAudit(transaction, {
        companyId: client.companyId,
        clientId,
        commentId,
        actor: access.user,
        action: 'ARCHIVE',
        changes: { hidden: true },
      });
      return true;
    });
    if (!hidden) return { ok: false, code: 'NOT_FOUND', message: 'Комментарий недоступен.' };
    refresh(clientId);
    return { ok: true, message: 'Комментарий скрыт.', commentId };
  } catch {
    return { ok: false, code: 'SAVE_FAILED', message: 'Не удалось скрыть комментарий.' };
  }
}

export async function resolveClientCommentAction(
  formData: FormData,
): Promise<ClientCommentActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return forbidden;
  const clientId = value(formData, 'clientId');
  const commentId = value(formData, 'commentId');
  if (!clientId || !commentId)
    return { ok: false, code: 'VALIDATION', message: 'Проверьте комментарий.' };
  try {
    const resolved = await prisma.$transaction(async (transaction) => {
      const client = await managedClient(
        transaction,
        clientId,
        access.companyIds,
        access.scope === 'SYSTEM',
      );
      if (!client) return false;
      const result = await transaction.clientComment.updateMany({
        where: {
          id: commentId,
          companyId: client.companyId,
          clientId: client.id,
          hiddenAt: null,
          problemStatus: 'OPEN',
        },
        data: {
          problemStatus: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedByUserId: access.scope === 'SYSTEM' ? null : access.user.id,
        },
      });
      if (result.count !== 1) return false;
      await writeAudit(transaction, {
        companyId: client.companyId,
        clientId: client.id,
        commentId,
        actor: access.user,
        action: 'UPDATE',
        changes: { problemStatus: 'RESOLVED' },
      });
      return true;
    });
    if (!resolved) return { ok: false, code: 'NOT_FOUND', message: 'Комментарий недоступен.' };
    refresh(clientId);
    return { ok: true, message: 'Проблема отмечена как решённая.', commentId };
  } catch {
    return { ok: false, code: 'SAVE_FAILED', message: 'Не удалось решить проблему.' };
  }
}
