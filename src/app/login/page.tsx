import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/modules/auth/dal';
import { LoginPage } from '@/modules/auth/LoginPage';

export const metadata: Metadata = { title: 'Вход — Pilot+' };

export default async function LoginRoute() {
  const user = await getCurrentUser();
  if (user) redirect('/');

  return <LoginPage />;
}
