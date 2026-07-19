import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/modules/auth/dal';
import { LoginPage } from '@/modules/auth/LoginPage';
import type { FlashToastKind } from '@/shared/providers/ToastProvider';

export const metadata: Metadata = { title: 'Вход — Pilot+' };

export default async function LoginRoute({
  searchParams,
}: {
  searchParams: Promise<{ loggedOut?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/');

  const query = await searchParams;
  const flash: FlashToastKind | null = query.loggedOut === '1' ? 'loggedOut' : null;

  return <LoginPage flash={flash} />;
}
