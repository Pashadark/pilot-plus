'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { moscowLocalToUtc } from '@/modules/rentals/domain/calculate-rental';
import type { RentalConstructorBootstrap } from '../server/bootstrap';
import type { RentalConstructorSectionId, RentalConstructorState } from '../domain/types';
import { saveConstructorDraftAction } from '../server/actions';
import { ConstructorSections } from './ConstructorSections';
import { ClientSection } from './ClientSection';
import { DocumentsSection } from './DocumentsSection';
import { TermsSection } from './TermsSection';
import { VehicleSection, vehicleSelectionStatus } from './VehicleSection';

function hasRequiredDocuments(
  documents: RentalConstructorBootstrap['documentsByClientId'][string] = [],
) {
  const categories = new Set(
    documents.filter((document) => document.status === 'CLEAN').map((document) => document.category),
  );
  return categories.has('PASSPORT') && categories.has('DRIVER_LICENSE');
}

function draftFormData(state: RentalConstructorState, templateVersionId: string | null) {
  if (
    !state.companyId ||
    !state.clientId ||
    !state.vehicleId ||
    !state.startsAt ||
    !state.endsAt ||
    !templateVersionId
  ) {
    return null;
  }
  let startsAt: string;
  let endsAt: string;
  try {
    startsAt = moscowLocalToUtc(state.startsAt).toISOString();
    endsAt = moscowLocalToUtc(state.endsAt).toISOString();
  } catch {
    return null;
  }
  const formData = new FormData();
  const values: Record<string, string | number | undefined | null> = {
    companyId: state.companyId,
    clientId: state.clientId,
    vehicleId: state.vehicleId,
    templateVersionId,
    rentalId: state.rentalId,
    expectedUpdatedAt: state.expectedUpdatedAt,
    agreementType: state.agreementType,
    startsAt,
    endsAt,
    dailyMinor: state.dailyRateMinor,
    discountMinor: state.discountMinor ?? 0,
    servicesMinor: state.servicesMinor ?? 0,
    depositMinor: state.depositMinor,
    pickupAddress: state.pickupAddress,
    returnAddress: state.returnAddress,
    startMileageKm: state.startMileageKm,
    startFuelPercent: state.startFuelPercent,
    territory: state.territory,
    paymentTerms: state.paymentTerms,
    allowedDrivers: state.allowedDrivers,
    conditions: state.conditions,
  };
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value === undefined || value === null ? '' : String(value));
  }
  return formData;
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
  const stateRef = useRef(state);
  stateRef.current = state;
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const rerunSaveRef = useRef(false);
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
  const patchState = useCallback(
    (patch: Partial<RentalConstructorState>) => {
      setState((current) => {
        const next = { ...current, ...patch };
        const selectedVehicle = bootstrap.vehicles.find(
          (vehicle) => vehicle.id === next.vehicleId,
        );
        if (selectedVehicle) {
          next.vehicleAvailable = vehicleSelectionStatus(
            selectedVehicle,
            next.startsAt,
            next.endsAt,
          ).available;
        }
        return next;
      });
    },
    [bootstrap.vehicles],
  );
  const autosaveFingerprint = useMemo(
    () =>
      JSON.stringify({
        companyId: state.companyId,
        clientId: state.clientId,
        vehicleId: state.vehicleId,
        agreementType: state.agreementType,
        startsAt: state.startsAt,
        endsAt: state.endsAt,
        dailyRateMinor: state.dailyRateMinor,
        discountMinor: state.discountMinor,
        servicesMinor: state.servicesMinor,
        depositMinor: state.depositMinor,
        pickupAddress: state.pickupAddress,
        returnAddress: state.returnAddress,
        startMileageKm: state.startMileageKm,
        startFuelPercent: state.startFuelPercent,
        territory: state.territory,
        paymentTerms: state.paymentTerms,
        allowedDrivers: state.allowedDrivers,
        conditions: state.conditions,
      }),
    [
      state.agreementType,
      state.allowedDrivers,
      state.clientId,
      state.companyId,
      state.conditions,
      state.dailyRateMinor,
      state.depositMinor,
      state.discountMinor,
      state.endsAt,
      state.paymentTerms,
      state.pickupAddress,
      state.returnAddress,
      state.servicesMinor,
      state.startFuelPercent,
      state.startMileageKm,
      state.startsAt,
      state.territory,
      state.vehicleId,
    ],
  );
  const performAutosave = useCallback(
    async function performAutosave() {
      if (savingRef.current) {
        rerunSaveRef.current = true;
        return;
      }
      const payload = draftFormData(stateRef.current, bootstrap.templateVersionId);
      if (!payload) return;
      savingRef.current = true;
      setSaveStatus('saving');
      setSaveError('');
      const result = await saveConstructorDraftAction(null, payload);
      if (result.ok) {
        const next = {
          ...stateRef.current,
          rentalId: result.rentalId,
          expectedUpdatedAt: result.updatedAt,
        };
        stateRef.current = next;
        setState(next);
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
        setSaveError(result.message);
      }
      savingRef.current = false;
      if (rerunSaveRef.current) {
        rerunSaveRef.current = false;
        void performAutosave();
      }
    },
    [bootstrap.templateVersionId],
  );

  useEffect(() => {
    if (!draftFormData(stateRef.current, bootstrap.templateVersionId)) return;
    const timer = window.setTimeout(() => void performAutosave(), 700);
    return () => window.clearTimeout(timer);
  }, [autosaveFingerprint, bootstrap.templateVersionId, performAutosave]);

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
    if (activeSection === 'vehicle') {
      return (
        <VehicleSection
          vehicles={bootstrap.vehicles}
          selectedId={state.vehicleId}
          startsAt={state.startsAt}
          endsAt={state.endsAt}
          onSelected={(vehicle, available) =>
            patchState({
              vehicleId: vehicle.id,
              vehicleAvailable: available,
              dailyRateMinor: vehicle.dailyMinor,
              depositMinor: vehicle.depositMinor,
            })
          }
        />
      );
    }
    if (activeSection === 'terms') {
      return <TermsSection state={state} onChange={patchState} />;
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
        <span
          title={saveError || undefined}
          className={`rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold ${saveStatus === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}
        >
          {saveStatus === 'saving'
            ? 'Сохраняем черновик…'
            : saveStatus === 'saved'
              ? 'Черновик сохранён'
              : saveStatus === 'error'
                ? 'Ошибка автосохранения'
                : 'Черновик · автосохранение'}
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
