'use server';

import { redirect } from 'next/navigation';

import { prisma } from '@/database/prisma/client';
import { verifyPassword } from '@/services/auth/password';
import { createSession, deleteSession } from '@/services/auth/session';

import { clearLoginFailures, isLoginLocked, recordLoginFailure } from './throttle';
import type { LoginState } from './types';
import { parseLoginInput } from './validation';

const LOGIN_ERROR = 'Не удалось войти. Проверьте данные и попробуйте позже.';
const DUMMY_PASSWORD_HASH = [
  'scrypt',
  '16384',
  '8',
  '1',
  Buffer.alloc(16).toString('base64url'),
  Buffer.alloc(64).toString('base64url'),
].join('$');

const failedLoginState: LoginState = { status: 'error', message: LOGIN_ERROR };

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const input = parseLoginInput(formData);
  if (!input.ok) return input.state;

  try {
    if (await isLoginLocked(input.email)) return failedLoginState;

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    const passwordMatches = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !user.isActive || user.role !== 'ADMIN' || !passwordMatches) {
      await recordLoginFailure(input.email);
      return failedLoginState;
    }

    await clearLoginFailures(input.email);
    await createSession(user.id);
  } catch {
    return failedLoginState;
  }

  redirect('/');
}

export async function logoutAction(): Promise<never> {
  await deleteSession();
  redirect('/login');
}
