import { AppShell } from '@/shared/components/app-shell/AppShell';

import { UiKitSections } from './sections';

export const metadata = { title: 'Дизайн-система СУПА ПРО' };

export default function UiKitPage() {
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Дизайн-система' }]}>
      <header className="mb-6">
        <p className="text-sm font-semibold text-[var(--color-primary)]">Дизайн-система</p>
        <h1 className="mt-2 text-[30px] font-bold text-[var(--color-text)]">
          Дизайн-система СУПА ПРО
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--color-text-secondary)]">
          Исполняемый каталог компонентов, состояний и правил интерфейса СУПА ПРО.
        </p>
      </header>
      <UiKitSections />
    </AppShell>
  );
}
