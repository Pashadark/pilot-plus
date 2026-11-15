# Client and Rental Contract Constructor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragmented new-rental flow with one `/rentals/new` constructor that creates or selects a client, verifies documents, selects a vehicle, saves rental terms, previews the contract, records issuance data, and safely confirms the rental and documents.

**Architecture:** Reuse the existing `Client`, `Rental`, client-document, availability, readiness, payment, and document-generation modules. A focused client-side constructor owns transient state; a pure shared domain model validates sections and supplies the preview; existing server actions persist a real `Rental` draft only after client, vehicle, dates, and template are available. Final confirmation remains idempotent and uses the existing serializable confirmation and document-generation path.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript 5 strict mode, Tailwind CSS 4, Prisma 6.16/PostgreSQL, Vitest, Testing Library, Playwright, existing Supa Pro UI primitives.

## Global Constraints

- Use **Supa Pro** or the established Russian uppercase form **СУПА ПРО**; do not introduce retired product names.
- Reuse the approved production logo unchanged; this feature does not create a new logo asset.
- Keep the existing App Router, Server Actions, client-document storage, rental confirmation, and document-generation architecture.
- Do not create a parallel client, rental, upload, payment, or document model.
- Do not add a form library; the installed stack already supplies React actions and project form primitives.
- Read `node_modules/next/dist/docs/01-app/03-api-reference/02-components/form.md` and the installed Server Actions guide before changing form or action code.
- Preserve tenant scoping, permission checks, encryption, malware scanning, idempotency, and audit logging.
- Do not run migrations, seeds, or destructive database commands against the shared or production database during tests.
- Keep light and dark themes and mobile touch targets of at least 44 px.

---

## File Structure

**Create**

- `src/modules/rentals/constructor/domain/types.ts` — constructor state and section identifiers.
- `src/modules/rentals/constructor/domain/flow.ts` — section completion and validation rules.
- `src/modules/rentals/constructor/domain/preview.ts` — pure contract preview view model.
- `src/modules/rentals/constructor/server/bootstrap.ts` — tenant-scoped initial clients, vehicles, template, and company data.
- `src/modules/rentals/constructor/server/actions.ts` — draft client, rental autosave, and finalization facade over existing services.
- `src/modules/rentals/constructor/components/RentalConstructor.tsx` — state coordinator and responsive shell.
- `src/modules/rentals/constructor/components/ConstructorSections.tsx` — desktop/mobile progress navigation.
- `src/modules/rentals/constructor/components/ClientSection.tsx` — existing/new client workflow.
- `src/modules/rentals/constructor/components/DocumentsSection.tsx` — document uploads and verification.
- `src/modules/rentals/constructor/components/VehicleSection.tsx` — vehicle selection and readiness.
- `src/modules/rentals/constructor/components/TermsSection.tsx` — dates, money, mileage, territory, addresses.
- `src/modules/rentals/constructor/components/HandoverSection.tsx` — odometer, fuel, condition, drivers, notes.
- `src/modules/rentals/constructor/components/ContractPreview.tsx` — live A4 preview.
- `src/modules/rentals/constructor/components/ConstructorFooter.tsx` — save state and navigation actions.
- Matching unit tests beside each domain/server/component file.

**Modify**

- `src/app/(protected)/rentals/new/page.tsx` — render the unified constructor.
- `src/app/(protected)/clients/[id]/rentals/new/page.tsx` — redirect to `/rentals/new?client=<id>`.
- `src/modules/rentals/server/actions.ts` — add optimistic concurrency to draft updates without changing existing callers.
- `src/modules/rentals/booking/server/workflow.ts` — extract idempotent payment recording so constructor and booking reuse it.
- `src/modules/rentals/components/rental-wizard-flow.ts` — remove as active flow after compatibility tests are migrated.
- `src/modules/rentals/components/RentalWizard.tsx` — retire from creation routes after parity is verified.
- `tests/rentals.spec.ts` — browser coverage for the new constructor on an explicitly disposable database only.

