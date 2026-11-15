'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { moscowLocalToUtc } from '@/modules/rentals/domain/calculate-rental';
import { Modal } from '@/shared/ui/Overlays';
import { buildContractPreview } from '../domain/preview';
import type { RentalConstructorBootstrap } from '../server/bootstrap';
import type { RentalConstructorSectionId, RentalConstructorState } from '../domain/types';
import { saveConstructorDraftAction } from '../server/actions';
import { ContractPreview } from './ContractPreview';
import { ConstructorFooter } from './ConstructorFooter';
import { ConstructorSections } from './ConstructorSections';
import { ClientSection } from './ClientSection';
import { DocumentsSection } from './DocumentsSection';
import { TermsSection } from './TermsSection';
import { VehicleSection, vehicleSelectionStatus } from './VehicleSection';

const recoveryFields = [
  'agreementType',
  'clientId',
  'vehicleId',
  'startsAt',
  'endsAt',
  'dailyRateMinor',
  'discountMinor',
  'servicesMinor',
  'depositMinor',
  'pickupAddress',
  'returnAddress',
  'territory',
  'paymentTerms',
  'startMileageKm',
  'startFuelPercent',
  'conditions',
  'allowedDrivers',
] as const satisfies readonly (keyof RentalConstructorState)[];

function recoverySnapshot(state: RentalConstructorState) {
  return Object.fromEntries(
    recoveryFields.flatMap((field) =>
      state[field] === undefined ? [] : [[field, state[field]]],
    ),
  );
}

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const recoveryKey = `supa-pro:rental-constructor:v1:${bootstrap.companyId}:${bootstrap.userId}`;
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(recoveryKey);
      if (raw) {
        const recovered = JSON.parse(raw) as Partial<RentalConstructorState>;
        setState((current) => {
          const next = { ...current };
          for (const field of recoveryFields) {
            if (recovered[field] !== undefined) {
              Object.assign(next, { [field]: recovered[field] });
            }
          }
          const client = bootstrap.clients.find((item) => item.id === next.clientId);
          if (client) {
            next.clientId = client.id;
            next.clientFullName = client.fullName;
            next.clientPhone = client.phone;
            next.clientMode = client.status === 'DRAFT' ? 'new' : 'existing';
            next.documentsReady = hasRequiredDocuments(
              bootstrap.documentsByClientId[client.id],
            );
          } else if (next.clientId) {
            next.clientId = undefined;
          }
          const vehicle = bootstrap.vehicles.find((item) => item.id === next.vehicleId);
          if (vehicle) {
            next.vehicleAvailable = vehicleSelectionStatus(
              vehicle,
              next.startsAt,
              next.endsAt,
            ).available;
          } else if (next.vehicleId) {
            next.vehicleId = undefined;
          }
          return next;
        });
      }
    } catch {
      window.localStorage.removeItem(recoveryKey);
    } finally {
      setRecoveryReady(true);
    }
  }, [bootstrap, recoveryKey]);
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
        window.localStorage.removeItem(recoveryKey);
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
    [bootstrap.templateVersionId, recoveryKey],
  );

  useEffect(() => {
    if (!recoveryReady) return;
    if (!draftFormData(stateRef.current, bootstrap.templateVersionId)) return;
    const timer = window.setTimeout(() => void performAutosave(), 700);
    return () => window.clearTimeout(timer);
  }, [autosaveFingerprint, bootstrap.templateVersionId, performAutosave, recoveryReady]);

  useEffect(() => {
    if (!recoveryReady || state.rentalId) return;
    window.localStorage.setItem(recoveryKey, JSON.stringify(recoverySnapshot(state)));
  }, [autosaveFingerprint, recoveryKey, recoveryReady, state, state.rentalId]);

  const selectedClient = bootstrap.clients.find((client) => client.id === state.clientId) ?? null;
  const selectedVehicle =
    bootstrap.vehicles.find((vehicle) => vehicle.id === state.vehicleId) ?? null;
  const preview = useMemo(
    () =>
      buildContractPreview(state, {
        company: bootstrap.company,
        client: selectedClient,
        vehicle: selectedVehicle,
      }),
    [bootstrap.company, selectedClient, selectedVehicle, state],
  );

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
    <main className="grid min-w-0 gap-4 p-4 pb-24 sm:p-6 sm:pb-24" data-testid="rental-constructor">
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

      <div className="grid min-h-[68dvh] gap-4 xl:grid-cols-[17rem_minmax(26rem,1fr)_minmax(30rem,1.15fr)]">
        <ConstructorSections active={activeSection} state={state} onSelect={setActiveSection} />
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
          {activeContent}
        </section>
        <aside className="hidden min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-elevated)] p-4 shadow-[var(--shadow-card)] xl:block">
          <h2 className="text-lg font-bold">Предварительный просмотр договора</h2>
          <div className="mt-4 max-h-[calc(100dvh-12rem)] overflow-y-auto rounded-[var(--radius-md)] p-2">
            <ContractPreview preview={preview} />
          </div>
        </aside>
      </div>

      <ConstructorFooter
        active={activeSection}
        onSelect={setActiveSection}
        onPreview={() => setPreviewOpen(true)}
      />

      <Modal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Предварительный просмотр договора"
        className="h-[calc(100dvh-1rem)] max-w-4xl overflow-y-auto p-3 sm:h-[calc(100dvh-2rem)] sm:p-5 xl:hidden"
        backdropClassName="p-2 sm:p-4 xl:hidden"
      >
        <ContractPreview preview={preview} />
      </Modal>
    </main>
  );
}
