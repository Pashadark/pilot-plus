'use client';

import { useCallback, useMemo, useState } from 'react';

import type { RentalConstructorBootstrap } from '../server/bootstrap';
import type { RentalConstructorSectionId, RentalConstructorState } from '../domain/types';
import { ConstructorSections } from './ConstructorSections';
import { ClientSection } from './ClientSection';
import { DocumentsSection } from './DocumentsSection';

function hasRequiredDocuments(
  documents: RentalConstructorBootstrap['documentsByClientId'][string] = [],
) {
  const categories = new Set(
    documents.filter((document) => document.status === 'CLEAN').map((document) => document.category),
  );
  return categories.has('PASSPORT') && categories.has('DRIVER_LICENSE');
}

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
      documentsReady: bootstrap.preferredClient
        ? hasRequiredDocuments(bootstrap.documentsByClientId[bootstrap.preferredClient.id])
        : false,
    }),
    [bootstrap],
  );
  const [state, setState] = useState(initialState);
  const selectClient = useCallback(
    (client: RentalConstructorBootstrap['clients'][number]) => {
      setState((current) => ({
        ...current,
        clientId: client.id,
        clientFullName: client.fullName,
        clientPhone: client.phone,
        clientMode: client.status === 'DRAFT' ? 'new' : 'existing',
        documentsReady: hasRequiredDocuments(bootstrap.documentsByClientId[client.id]),
      }));
    },
    [bootstrap.documentsByClientId],
  );
  const setDocumentsReady = useCallback((ready: boolean) => {
    setState((current) =>
      current.documentsReady === ready ? current : { ...current, documentsReady: ready },
    );
  }, []);

  const activeContent = (() => {
    if (activeSection === 'client') {
      return (
        <ClientSection
          companyId={bootstrap.companyId}
          clients={bootstrap.clients}
          selectedId={state.clientId}
          onSelected={selectClient}
        />
      );
    }
    if (activeSection === 'documents') {
      return (
        <DocumentsSection
          clientId={state.clientId}
          clientName={state.clientFullName}
          documents={state.clientId ? (bootstrap.documentsByClientId[state.clientId] ?? []) : []}
          onReadinessChange={setDocumentsReady}
        />
      );
    }
    return (
      <>
        <h2 className="text-lg font-bold">
          {activeSection === 'general' ? 'Общие данные' : 'Раздел в подготовке'}
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
      </>
    );
  })();

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
          {activeContent}
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
