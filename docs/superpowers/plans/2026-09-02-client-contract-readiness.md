# Client Contract Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-safe vertical flow from client registration through document verification, contract preflight, DOCX/PDF creation, payment, deposit, signatures, and vehicle handover.

**Architecture:** Pure readiness evaluators provide one typed source of truth for UI and server mutations. Tenant-scoped Prisma entities store payments and signatures; existing private document storage and generation machinery remain authoritative. Server Actions authenticate, authorize, validate, re-read tenant-owned rows, mutate idempotently, and revalidate the affected route.

**Tech Stack:** Next.js 16 App Router, React 19 Server Actions, TypeScript, Prisma/PostgreSQL, Zod, Vitest/Testing Library, Playwright, existing DOCX/LibreOffice and private-storage services.

## Global Constraints

- Preserve all existing uncommitted user changes and do not revert unrelated files.
- Read relevant guides under `node_modules/next/dist/docs/` before editing Next.js code.
- Write a failing test and observe the expected failure before each production change.
- Every Server Action authenticates, authorizes, validates untrusted input, and scopes database access by `companyId`.
- Monetary values use integer minor units; private files never enter `public`.
- Existing active rentals keep working; readiness gates apply to new confirmations and new handovers.
- Video remains optional for rental return.
- New routes must provide geometry-matching loading states.
- Final verification includes lint, typecheck, unit tests, credentialed Playwright, and production build.

---

### Task 1: Shared readiness evaluators

**Files:**
- Create: `src/modules/rentals/readiness/types.ts`
- Create: `src/modules/rentals/readiness/evaluate-client-readiness.ts`
- Create: `src/modules/rentals/readiness/evaluate-vehicle-readiness.ts`
- Create: `src/modules/rentals/readiness/evaluate-rental-preflight.ts`
- Test: `src/modules/rentals/readiness/evaluate-client-readiness.test.ts`
- Test: `src/modules/rentals/readiness/evaluate-vehicle-readiness.test.ts`
- Test: `src/modules/rentals/readiness/evaluate-rental-preflight.test.ts`
- Modify: `src/modules/rentals/server/draft-vehicle-options.ts`
- Modify: `src/modules/rentals/server/confirm-rental.ts`

**Interfaces:**
- Produces `ReadinessIssue`, `ReadinessResult`, `evaluateClientReadiness`, `evaluateVehicleReadiness`, and `evaluateRentalPreflight`.
- Consumers receive stable issue codes, Russian labels, severity, and correction links.

- [ ] **Step 1: Write failing readiness tests**

```ts
expect(evaluateClientReadiness({
  status: 'VERIFIED', passport: '4500 123456', driverLicense: '7700 123456',
  driverLicenseExpiresAt: new Date('2027-01-01'), documents: [],
}, new Date('2026-09-02'))).toMatchObject({
  ready: false,
  blockers: expect.arrayContaining([
    expect.objectContaining({ code: 'CLIENT_PASSPORT_FILE_MISSING' }),
    expect.objectContaining({ code: 'CLIENT_LICENSE_FILE_MISSING' }),
  ]),
});
```

```ts
expect(evaluateVehicleReadiness({
  id: 'vehicle-1', archivedAt: null, isRentalReady: true,
  registrationNumber: 'А001АА997', vin: '', registrationCertificateNumber: 'СТС-1',
  vehiclePassportNumber: 'ПТС-1', osagoPolicyNumber: 'ОСАГО-1',
  osagoStartsAt: new Date('2026-01-01'), osagoEndsAt: new Date('2027-01-01'),
  dailyPriceMinor: 500000, depositMinor: 2000000, cascoPolicyNumber: null,
}, new Date('2026-09-03'), new Date('2026-09-05'))).toMatchObject({
  ready: false,
  blockers: [expect.objectContaining({ code: 'VEHICLE_VIN_MISSING' })],
  warnings: [expect.objectContaining({ code: 'VEHICLE_CASCO_MISSING' })],
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/rentals/readiness`

Expected: FAIL because readiness modules do not exist.

- [ ] **Step 3: Implement typed evaluators**

