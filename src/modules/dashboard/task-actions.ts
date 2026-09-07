'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/database/prisma/client';
import { getAuthenticatedSession } from '@/services/auth/session';

async function taskContext() {
  const session = await getAuthenticatedSession();
  if (!session) throw new Error('Требуется вход в СУПА ПРО.');
  const membership = await prisma.companyMember.findFirst({
    where: { userId: session.user.id, role: { in: ['COMPANY_ADMIN', 'DISPATCHER'] } },
    select: { companyId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (!membership && session.user.role !== 'SUPER_ADMIN')
    throw new Error('Недостаточно прав для управления задачами.');
  const fallback =
    membership ??
    (await prisma.companyMember.findFirst({
      where: { userId: session.user.id },
      select: { companyId: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }));
  if (!fallback) throw new Error('Компания пользователя не найдена.');
  return { userId: session.user.id, companyId: fallback.companyId };
}

function parseMoscowDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Укажите срок задачи.');
  const date = new Date(`${value}:00+03:00`);
  if (Number.isNaN(date.getTime())) throw new Error('Некорректный срок задачи.');
  return date;
}

export async function createOperationsTaskAction(formData: FormData) {
  const context = await taskContext();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const dueAt = parseMoscowDateTime(String(formData.get('dueAt') ?? ''));
  const requestedPriority = String(formData.get('priority') ?? 'NORMAL');
  const priority = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].includes(requestedPriority)
    ? (requestedPriority as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL')
    : 'NORMAL';
  if (title.length < 2 || title.length > 160)
    throw new Error('Название задачи: от 2 до 160 символов.');
  if (description.length > 500) throw new Error('Описание задачи: не более 500 символов.');

  await prisma.operationsTask.create({
    data: {
      companyId: context.companyId,
      title,
      description: description || null,
      dueAt,
      priority,
      createdByUserId: context.userId,
      assignedToUserId: context.userId,
    },
  });
  revalidatePath('/');
}

export async function completeOperationsTaskAction(formData: FormData) {
  const context = await taskContext();
  const taskId = String(formData.get('taskId') ?? '').trim();
  if (!taskId) throw new Error('Задача не найдена.');
  await prisma.operationsTask.updateMany({
    where: { id: taskId, companyId: context.companyId, status: 'OPEN' },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedByUserId: context.userId,
    },
  });
  revalidatePath('/');
}
