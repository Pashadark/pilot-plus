import type { Metadata } from 'next';

import { OnlineMapWorkspace } from '@/modules/online-map/components/OnlineMapWorkspace';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export const metadata: Metadata = { title: 'Онлайн-карта | Pilot+' };

export default function OnlineMapPage() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'Онлайн-карта' }]}>
      <main className="relative -m-4 lg:-m-5">
        <h1 className="sr-only">Онлайн-карта</h1>
        <p className="absolute top-28 left-3 z-30 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] shadow-[var(--shadow-card)] md:left-4">
          Демонстрационные данные
        </p>
        <OnlineMapWorkspace />
      </main>
    </AppShell>
  );
}
