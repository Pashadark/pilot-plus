import { redirect } from 'next/navigation';

import { readSession } from '@/services/auth/session';

import type { SafeUser } from './types';

export async function getCurrentUser(): Promise<SafeUser | null> {
  return readSession();
}

export async function requireAdmin(): Promise<SafeUser> {
  const user = await getCurrentUser();

  if (!user) redirect('/login');

  return user;
}