```ts
export type ReadinessIssue = {
  code: string;
  message: string;
  href: string;
  severity: 'BLOCKER' | 'WARNING';
};

export type ReadinessResult = {
  ready: boolean;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
};

export function result(issues: ReadinessIssue[]): ReadinessResult {
  const blockers = issues.filter((issue) => issue.severity === 'BLOCKER');
  return { ready: blockers.length === 0, blockers, warnings: issues.filter((issue) => issue.severity === 'WARNING') };
}
```

Use current clean document versions, expiry dates, required company/template/calculation facts, and overlap results. Do not infer readiness from the display status alone.

- [ ] **Step 4: Replace duplicate wizard/confirmation predicates**

`draft-vehicle-options.ts` maps each vehicle to the evaluator result. `confirm-rental.ts` calls `evaluateRentalPreflight` inside its serializable transaction and throws a business error containing the first blocker plus the full typed result for action presentation.

- [ ] **Step 5: Run focused and existing confirmation tests**

Run: `npx vitest run src/modules/rentals/readiness src/modules/rentals/server/draft-vehicle-options.test.ts src/modules/rentals/server/confirm-rental.test.ts`

Expected: PASS.

### Task 2: Client document onboarding and verified-status enforcement

**Files:**
- Modify: `src/modules/clients/components/ClientForm.tsx`
- Modify: `src/modules/clients/components/ClientForm.test.tsx`
- Modify: `src/modules/clients/actions.ts`
- Modify: `src/modules/clients/actions.test.ts`
- Modify: `src/modules/client-documents/components/DocumentsPanel.tsx`
- Modify: `src/modules/clients/components/ClientDetailPage.tsx`
- Create: `src/modules/rentals/readiness/ReadinessCard.tsx`
- Test: `src/modules/rentals/readiness/ReadinessCard.test.tsx`

**Interfaces:**
- Consumes `evaluateClientReadiness` and existing client-document upload actions.
- Produces a reusable `ReadinessCard` with correction links and progress count.

- [ ] **Step 1: Add failing form/action tests**

```ts
it('does not offer VERIFIED when required clean files are absent', () => {
  render(<ClientForm companies={[{ id: 'c1', name: 'СУПА ПРО' }]} />);
  expect(screen.queryByRole('option', { name: 'Проверен' })).not.toBeInTheDocument();
});
```

```ts
await expect(updateClientStatus({ actor: dispatcher, clientId: 'client-1', status: 'VERIFIED' }))
  .rejects.toThrow('Загрузите и дождитесь проверки паспорта и водительского удостоверения.');
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/clients/components/ClientForm.test.tsx src/modules/clients/actions.test.ts`

Expected: FAIL because the UI still offers manual verification and the action lacks readiness enforcement.

- [ ] **Step 3: Implement progressive onboarding**

Keep initial client creation atomic and redirect to `/clients/{id}?tab=documents&onboarding=1`. Replace the disabled file input with an explanation that the saved card is ready for secure upload, then render the existing upload controls immediately on the destination. Preserve entered document metadata and show passport/VU as two explicit required slots.

- [ ] **Step 4: Enforce verified status on the server**

The action re-reads tenant-owned current document versions and calls `evaluateClientReadiness`. Dispatcher/admin cannot set `VERIFIED` or `REGULAR` with blockers. A superadmin override requires `overrideReason` of at least 20 characters and creates an audit row containing issue codes and reason.

- [ ] **Step 5: Add readiness UI to the client card**

```tsx
<ReadinessCard
  title="Готовность к аренде"
  result={readiness}
  completed={facts.filter((fact) => fact.complete).length}
  total={facts.length}
/>
```

- [ ] **Step 6: Run client tests**

Run: `npx vitest run src/modules/clients src/modules/client-documents src/modules/rentals/readiness/ReadinessCard.test.tsx`

Expected: PASS.

### Task 3: Contract preflight and vehicle correction UX

**Files:**
- Modify: `src/modules/rentals/components/RentalWizard.tsx`
- Modify: `src/modules/rentals/components/RentalWizard.test.tsx`
- Modify: `src/modules/rentals/server/queries.ts`
- Modify: `src/modules/rentals/server/queries.test.ts`
- Modify: `src/modules/vehicles/components/VehicleOverview.tsx`
- Modify: `src/modules/vehicles/components/VehicleDetailPage.tsx`
- Test: `src/modules/vehicles/components/VehicleDetailPage.test.ts`

**Interfaces:**
- Consumes `ReadinessResult` for client, selected vehicle, company/template, availability, and calculation.
- Produces the final wizard step and correction links.

