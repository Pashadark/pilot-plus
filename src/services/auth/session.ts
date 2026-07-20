import 'server-only';

import { cookies } from 'next/headers';

import { prisma } from '@/database/prisma/client';
import type { SafeUser } from '@/modules/auth/types';

import { createSessionToken, hashSessionToken } from './session-token';

export interface AuthenticatedSession {
  user: SafeUser;
  currentSessionId: string;
  currentSessionTokenHash: string;
  currentSessionExpiresAt: Date;
}

export interface PreparedSessionRotation {
  readonly token: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export const SESSION_COOKIE_NAME = 'pilot-session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

function clearSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  try {
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // В Server Component cookie очистится при следующем выходе или Server Action.
  }
}

export function prepareSessionRotation(expiresAt: Date): PreparedSessionRotation {
  const { token, tokenHash } = createSessionToken();
  return { token, tokenHash, expiresAt };
}

export async function commitSessionRotationCookie(
  rotation: PreparedSessionRotation,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rotation.token, {
    ...cookieOptions,
    expires: rotation.expiresAt,
  });
}

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const rotation = prepareSessionRotation(expiresAt);

  await prisma.session.create({
    data: { userId, tokenHash: rotation.tokenHash, expiresAt: rotation.expiresAt },
  });
  await commitSessionRotationCookie(rotation);
}

export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const tokenHash = hashSessionToken(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) await prisma.session.deleteMany({ where: { id: session.id } });
      clearSessionCookie(cookieStore);
      return null;
    }

    if (!session.user.isActive || session.user.role !== 'ADMIN') {
      clearSessionCookie(cookieStore);
      return null;
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: 'ADMIN',
      },
      currentSessionId: session.id,
      currentSessionTokenHash: session.tokenHash,
      currentSessionExpiresAt: session.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function readSession(): Promise<SafeUser | null> {
  const session = await getAuthenticatedSession();
  return session?.user ?? null;
}

export async function deleteOtherSessions(userId: string, currentSessionId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, id: { not: currentSessionId } },
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }

  cookieStore.set(SESSION_COOKIE_NAME, '', { ...cookieOptions, expires: new Date(0) });
}