No Prisma schema migration is required for the first vertical release. Transient state remains local until an existing or draft client and valid rental core make an ordinary `Rental` draft possible.

---

### Task 1: Constructor State and Seven-Section Flow

**Files:**
- Create: `src/modules/rentals/constructor/domain/types.ts`
- Create: `src/modules/rentals/constructor/domain/flow.ts`
- Test: `src/modules/rentals/constructor/domain/flow.test.ts`

**Interfaces:**
- Produces: `RentalConstructorState`, `RentalConstructorSectionId`, `constructorSections`, `sectionStatus(state, id)`, and `validateSection(state, id)`.
- Consumes: no server or React dependencies.

- [ ] **Step 1: Write the failing flow tests**

```ts
import { describe, expect, it } from 'vitest';
import { constructorSections, sectionStatus, validateSection } from './flow';
import type { RentalConstructorState } from './types';

const empty = { agreementType: 'STANDARD', clientMode: 'existing' } as RentalConstructorState;

describe('rental constructor flow', () => {
  it('uses the approved seven sections', () => {
    expect(constructorSections.map((section) => section.id)).toEqual([
      'general', 'client', 'documents', 'vehicle', 'terms', 'handover', 'review',
    ]);
  });

  it('requires a client before documents and rental data', () => {
    expect(validateSection(empty, 'client')).toContain('Выберите или создайте клиента');
    expect(sectionStatus(empty, 'client')).toBe('error');
  });

  it('marks a valid section complete', () => {
    const state = { ...empty, clientId: 'client-1', clientFullName: 'Анна Петровна' };
    expect(validateSection(state, 'client')).toEqual([]);
    expect(sectionStatus(state, 'client')).toBe('complete');
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `npx vitest run src/modules/rentals/constructor/domain/flow.test.ts`

Expected: FAIL because `./flow` and `./types` do not exist.

- [ ] **Step 3: Add the explicit constructor types**

```ts
export type RentalConstructorSectionId =
  | 'general' | 'client' | 'documents' | 'vehicle' | 'terms' | 'handover' | 'review';

export type RentalConstructorSectionStatus = 'idle' | 'complete' | 'warning' | 'error';

export type RentalConstructorState = {
  companyId?: string;
  rentalId?: string;
  expectedUpdatedAt?: string;
  agreementType: 'STANDARD' | 'LEASE_TO_OWN';
  clientMode: 'existing' | 'new';
  clientId?: string;
  clientFullName?: string;
  documentsReady?: boolean;
  vehicleId?: string;
  vehicleAvailable?: boolean;
  startsAt?: string;
  endsAt?: string;
  dailyRateMinor?: number;
  discountMinor?: number;
  servicesMinor?: number;
  depositMinor?: number;
  includedMileageKm?: number | null;
  pickupAddress?: string;
  returnAddress?: string;
  territory?: string;
  paymentTerms?: string;
  startMileageKm?: number;
  startFuelPercent?: number;
  conditions?: string;
  allowedDrivers?: string;
};
```

- [ ] **Step 4: Implement deterministic validation and status calculation**

```ts
import type { RentalConstructorSectionId, RentalConstructorState } from './types';

export const constructorSections = [
  ['general', 'Общие данные'], ['client', 'Клиент'], ['documents', 'Документы'],
  ['vehicle', 'Автомобиль'], ['terms', 'Условия аренды'],
  ['handover', 'Выдача автомобиля'], ['review', 'Проверка'],
] as const satisfies readonly (readonly [RentalConstructorSectionId, string])[];