- [ ] **Step 1: Write failing component/query tests**

```ts
expect(screen.getByText('Что мешает оформить договор')).toBeInTheDocument();
expect(screen.getByRole('link', { name: 'Заполнить ОСАГО' })).toHaveAttribute('href', '/vehicles/v1/edit#insurance');
expect(screen.getByRole('button', { name: 'Подтвердить договор' })).toBeDisabled();
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/rentals/components/RentalWizard.test.tsx src/modules/rentals/server/queries.test.ts src/modules/vehicles/components/VehicleDetailPage.test.ts`

Expected: FAIL because typed blocker presentation is absent.

- [ ] **Step 3: Return preflight facts from the server query**

Return ready and not-ready vehicle groups. Never trust client-provided legal facts during confirmation; only IDs and user-entered commercial terms are accepted.

- [ ] **Step 4: Implement the final preflight step**

Show completed checks, warnings, blockers, correction links, and a disabled confirmation button with `aria-describedby` pointing to the blocker summary. Preserve entered wizard values while navigating back.

- [ ] **Step 5: Add readiness card to vehicle detail**

Display the same evaluator result and edit anchors. Treat missing KASKO as a warning.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run src/modules/rentals/components/RentalWizard.test.tsx src/modules/rentals/server src/modules/vehicles/components/VehicleDetailPage.test.ts`

Expected: PASS.

### Task 4: Payment and signature persistence

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260902090000_add_rental_payments_signatures/migration.sql`
- Modify: `src/database/prisma/rental-schema.test.ts`
- Create: `src/modules/rentals/settlement/types.ts`
- Create: `src/modules/rentals/settlement/validation.ts`
- Test: `src/modules/rentals/settlement/validation.test.ts`

**Interfaces:**
- Produces Prisma models `RentalPayment` and `RentalSignature` and validated command types.

- [ ] **Step 1: Write failing schema tests**

```ts
expect(schema).toContain('model RentalPayment');
expect(schema).toContain('@@unique([companyId, rentalId, idempotencyKey])');
expect(schema).toContain('model RentalSignature');
expect(schema).toContain('@@unique([companyId, rentalId, party])');
```

- [ ] **Step 2: Run schema tests and verify RED**

Run: `npx vitest run src/database/prisma/rental-schema.test.ts`

Expected: FAIL because the models are absent.

- [ ] **Step 3: Add enums and models**

```prisma
enum RentalPaymentKind { RENT DEPOSIT }
enum RentalPaymentStatus { PENDING CONFIRMED CANCELLED REFUNDED PARTIALLY_REFUNDED }
enum RentalSignatureParty { CLIENT COMPANY }
enum RentalSignatureStatus { MISSING SIGNED REVOKED }

model RentalPayment {
  id String @id @default(cuid())
  companyId String
  rentalId String
  kind RentalPaymentKind
  status RentalPaymentStatus @default(CONFIRMED)
  amountMinor BigInt
  currency String @default("RUB")
  method RentalPaymentMethod
  reference String?
  comment String?
  idempotencyKey String
  recordedAt DateTime @default(now()) @db.Timestamptz(3)
  recordedByUserId String
  @@unique([companyId, rentalId, idempotencyKey])
  @@index([companyId, rentalId, kind, status])
}
```

Add tenant-scoped relations to `Company`, `Rental`, and `User`, checks for positive amounts, and a unique signature per party.

- [ ] **Step 4: Create additive migration**

The SQL creates enums, tables, foreign keys, indexes, uniqueness, and `amountMinor > 0`. It must not rewrite or delete existing rental rows.

- [ ] **Step 5: Validate Prisma**

Run: `npx prisma format && npx prisma validate && npx prisma generate`

Expected: all commands succeed.

- [ ] **Step 6: Run schema and validation tests**

Run: `npx vitest run src/database/prisma/rental-schema.test.ts src/modules/rentals/settlement/validation.test.ts`

Expected: PASS.

### Task 5: Payment, deposit, and signature actions and UI

