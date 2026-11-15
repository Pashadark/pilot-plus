'use client';

import { useMemo, useState } from 'react';

import type { RentalConstructorBootstrap } from '../server/bootstrap';
import type { RentalConstructorSectionId, RentalConstructorState } from '../domain/types';
import { ConstructorSections } from './ConstructorSections';

export function RentalConstructor({ bootstrap }: { bootstrap: RentalConstructorBootstrap }) {
  const [activeSection, setActiveSection] = useState<RentalConstructorSectionId>('general');
  const initialState = useMemo<RentalConstructorState>(
    () => ({
      agreementType: 'STANDARD',
      clientMode: 'existing',
      companyId: bootstrap.companyId,
      clientId: bootstrap.preferredClient?.id,
      clientFullName: bootstrap.preferredClient?.fullName,
      clientPhone: bootstrap.preferredClient?.phone,
    }),
    [bootstrap],
  );
  const [state] = useState(initialState);

  return (
    <main className="grid min-w-0 gap-4 p-4 sm:p-6" data-testid="rental-constructor">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Новый клиент и договор</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Один процесс: клиент, автомобиль, условия и готовый договор
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
          Черновик · автосохранение
        </span>
      </header>

      <div className="grid min-h-[68dvh] gap-4 xl:grid-cols-[17rem_minmax(24rem,1fr)_minmax(28rem,1.15fr)]">
        <ConstructorSections active={activeSection} state={state} onSelect={setActiveSection} />
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold">
            {activeSection === 'general' ? 'Общие данные' : 'Клиент'}
          </h2>
          {state.clientFullName ? (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-elevated)] p-3">
              <b>{state.clientFullName}</b>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {state.clientPhone ?? 'Телефон не указан'}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Выберите существующего клиента или создайте нового.
            </p>
          )}
        </section>
        <aside className="hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] xl:block">
          <h2 className="text-lg font-bold">Предварительный просмотр договора</h2>
          <div className="mt-4 min-h-[52rem] rounded-sm bg-white p-8 text-sm text-neutral-900 shadow-inner">
            <p className="text-center font-serif text-lg font-bold uppercase">
              Договор проката транспортного средства
            </p>
            <p className="mt-8 font-serif leading-7">
              Клиент: {state.clientFullName ?? '[не выбран]'}. Документ обновляется по мере
              заполнения конструктора.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