export function validateSection(state: RentalConstructorState, id: RentalConstructorSectionId) {
  if (id === 'general') return state.companyId ? [] : ['Не выбрана компания.'];
  if (id === 'client') return state.clientId ? [] : ['Выберите или создайте клиента.'];
  if (id === 'documents') return state.documentsReady ? [] : ['Проверьте паспорт и водительское удостоверение.'];
  if (id === 'vehicle') {
    if (!state.vehicleId) return ['Выберите автомобиль.'];
    return state.vehicleAvailable === false ? ['Автомобиль недоступен на выбранный период.'] : [];
  }
  if (id === 'terms') {
    return state.startsAt && state.endsAt && state.dailyRateMinor !== undefined
      ? [] : ['Укажите срок и стоимость аренды.'];
  }
  if (id === 'handover') {
    return state.startMileageKm !== undefined && state.startFuelPercent !== undefined
      ? [] : ['Укажите одометр и топливо при выдаче.'];
  }
  return constructorSections
    .filter(([section]) => section !== 'review')
    .flatMap(([section]) => validateSection(state, section));
}

export function sectionStatus(state: RentalConstructorState, id: RentalConstructorSectionId) {
  return validateSection(state, id).length ? 'error' as const : 'complete' as const;
}
```

- [ ] **Step 5: Run the focused test and commit**

Run: `npx vitest run src/modules/rentals/constructor/domain/flow.test.ts`

Expected: PASS.

```bash
git add src/modules/rentals/constructor/domain
git commit -m "feat: define rental constructor flow"
```

---

### Task 2: Tenant-Scoped Constructor Bootstrap and Unified Route

**Files:**
- Create: `src/modules/rentals/constructor/server/bootstrap.ts`
- Test: `src/modules/rentals/constructor/server/bootstrap.test.ts`
- Modify: `src/app/(protected)/rentals/new/page.tsx`
- Modify: `src/app/(protected)/clients/[id]/rentals/new/page.tsx`
- Test: `src/app/(protected)/rentals/page.test.tsx`

**Interfaces:**
- Produces: `getRentalConstructorBootstrap(access, preferredClientId?)` returning company, published template, client options, vehicle options, and preferred client.
- Consumes: `getClients`, `getClientById`, `listRentalDraftVehicleOptions`, `requireRentalAccess`.

- [ ] **Step 1: Write a bootstrap access test**

```ts
it('never returns a preferred client from another company', async () => {
  const result = await getRentalConstructorBootstrap(companyAccess, 'foreign-client');
  expect(result.preferredClient).toBeNull();
  expect(result.clients.every((client) => client.companyId === companyAccess.companyIds[0])).toBe(true);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/modules/rentals/constructor/server/bootstrap.test.ts`

Expected: FAIL because `getRentalConstructorBootstrap` is not defined.

- [ ] **Step 3: Implement one parallel bootstrap query**

```ts
export async function getRentalConstructorBootstrap(
  access: ClientAccess,
  preferredClientId?: string,
) {
  const companyId = access.scope === 'COMPANY' ? access.companyIds[0] : access.companyIds[0];
  await requireRentalAccess(companyId);
  const [clients, vehicles, template, preferredClient] = await Promise.all([
    getClients(access, { page: 1, pageSize: 50 }),
    listRentalDraftVehicleOptions(companyId),
    prisma.contractTemplateVersion.findFirst({
      where: { companyId, isPublished: true }, orderBy: { publishedAt: 'desc' }, select: { id: true },
    }),
    preferredClientId ? getClientById(access, preferredClientId) : Promise.resolve(null),
  ]);
  return {
    companyId,
    templateVersionId: template?.id ?? null,
    clients: clients.items,
    vehicles,
    preferredClient: preferredClient?.companyId === companyId ? preferredClient : null,
  };
}
```

- [ ] **Step 4: Replace the client-picker route with constructor bootstrap**

```tsx
export default async function NewRentalPage({ searchParams }: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const access = await requireClientAccess('VIEW_CLIENTS');
  const bootstrap = await getRentalConstructorBootstrap(access, client);
  return (
    <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Договоры', href: '/rentals' }, { label: 'Новый договор' }]}>
      <RentalConstructor bootstrap={bootstrap} />
    </AppShell>
  );
}
```

- [ ] **Step 5: Preserve old deep links with a server redirect**

```ts
export default async function LegacyNewRentalRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/rentals/new?client=${encodeURIComponent(id)}`);
}
```

- [ ] **Step 6: Run route and bootstrap tests and commit**

Run: `npx vitest run src/modules/rentals/constructor/server/bootstrap.test.ts src/app/(protected)/rentals/page.test.tsx`

Expected: PASS.

```bash
git add src/modules/rentals/constructor/server src/app/(protected)/rentals/new src/app/(protected)/clients/[id]/rentals/new
git commit -m "feat: route new rentals through constructor"
```

---

### Task 3: Integrated Client Creation and Document Verification

**Files:**
- Create: `src/modules/rentals/constructor/components/ClientSection.tsx`
- Create: `src/modules/rentals/constructor/components/DocumentsSection.tsx`
- Create: `src/modules/rentals/constructor/server/actions.ts`
- Test: `src/modules/rentals/constructor/components/ClientSection.test.tsx`
- Test: `src/modules/rentals/constructor/components/DocumentsSection.test.tsx`
- Test: `src/modules/rentals/constructor/server/actions.test.ts`

**Interfaces:**
- Produces: `createConstructorClientAction(previous, formData)` and `ConstructorClientResult`.
- Consumes: existing client validation/encryption, `uploadClientDocumentAction`, `ClientDocumentAutofillDialog`, and duplicate indexes.

- [ ] **Step 1: Write component tests for existing and new clients**

```tsx
it('selects an existing client without leaving the constructor', async () => {
  render(<ClientSection clients={[client]} selectedId={undefined} onSelected={selected} />);
  await userEvent.click(screen.getByRole('button', { name: /Щапова Анна Петровна/ }));
  expect(selected).toHaveBeenCalledWith(expect.objectContaining({ id: client.id }));
});

it('shows duplicate candidates before creating a new client', async () => {
  render(<ClientSection clients={[client]} selectedId={undefined} onSelected={selected} />);
  await userEvent.click(screen.getByRole('button', { name: 'Создать нового' }));
  await userEvent.type(screen.getByLabelText('Телефон'), '+7 950 080-99-08');
  expect(screen.getByText(/Возможный дубликат/)).toBeTruthy();
});
```

- [ ] **Step 2: Write the server test for a draft client**

```ts
it('creates a tenant-scoped draft client and returns its id', async () => {
  const result = await createConstructorClientAction(null, validClientFormData());
  expect(result).toMatchObject({ ok: true, client: { status: 'DRAFT' } });
});
```

- [ ] **Step 3: Implement the action as a narrow adapter over existing client creation**

```ts
export type ConstructorClientResult =
  | { ok: true; client: { id: string; fullName: string; phone: string | null; status: string } }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string> };

export async function createConstructorClientAction(
  _previous: ConstructorClientResult | null,
  formData: FormData,
): Promise<ConstructorClientResult> {
  formData.set('status', 'DRAFT');
  const result = await createClientAction({ status: 'idle' }, formData);
  if (result.status !== 'success' || !result.client) {
    return { ok: false, code: 'CLIENT_INVALID', message: result.status === 'error' ? result.message : 'Не удалось создать клиента.' };
  }
  return { ok: true, client: result.client };
}
```

- [ ] **Step 4: Reuse the existing secure upload and OCR components**

`DocumentsSection` must pass the selected `clientId` to existing upload actions, show `UPLOADING`, `QUARANTINED`, `CLEAN`, and failed states, and emit `documentsReady=true` only when the current clean versions include `PASSPORT` and `DRIVER_LICENSE`.

```tsx
const required = new Set(documents.filter((item) => item.status === 'CLEAN').map((item) => item.category));
const ready = required.has('PASSPORT') && required.has('DRIVER_LICENSE');
useEffect(() => onReadinessChange(ready), [onReadinessChange, ready]);
```

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run src/modules/rentals/constructor/components/ClientSection.test.tsx src/modules/rentals/constructor/components/DocumentsSection.test.tsx src/modules/rentals/constructor/server/actions.test.ts`

Expected: PASS.

```bash
git add src/modules/rentals/constructor src/modules/clients src/modules/client-documents
git commit -m "feat: integrate clients and documents into rental constructor"
```

---

### Task 4: Vehicle, Terms, Real Rental Draft, and Optimistic Autosave

**Files:**
- Create: `src/modules/rentals/constructor/components/VehicleSection.tsx`
- Create: `src/modules/rentals/constructor/components/TermsSection.tsx`
- Modify: `src/modules/rentals/constructor/server/actions.ts`
- Modify: `src/modules/rentals/server/actions.ts`
- Test: `src/modules/rentals/constructor/server/actions.test.ts`
- Test: `src/modules/rentals/server/actions.test.ts`

**Interfaces:**
- Produces: `saveConstructorDraftAction(previous, formData)` returning `rentalId`, `updatedAt`, and normalized calculation.
- Consumes: `createRentalDraftAction`, `updateRentalDraftAction`, `calculateRental`, readiness, and availability.

- [ ] **Step 1: Add failing tests for autosave idempotency and stale writes**

```ts
it('reuses the same rental draft on repeated autosave', async () => {
  const first = await saveConstructorDraftAction(null, validDraft());
  const second = await saveConstructorDraftAction(null, validDraft({ rentalId: first.rentalId }));
  expect(second.ok && second.rentalId).toBe(first.ok && first.rentalId);
});

it('rejects a stale expectedUpdatedAt value', async () => {
  const result = await updateRentalDraftAction(null, validDraft({ expectedUpdatedAt: '2026-11-01T00:00:00.000Z' }));
  expect(result).toMatchObject({ ok: false, code: 'STALE' });
});
```

- [ ] **Step 2: Extend draft updates with optional optimistic concurrency**

```ts
const expectedUpdatedAtRaw = String(formData.get('expectedUpdatedAt') ?? '').trim();
const expectedUpdatedAt = expectedUpdatedAtRaw ? new Date(expectedUpdatedAtRaw) : null;
const updated = await tx.rental.updateMany({
  where: {
    id: rentalId,
    companyId: value.companyId,
    status: 'DRAFT',
    ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}),
  },
  data,
});
if (updated.count === 0) throw new Error(expectedUpdatedAt ? 'STALE' : 'NOT_DRAFT');
```

Return the saved `updatedAt` and map `STALE` to: `Черновик уже изменён в другой вкладке. Обновите данные.` Existing callers may omit `expectedUpdatedAt` and retain current behavior.

- [ ] **Step 3: Implement the constructor adapter**

```ts
export async function saveConstructorDraftAction(
  _previous: ConstructorDraftResult | null,
  formData: FormData,
): Promise<ConstructorDraftResult> {
  const rentalId = String(formData.get('rentalId') ?? '').trim();
  const result = rentalId
    ? await updateRentalDraftAction(null, formData)
    : await createRentalDraftAction(null, formData);
  return result.ok
    ? { ok: true, rentalId: result.rentalId, updatedAt: result.updatedAt }
    : { ok: false, code: result.code, message: result.message };
}
```

- [ ] **Step 4: Build vehicle and term sections from existing options**

`VehicleSection` renders image, model, plate, status, price, readiness blockers, and selected state. `TermsSection` uses `calculateRental`, `resolveRentalMileagePolicy`, and current regional-geofence region data. It must not duplicate price or mileage formulas in JSX.

- [ ] **Step 5: Debounce autosave only after all core rental fields are valid**

```ts
useEffect(() => {
  if (!state.clientId || !state.vehicleId || !state.startsAt || !state.endsAt || !templateVersionId) return;
  const timer = window.setTimeout(() => startTransition(() => saveDraft(toFormData(state))), 700);
  return () => window.clearTimeout(timer);
}, [saveDraft, state, templateVersionId]);
```

- [ ] **Step 6: Run server and component tests and commit**

Run: `npx vitest run src/modules/rentals/server/actions.test.ts src/modules/rentals/constructor/server/actions.test.ts`

Expected: PASS, including existing draft callers.

```bash
git add src/modules/rentals/server/actions.ts src/modules/rentals/constructor
git commit -m "feat: autosave constructor rental drafts"
```

---

### Task 5: Live Contract Preview and Responsive Constructor Shell

**Files:**
- Create: `src/modules/rentals/constructor/domain/preview.ts`
- Create: `src/modules/rentals/constructor/domain/preview.test.ts`
- Create: `src/modules/rentals/constructor/components/RentalConstructor.tsx`
- Create: `src/modules/rentals/constructor/components/ConstructorSections.tsx`
- Create: `src/modules/rentals/constructor/components/ContractPreview.tsx`
- Create: `src/modules/rentals/constructor/components/ConstructorFooter.tsx`
- Test: `src/modules/rentals/constructor/components/RentalConstructor.test.tsx`

**Interfaces:**
- Produces: `buildContractPreview(state, bootstrap)` and the complete responsive constructor UI.
- Consumes: pure constructor state, rental calculation, company/client/vehicle bootstrap data.

- [ ] **Step 1: Write preview mapping tests**

```ts
it('uses real state and explicit blanks in the preview', () => {
  const preview = buildContractPreview(state, bootstrap);
  expect(preview.client.fullName).toBe('Щапова Анна Петровна');
  expect(preview.vehicle.registrationNumber).toBe('А123ВС777');
  expect(preview.vehicle.vin).toBe('Не заполнено');
});
```

- [ ] **Step 2: Implement a pure preview view model**

```ts
export function buildContractPreview(state: RentalConstructorState, data: PreviewBootstrap) {
  const blank = (value: string | null | undefined) => value?.trim() || 'Не заполнено';
  return {
    city: blank(data.company.contractCity),
    date: state.startsAt ? state.startsAt.slice(0, 10) : 'Не заполнено',
    client: { fullName: blank(state.clientFullName), phone: blank(data.client?.phone) },
    vehicle: {
      label: blank(data.vehicle ? `${data.vehicle.make} ${data.vehicle.modelName}` : ''),
      registrationNumber: blank(data.vehicle?.registrationNumber),
      vin: blank(data.vehicle?.vin),
    },
    rental: { startsAt: blank(state.startsAt), endsAt: blank(state.endsAt), totalMinor: data.totalMinor },
  };
}
```

- [ ] **Step 3: Build the three-column shell and mobile preview mode**

Desktop uses `grid-cols-[17rem_minmax(26rem,1fr)_minmax(30rem,1.15fr)]`. Below the desktop breakpoint, only the active form is visible and `ContractPreview` opens in an accessible full-screen dialog. The bottom action bar remains sticky and does not cover the final field.

- [ ] **Step 4: Add local recovery before a real rental draft exists**

Use one versioned key scoped by company and user, for example `supa-pro:rental-constructor:v1:<companyId>:<userId>`. Store only non-file field values; never store passport images, license images, encrypted fields, or raw document contents in `localStorage`. Delete the local copy after the first successful server draft save.

- [ ] **Step 5: Run preview and shell tests and commit**

Run: `npx vitest run src/modules/rentals/constructor/domain/preview.test.ts src/modules/rentals/constructor/components/RentalConstructor.test.tsx`

Expected: PASS.

```bash
git add src/modules/rentals/constructor
git commit -m "feat: add live rental contract preview"
```

---

### Task 6: Issuance Data, Payments, and Idempotent Finalization

**Files:**
- Create: `src/modules/rentals/constructor/components/HandoverSection.tsx`
- Modify: `src/modules/rentals/constructor/server/actions.ts`
- Modify: `src/modules/rentals/booking/server/workflow.ts`
- Test: `src/modules/rentals/constructor/server/actions.test.ts`
- Test: `src/modules/rentals/booking/server/workflow.test.ts`
- Test: `src/modules/rentals/server/confirm-rental.test.ts`

**Interfaces:**
- Produces: `finalizeRentalConstructorAction(previous, formData)`.
- Consumes: `confirmAndGenerateRentalAction`, idempotent payment recorder, existing rental snapshot issuance fields, and existing operation-media services when media is supplied.

- [ ] **Step 1: Extract a reusable payment recorder with existing booking behavior unchanged**

```ts
export function createRentalPaymentRecorder(database: BookingDatabase) {
  return async (input: {
    companyId: string; rentalId: string; actorUserId: string; actorEmail: string;
    kind: 'RENT' | 'DEPOSIT'; amountMinor: bigint;
    method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'; idempotencyKey: string;
  }) => database.$transaction(async (transaction) => {
    const existing = await transaction.rentalPayment.findUnique({
      where: { companyId_rentalId_idempotencyKey: {
        companyId: input.companyId, rentalId: input.rentalId, idempotencyKey: input.idempotencyKey,
      } }, select: { id: true },
    });
    if (existing) return { id: existing.id, reused: true as const };
    const payment = await transaction.rentalPayment.create({ data: {
      companyId: input.companyId, rentalId: input.rentalId, kind: input.kind,
      status: 'CONFIRMED', amountMinor: input.amountMinor, currency: 'RUB',
      method: input.method, idempotencyKey: input.idempotencyKey,
      recordedByUserId: input.actorUserId,
    }, select: { id: true } });
    return { id: payment.id, reused: false as const };
  });
}
```

- [ ] **Step 2: Test finalization retry safety**

```ts
it('does not duplicate confirmation, rent payment, deposit payment, or documents on retry', async () => {
  const first = await finalizeRentalConstructorAction(null, finalFormData());
  const second = await finalizeRentalConstructorAction(null, finalFormData());
  expect(second).toMatchObject({ ok: true, rentalId: first.ok && first.rentalId });
  expect(await countPayments(first.ok && first.rentalId)).toBe(2);
});
```

- [ ] **Step 3: Implement finalization as an explicit orchestration**

The action validates every section, updates the final draft snapshot, confirms the rental through the existing serializable transaction, records only payments explicitly marked as received, and requests the document pair. The deposit payment uses `constructor:<rentalId>:deposit`; rent uses `constructor:<rentalId>:rent`. If no payment is marked received, no false payment record is created.

```ts
const confirmed = await confirmAndGenerateRentalAction(null, formData);
if (!confirmed.ok && confirmed.code !== 'DOCUMENT_FAILED') return confirmed;
if (formData.get('rentReceived') === 'true') await recordPayment({
  companyId, rentalId, actorUserId: access.user.id, actorEmail: access.user.email,
  kind: 'RENT', amountMinor: BigInt(String(formData.get('rentReceivedMinor'))),
  method, idempotencyKey: `constructor:${rentalId}:rent`,
});
if (formData.get('depositReceived') === 'true') await recordPayment({
  companyId, rentalId, actorUserId: access.user.id, actorEmail: access.user.email,
  kind: 'DEPOSIT', amountMinor: BigInt(String(formData.get('depositReceivedMinor'))),
  method, idempotencyKey: `constructor:${rentalId}:deposit`,
});
```

- [ ] **Step 4: Keep document failure recoverable**

Return `confirmedNeedsDocuments: true` with the confirmed rental id when PDF/DOCX generation fails. The UI must navigate to the created rental and show the existing safe retry action instead of resubmitting the whole constructor.

- [ ] **Step 5: Run finalization and regression tests and commit**

Run: `npx vitest run src/modules/rentals/constructor/server/actions.test.ts src/modules/rentals/booking/server/workflow.test.ts src/modules/rentals/server/confirm-rental.test.ts`

Expected: PASS.

```bash
git add src/modules/rentals/constructor src/modules/rentals/booking/server src/modules/rentals/server
git commit -m "feat: finalize constructor rentals safely"
```

---

### Task 7: Accessibility, Mobile Behavior, Route Compatibility, and Regression Gate

**Files:**
- Modify: `tests/rentals.spec.ts`
- Modify: `src/modules/rentals/constructor/components/RentalConstructor.test.tsx`
- Modify: `src/modules/rentals/constructor/components/ClientSection.test.tsx`
- Modify: `src/modules/rentals/constructor/components/DocumentsSection.test.tsx`
- Modify: `src/modules/rentals/constructor/components/VehicleSection.test.tsx`
- Modify: `src/modules/rentals/constructor/components/TermsSection.test.tsx`
- Modify: `src/modules/rentals/constructor/components/HandoverSection.test.tsx`
- Modify: `src/modules/rentals/constructor/components/ContractPreview.test.tsx`
- Modify: `src/modules/rentals/components/RentalWizard.tsx` only to remove dead route usage after all tests pass
- Modify: `src/modules/rentals/components/NewRentalClientPicker.tsx` only to remove dead route usage after all tests pass

**Interfaces:**
- Produces: verified vertical flow and removal of obsolete route-only components.
- Consumes: completed constructor.

- [ ] **Step 1: Add component accessibility checks**

Verify one `main`, one page `h1`, `aria-current="step"`, labels for every control, an `aria-live="polite"` autosave status, keyboard navigation between completed sections, and focus transfer to the active section heading.

- [ ] **Step 2: Add disposable-database Playwright coverage**

```ts
test('creates a client and rental from one constructor', async ({ page }) => {
  test.skip(process.env.PILOT_RENTALS_E2E !== '1');
  await page.goto('/rentals/new');
  await page.getByRole('button', { name: 'Создать нового' }).click();
  await page.getByLabel('Фамилия').fill('Щапова');
  await page.getByLabel('Имя').fill('Анна');
  await page.getByLabel('Телефон').fill('+7 950 080-99-08');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Предварительный просмотр договора')).toBeVisible();
});
```

- [ ] **Step 3: Test responsive behavior**

At 390×844, assert that the desktop preview column is hidden, the «Предпросмотр договора» button opens a full-screen dialog, the sticky footer remains visible, and closing the dialog preserves field values.

- [ ] **Step 4: Run the complete verification gate**

Run in order:

```bash
npx vitest run src/modules/rentals/constructor src/modules/rentals/server/actions.test.ts src/modules/rentals/server/confirm-rental.test.ts src/modules/rentals/booking/server/workflow.test.ts
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit 0. Run `PILOT_RENTALS_E2E=1 npx playwright test tests/rentals.spec.ts --workers=1` only against the documented disposable database.

- [ ] **Step 5: Remove route-only obsolete components after the full gate passes**

Use `rg` to confirm `RentalWizard` and `NewRentalClientPicker` have no remaining production imports. Remove only truly dead files; retain shared domain/server helpers and their regression tests.

- [ ] **Step 6: Commit the verified vertical feature**

```bash
git add src tests
git commit -m "feat: complete client rental contract constructor"
```

---

## Final Verification Checklist

- `/rentals/new` provides all seven approved sections on one page.
- Existing client and new client paths both work without leaving the constructor.
- Passport and license uploads use the existing secure pipeline.
- A rental draft is created only when the existing `Rental` model has valid required relations.
- Autosave does not overwrite a newer draft.
- Preview uses only real or explicitly blank data.
- Vehicle availability is checked during selection, autosave, and final confirmation.
- Payment records reflect only money explicitly marked received.
- Final retry does not duplicate clients, rentals, payments, documents, or audit entries.
- Document-generation failure leaves a valid confirmed rental with a safe retry path.
- Legacy client-specific creation links redirect to the unified constructor.
- Desktop, mobile, keyboard, light theme, and dark theme pass focused checks.
- Existing rental detail, editing, booking, settlement, document download, and operational flows remain green.