**Files:**
- Create: `src/modules/rentals/settlement/server/actions.ts`
- Test: `src/modules/rentals/settlement/server/actions.test.ts`
- Create: `src/modules/rentals/settlement/server/queries.ts`
- Test: `src/modules/rentals/settlement/server/queries.test.ts`
- Create: `src/modules/rentals/settlement/components/RentalSettlementCard.tsx`
- Test: `src/modules/rentals/settlement/components/RentalSettlementCard.test.tsx`
- Modify: `src/app/(protected)/rentals/[id]/page.tsx`
- Modify: `src/modules/rentals/server/queries.ts`

**Interfaces:**
- Produces `recordRentalPaymentAction`, `setRentalSignatureAction`, and `RentalSettlementView`.

- [ ] **Step 1: Write failing action tests**

```ts
expect(await recordRentalPaymentAction(null, form)).toMatchObject({ status: 'success' });
expect(db.rentalPayment.create).toHaveBeenCalledWith(expect.objectContaining({
  data: expect.objectContaining({ companyId: 'company-1', rentalId: 'rental-1', amountMinor: 3200000n }),
}));
```

Cover unauthorized actor, wrong tenant, duplicate idempotency key, non-positive amount, invalid transition, dispatcher success, and audit creation.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/rentals/settlement`

Expected: FAIL because settlement actions/components do not exist.

- [ ] **Step 3: Implement authenticated mutations**

Each action calls existing rental access helpers, re-reads the rental by `{ companyId, id }`, validates Zod input, performs an idempotent transaction, writes audit data without sensitive file contents, and calls `revalidatePath('/rentals/' + rentalId)`.

- [ ] **Step 4: Build the settlement card**

Render contract total, confirmed rent payments, deposit required/collected/refunded, remaining balance, two signature rows, actor/time details, and forms with pending indicators. Technical database errors map to Russian business messages.

- [ ] **Step 5: Integrate into rental detail**

Show the sequence `Документы → Оплата и залог → Подписи → Выдача`; do not hide blockers behind tabs.

- [ ] **Step 6: Run settlement and rental-detail tests**

Run: `npx vitest run src/modules/rentals/settlement src/modules/rentals/components src/app/(protected)/rentals/[id]/route-states.test.tsx`

Expected: PASS.

### Task 6: Reliable document generation and system diagnostics

**Files:**
- Modify: `src/modules/rentals/server/generate-rental-documents.ts`
- Modify: `src/modules/rentals/server/generate-rental-documents.test.ts`
- Modify: `src/modules/rentals/components/RentalDetailPanel.tsx`
- Modify: `src/modules/rentals/components/RentalDetailPanel.test.tsx`
- Modify: `src/modules/system-health/get-operational-health.ts`
- Modify: `src/modules/system-health/get-operational-health.test.ts`

**Interfaces:**
- Produces persisted per-generation progress, safe retry behavior, and operational health facts.

- [ ] **Step 1: Write failing idempotency and health tests**

```ts
await generate({ companyId: 'c1', rentalId: 'r1', idempotencyKey: 'docs-r1-v1' });
await generate({ companyId: 'c1', rentalId: 'r1', idempotencyKey: 'docs-r1-v1' });
expect(storage.promote).toHaveBeenCalledTimes(2); // one DOCX and one PDF total
```

```ts
expect(health.checks).toContainEqual(expect.objectContaining({ code: 'RENTAL_PDF_PIPELINE', status: 'ERROR' }));
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/rentals/server/generate-rental-documents.test.ts src/modules/system-health/get-operational-health.test.ts`

Expected: FAIL because retry/progress/health behaviour is incomplete.

- [ ] **Step 3: Implement resumable generation**

Claim or reuse a generation by tenant, rental, version, and idempotency key. Validate non-empty DOCX and PDF buffers before promotion. On failure store a bounded safe message and keep private temporary files in cleanup state. A retry resumes only missing formats and cannot create a second committed version.

- [ ] **Step 4: Implement persisted progress UI**

Show `Подготовка`, `DOCX готов`, `PDF готов`, or `Ошибка`, plus a retry button. Use `aria-live="polite"` and disable duplicate submissions while pending.

- [ ] **Step 5: Add `/system` diagnostics**

Report LibreOffice availability, generations in `ERROR`, oldest pending generation, and contracts missing PDF. Never expose paths or command output.

- [ ] **Step 6: Run focused tests and PDF integration when available**

Run: `npx vitest run src/modules/rentals/server/generate-rental-documents.test.ts src/modules/rentals/components/RentalDetailPanel.test.tsx src/modules/system-health`

Run: `RUN_LIBREOFFICE_INTEGRATION=1 npx vitest run src/modules/rentals/documents/pdf/convert-docx-to-pdf.integration.test.ts`

Expected: PASS; integration may run only where LibreOffice is installed.

### Task 7: Handover gate and legacy compatibility

**Files:**
- Create: `src/modules/rentals/readiness/evaluate-handover-readiness.ts`
- Test: `src/modules/rentals/readiness/evaluate-handover-readiness.test.ts`
- Modify: `src/modules/rentals/operations/server/handover-rental.ts`
- Modify: `src/modules/rentals/operations/server/handover-rental.test.ts`
- Modify: `src/modules/rentals/components/RentalActionRail.tsx`
- Modify: `src/modules/rentals/components/RentalActionRail.test.tsx`
- Create: `scripts/report-rental-readiness.ts`
- Modify: `package.json`

**Interfaces:**
- Produces a gate that requires committed PDF, both signatures, confirmed rent payment, and an allowed deposit state for new handovers.

- [ ] **Step 1: Write failing handover tests**

```ts
await expect(handoverRental({ companyId: 'c1', rentalId: 'r1', actorUserId: 'u1' }))
  .rejects.toThrow('Перед выдачей сформируйте PDF договора.');
