'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/database/prisma/client';
import { hashPassword, verifyPassword } from '@/services/auth/password';
import { getAuthenticatedSession } from '@/services/auth/session';

import type { ProfileActionState } from './types';
import { parsePasswordInput, parseProfileInput } from './validation';

const SESSION_ERROR: ProfileActionState = {
  status: 'error',
  message: 'Сессия истекла. Войдите снова.',
};
const PASSWORD_CONFIRMATION_ERROR: ProfileActionState = {
  status: 'error',
  message: 'Не удалось подтвердить текущий пароль.',
};

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

async function authenticatedUserWithPassword() {
  const session = await getAuthenticatedSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true },
  });

  return user ? { session, user } : null;
}

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const input = parseProfileInput(formData);
  if (!input.ok) return input.state;

  try {
    const authenticated = await authenticatedUserWithPassword();
    if (!authenticated) return SESSION_ERROR;

    const passwordMatches = await verifyPassword(
      input.currentPassword,
      authenticated.user.passwordHash,
    );
    if (!passwordMatches) return PASSWORD_CONFIRMATION_ERROR;

    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: authenticated.session.user.id },
        data: { name: input.name, email: input.email },
      });
      await transaction.loginThrottle.deleteMany({
        where: {
          email: { in: [authenticated.user.email, input.email] },
        },
      });
    });

    revalidatePath('/profile');
    return { status: 'success', message: 'Профиль сохранён.' };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { status: 'error', message: 'Этот email уже используется' };
    }

    return { status: 'error', message: 'Не удалось сохранить профиль. Попробуйте снова.' };
  }
}

export async function changePasswordAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const input = parsePasswordInput(formData);
  if (!input.ok) return input.state;

  try {
    const authenticated = await authenticatedUserWithPassword();
    if (!authenticated) return SESSION_ERROR;

    const passwordMatches = await verifyPassword(
      input.currentPassword,
      authenticated.user.passwordHash,
    );
    if (!passwordMatches) return PASSWORD_CONFIRMATION_ERROR;

    const passwordHash = await hashPassword(input.newPassword);
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: authenticated.session.user.id },
        data: { passwordHash },
      });
      await transaction.session.deleteMany({
        where: {
          userId: authenticated.session.user.id,
          id: { not: authenticated.session.currentSessionId },
        },
      });
    });

    revalidatePath('/profile');
    return { status: 'success', message: 'Пароль изменён.' };
  } catch {
    return { status: 'error', message: 'Не удалось изменить пароль. Попробуйте снова.' };
  }
}
