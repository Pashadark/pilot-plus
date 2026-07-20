'use server';

import { revalidatePath } from 'next/cache';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { isLoginLocked, recordLoginFailure } from '@/modules/auth/throttle';
import { hashPassword, verifyPassword } from '@/services/auth/password';
import {
  commitSessionRotationCookie,
  getAuthenticatedSession,
  prepareSessionRotation,
  type AuthenticatedSession,
} from '@/services/auth/session';

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
const SESSION_PRECONDITION_FAILED = Symbol('SESSION_PRECONDITION_FAILED');
const USER_PRECONDITION_FAILED = Symbol('USER_PRECONDITION_FAILED');

interface VerifiedMutationAuthorization {
  session: AuthenticatedSession;
  user: {
    email: string;
    passwordHash: string;
    updatedAt: Date;
  };
}

type MutationAuthorizationResult =
  | { ok: true; authorization: VerifiedMutationAuthorization }
  | { ok: false; state: ProfileActionState };

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

async function authorizeMutation(currentPassword: string): Promise<MutationAuthorizationResult> {
  const session = await getAuthenticatedSession();
  if (!session) return { ok: false, state: SESSION_ERROR };

  if (await isLoginLocked(session.user.email)) {
    return { ok: false, state: PASSWORD_CONFIRMATION_ERROR };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true, updatedAt: true },
  });
  if (!user) return { ok: false, state: SESSION_ERROR };

  const passwordMatches = await verifyPassword(currentPassword, user.passwordHash);
  if (!passwordMatches) {
    await recordLoginFailure(user.email);
    return { ok: false, state: PASSWORD_CONFIRMATION_ERROR };
  }

  return { ok: true, authorization: { session, user } };
}

function currentSessionWhere(authorization: VerifiedMutationAuthorization) {
  return {
    id: authorization.session.currentSessionId,
    userId: authorization.session.user.id,
    tokenHash: authorization.session.currentSessionTokenHash,
    expiresAt: { gt: new Date() },
  };
}

function verifiedUserWhere(authorization: VerifiedMutationAuthorization) {
  return {
    id: authorization.session.user.id,
    passwordHash: authorization.user.passwordHash,
    updatedAt: authorization.user.updatedAt,
    isActive: true,
    role: 'ADMIN' as const,
  };
}

async function assertCurrentSession(
  transaction: Prisma.TransactionClient,
  authorization: VerifiedMutationAuthorization,
  data: Prisma.SessionUpdateManyMutationInput,
): Promise<void> {
  const result = await transaction.session.updateMany({
    where: currentSessionWhere(authorization),
    data,
  });

  if (result.count !== 1) throw SESSION_PRECONDITION_FAILED;
}

function preconditionState(error: unknown): ProfileActionState | undefined {
  if (error === SESSION_PRECONDITION_FAILED) return SESSION_ERROR;
  if (error === USER_PRECONDITION_FAILED) return PASSWORD_CONFIRMATION_ERROR;
  return undefined;
}

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const input = parseProfileInput(formData);
  if (!input.ok) return input.state;

  try {
    const authorizationResult = await authorizeMutation(input.currentPassword);
    if (!authorizationResult.ok) return authorizationResult.state;
    const { authorization } = authorizationResult;

    await prisma.$transaction(async (transaction) => {
      await assertCurrentSession(transaction, authorization, {
        expiresAt: authorization.session.currentSessionExpiresAt,
      });

      const updated = await transaction.user.updateMany({
        where: verifiedUserWhere(authorization),
        data: { name: input.name, email: input.email },
      });
      if (updated.count !== 1) throw USER_PRECONDITION_FAILED;

      await transaction.loginThrottle.deleteMany({
        where: {
          email: { in: [authorization.user.email, input.email] },
        },
      });
    });

    revalidatePath('/profile');
    return { status: 'success', message: 'Профиль сохранён.' };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { status: 'error', message: 'Этот email уже используется' };
    }
    const state = preconditionState(error);
    if (state) return state;

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
    const authorizationResult = await authorizeMutation(input.currentPassword);
    if (!authorizationResult.ok) return authorizationResult.state;
    const { authorization } = authorizationResult;

    const passwordHash = await hashPassword(input.newPassword);
    const rotation = prepareSessionRotation(authorization.session.currentSessionExpiresAt);

    await prisma.$transaction(async (transaction) => {
      await assertCurrentSession(transaction, authorization, {
        tokenHash: rotation.tokenHash,
        expiresAt: rotation.expiresAt,
      });

      const updated = await transaction.user.updateMany({
        where: verifiedUserWhere(authorization),
        data: { passwordHash },
      });
      if (updated.count !== 1) throw USER_PRECONDITION_FAILED;

      await transaction.session.deleteMany({
        where: {
          userId: authorization.session.user.id,
          id: { not: authorization.session.currentSessionId },
        },
      });
      await transaction.loginThrottle.deleteMany({
        where: { email: authorization.user.email },
      });
    });
    await commitSessionRotationCookie(rotation);

    revalidatePath('/profile');
    return { status: 'success', message: 'Пароль изменён.' };
  } catch (error) {
    const state = preconditionState(error);
    if (state) return state;
    return { status: 'error', message: 'Не удалось изменить пароль. Попробуйте снова.' };
  }
}