```

Cover missing signatures, unpaid rent, uncollected deposit, successful new rental, and an already-active legacy rental unaffected by the new gate.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/rentals/readiness/evaluate-handover-readiness.test.ts src/modules/rentals/operations/server/handover-rental.test.ts`

Expected: FAIL because the gate does not exist.

- [ ] **Step 3: Implement gate in the handover transaction**

Re-read committed document, signatures, payments, deposit and rental status under the tenant. Apply to `CONFIRMED` rentals whose handover starts after the migration activation timestamp. Do not retroactively invalidate `ACTIVE` or `COMPLETED` rentals.

- [ ] **Step 4: Surface blockers beside the handover action**

The action button remains visible but disabled with direct correction links and a concise `aria-describedby` summary.

- [ ] **Step 5: Add read-only production readiness report**

`npm run rentals:readiness-report` prints aggregate counts only: clients missing documents, vehicles with legal blockers, confirmed rentals missing PDF/signatures/payments, and overdue active rentals. It performs no writes and emits no personal data.

- [ ] **Step 6: Run handover and return regression**

Run: `npx vitest run src/modules/rentals/operations src/modules/rentals/readiness src/modules/rentals/components/RentalActionRail.test.tsx`

Expected: PASS, including optional return video.

### Task 8: Full verification and production rollout preparation

**Files:**
- Modify: `tests/clients.spec.ts`
- Modify: `tests/rentals.spec.ts`
- Create: `docs/runbooks/client-to-contract-rollout.md`

**Interfaces:**
- Produces a disposable-DB E2E proof and a backup/migration/rollback runbook.

- [ ] **Step 1: Add an E2E scenario**

The test creates a unique fixture client, uploads fixture passport/VU through the real private pipeline, selects a ready fixture vehicle, confirms a contract, waits for DOCX/PDF, records payment/deposit, records signatures, performs handover, refreshes, and verifies persistence. It cleans only its unique fixture records.

- [ ] **Step 2: Run focused E2E on disposable infrastructure**

Run: `PILOT_RENTALS_E2E=1 npx playwright test tests/clients.spec.ts tests/rentals.spec.ts --workers=1`

Expected: PASS against a dedicated disposable database; never run against production.

- [ ] **Step 3: Run repository verification**

Run: `npm run format:check`

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm run test:unit`

Run: `npm run build`

Expected: all commands succeed. Record unrelated pre-existing failures separately; do not hide them.

- [ ] **Step 4: Write rollout and rollback commands**

The runbook requires a PostgreSQL backup, verified free disk for private storage, LibreOffice/ClamAV checks, `npx prisma migrate deploy`, `npx prisma generate`, app restart, health verification, readiness report, one smoke contract, and rollback that restores the previous app release without applying destructive down migrations.

- [ ] **Step 5: Production deployment gate**

Deploy only after explicit confirmation that the database backup exists. Verify `supapro.ru`, authenticated client creation, PDF generation, payment/signature persistence, handover, `/system`, and logs. Do not seed or rewrite production data.
