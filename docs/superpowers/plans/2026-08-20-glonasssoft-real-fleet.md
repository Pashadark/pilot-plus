# GLONASSSoft Real Fleet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the demo map and demo fleet with the approved ten real vehicles, live GLONASSSoft positions/tracks, and rental-derived client/vehicle history.

**Architecture:** A server-only GLONASSSoft adapter authenticates against the exact Sputnik Vision host, rate-limits and validates provider responses, and writes normalized telemetry into tenant-scoped Pilot+ records. `Rental` remains the only client-to-vehicle relationship; a provider link connects a Pilot+ vehicle to one GLONASSSoft object. A guarded preview/apply workflow archives or deletes demo rows without breaking legal history, then the existing map and vehicle/client cards read real database projections.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, Zod, Vitest/Testing Library, MapLibre GL, existing Pilot+ encryption/RBAC/audit infrastructure.

## Global Constraints

- Read `docs/PROJECT_GUIDE.md` completely before every implementation session.
- Before changing Next.js routes, Server Components, Server Actions, caching or runtime behavior, read the relevant guide completely under `node_modules/next/dist/docs/`.
- Preserve `docs/PROJECT_GUIDE.md` and all unrelated dirty/untracked user files.
- Use strict TDD: failing focused test, observed RED, minimal implementation, observed GREEN.
- Never place the supplied GLONASSSoft login/password or an `X-Auth` value in Git, client JavaScript, logs, test snapshots or audits.
- Only these normalized plates may be active/visible: `В342НР797`, `Е435АН997`, `С886АУ997`, `Т949АМ997`, `М283АМ997`, `Р400АМ997`, `А156АХ997`, `Р604АО997`, `А429АУ997`, `Н726АХ550`.
- Demo vehicles without history may be deleted; vehicles with referenced history must be archived, never physically deleted.
- A rental is the only source of a client-to-vehicle association.
- All dates persisted as instants and presented in `Europe/Moscow`.
- GLONASSSoft client limit: at most two requests per second, one bounded retry after reauthentication, explicit timeouts and bounded response bodies.
- No production/shared migration, seed, fleet cleanup, live provider mutation or credential storage is executed without an explicit guarded deployment step and backup.

---

## File Structure

New integration files live under `src/modules/telematics/glonasssoft/`: `schemas.ts` validates provider payloads; `client.server.ts` owns HTTP/auth/rate limits; `normalizers.ts` maps provider data into Pilot+ values; `sync-company.server.ts` performs tenant-scoped persistence; `fleet-reconciliation.ts` produces and applies the whitelist preview. Map queries live in `src/modules/online-map/server/` and return UI-safe DTOs. Schema and one additive migration define integration/link/idempotency fields. Existing map, vehicle and client components consume projections and never call GLONASSSoft directly.

### Task 1: Add durable provider integration and telemetry identity

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260820150000_add_glonasssoft_integration/migration.sql`
- Create: `src/database/prisma/glonasssoft-schema.test.ts`
- Modify: `.env.example`

**Interfaces:**

- Produces: `TelematicsIntegration`, `TelematicsVehicleLink`, provider/idempotency fields on telemetry rows.
- Consumes: existing `Company`, `Vehicle`, `VehiclePosition`, `Trip`, `VehicleEvent`, encrypted-field conventions.

- [ ] **Step 1: Write the failing schema contract test**

Assert that the Prisma source contains a company-unique `TelematicsIntegration`, a unique `[companyId, provider, externalId]` link, unique provider point identity, and tenant/company relations. Assert the migration is additive and contains no `DROP TABLE`, `TRUNCATE` or unscoped delete.

```ts
expect(schema).toContain('model TelematicsIntegration');
expect(schema).toContain('@@unique([companyId, provider, externalId])');
expect(schema).toContain('@@unique([vehicleId, provider, externalId])');
expect(migration).not.toMatch(/DROP TABLE|TRUNCATE/i);
```

- [ ] **Step 2: Run the test and observe RED**

Run: `npx vitest run src/database/prisma/glonasssoft-schema.test.ts`  
Expected: FAIL because the integration/link schema is absent.

- [ ] **Step 3: Add the schema and rolling migration**

Define server-owned encrypted credentials and health fields, one vehicle link per provider object, and idempotent point/event external identifiers. Use nullable additions where existing rows require a rolling migration.

```prisma
model TelematicsIntegration {
  id                String    @id @default(cuid())
  companyId         String    @unique
  company           Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  provider          String    @default("GLONASSSOFT")
  baseUrl            String
  usernameEncrypted String
  passwordEncrypted String
  enabled           Boolean   @default(true)
  lastAttemptAt     DateTime? @db.Timestamptz(3)
  lastSuccessAt     DateTime? @db.Timestamptz(3)
  lastErrorCode     String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

model TelematicsVehicleLink {
  id                           String   @id @default(cuid())
  companyId                    String
  vehicleId                    String
  provider                     String   @default("GLONASSSOFT")
  externalId                   String
  registrationNumberNormalized String
  createdAt                    DateTime @default(now())
  updatedAt                    DateTime @updatedAt
  @@unique([companyId, provider, externalId])
  @@unique([companyId, provider, vehicleId])
}
```

- [ ] **Step 4: Verify generated schema artifacts**

Run: `npx prisma format`  
Run: `npx prisma generate`  
Run: `$env:DATABASE_URL='postgresql://pilot:pilot@127.0.0.1:5432/pilot_plan_validate'; npx prisma validate`  
Expected: all exit 0 without connecting to a shared database.

- [ ] **Step 5: Run GREEN and commit**

Run: `npx vitest run src/database/prisma/glonasssoft-schema.test.ts src/database/prisma/schema.test.ts`  
Expected: all pass.

```powershell
git add src/database/prisma/schema.prisma src/database/prisma/migrations/20260820150000_add_glonasssoft_integration/migration.sql src/database/prisma/glonasssoft-schema.test.ts .env.example
git commit -m "feat(telematics): add GLONASSSoft persistence"
```

### Task 2: Build the bounded server-only GLONASSSoft client

**Files:**

- Create: `src/modules/telematics/glonasssoft/schemas.ts`
- Create: `src/modules/telematics/glonasssoft/normalizers.ts`
- Create: `src/modules/telematics/glonasssoft/client.server.ts`
- Create: `src/modules/telematics/glonasssoft/client.server.test.ts`
- Create: `src/modules/telematics/glonasssoft/normalizers.test.ts`

**Interfaces:**

- Produces: `GlonassSoftClient.login()`, `findVehicles()`, `getLastData()`, `getTerminalMessages(range)`, `getMileageAndMotohours(range)`.
- Produces: `normalizeGlonassSoftPlate(value: string): string` using the same Cyrillic homoglyph mapping as vehicle management.

- [ ] **Step 1: Write failing HTTP contract and abuse-boundary tests**

Cover exact-host URL construction, `X-Auth`, two requests/second scheduling, one re-login on 401, abort timeout, maximum body size, malformed JSON, invalid coordinates and credential-free errors.

```ts
await expect(client.findVehicles()).resolves.toEqual([{ externalId: '42', plate: 'А156АХ997' }]);
expect(fetchMock).toHaveBeenCalledWith(
  'https://gs.sputnik.vision/api/v3/vehicles/find',
  expect.objectContaining({ headers: expect.objectContaining({ 'X-Auth': 'session' }) }),
);
expect(JSON.stringify(caughtError)).not.toContain('provider-password');
```

- [ ] **Step 2: Run tests and observe RED**

Run: `npx vitest run src/modules/telematics/glonasssoft/client.server.test.ts src/modules/telematics/glonasssoft/normalizers.test.ts`  
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement schemas, normalization and client**

Use Zod `.passthrough()` only around documented envelopes and strict field transforms for IDs, plates, timestamps, latitude, longitude, speed, mileage and fuel. Construct URLs from a validated `https:` base (allow loopback HTTP only in tests/development), use a fetch body reader with a fixed byte ceiling, and keep session state in process memory only.

```ts
export interface GlonassSoftClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export class GlonassSoftClient {
  async findVehicles(): Promise<readonly GlonassSoftVehicle[]>;
  async getLastData(externalIds: readonly string[]): Promise<readonly GlonassSoftLastData[]>;
  async getTerminalMessages(input: GlonassSoftRange): Promise<readonly GlonassSoftMessage[]>;
  async getMileageAndMotohours(input: GlonassSoftRange): Promise<GlonassSoftMileage>;
}
```

- [ ] **Step 4: Run GREEN and commit**

Run: `npx vitest run src/modules/telematics/glonasssoft/client.server.test.ts src/modules/telematics/glonasssoft/normalizers.test.ts`  
Expected: all pass.

```powershell
git add src/modules/telematics/glonasssoft
git commit -m "feat(telematics): add bounded GLONASSSoft client"
```

### Task 3: Add guarded fleet preview and apply

**Files:**

- Create: `src/modules/telematics/glonasssoft/approved-fleet.ts`
- Create: `src/modules/telematics/glonasssoft/fleet-reconciliation.ts`
- Create: `src/modules/telematics/glonasssoft/fleet-reconciliation.test.ts`
- Create: `src/modules/telematics/glonasssoft/actions.ts`
- Create: `src/modules/telematics/glonasssoft/actions.test.ts`
- Create: `scripts/reconcile-real-fleet.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: `previewRealFleet(companyId): FleetPreview` with `create`, `update`, `link`, `archive`, `delete`, `blocked` entries.
- Produces: `applyRealFleetPreview({ companyId, previewToken, actorUserId })` with Serializable recheck and audit.

- [ ] **Step 1: Write failing reconciliation tests**

Use the exact ten tuples. Prove that unapproved provider objects are ignored, history-free demo rows are deletable, referenced rows are archive-only, Toyota plate correction is explicit, duplicate normalized plates block apply, and a tampered/expired/company-mismatched preview token is rejected.

```ts
expect(preview.approvedPlates).toHaveLength(10);
expect(preview.delete.every((row) => row.referenceCount === 0)).toBe(true);
expect(preview.archive.every((row) => row.referenceCount > 0)).toBe(true);
expect(preview.blocked).toEqual([]);
```

- [ ] **Step 2: Run and observe RED**

Run: `npx vitest run src/modules/telematics/glonasssoft/fleet-reconciliation.test.ts src/modules/telematics/glonasssoft/actions.test.ts`  
Expected: FAIL because preview/apply do not exist.

- [ ] **Step 3: Implement preview/apply and guarded CLI**

Count all known vehicle references before deciding deletion, sign an opaque short-lived preview token, repeat every database/provider comparison inside a Serializable apply transaction, and write an audit containing IDs/counts but no credentials or client PII. The CLI defaults to preview; apply requires both `--apply` and `PILOT_ALLOW_REAL_FLEET_APPLY=1` and refuses a database URL not explicitly acknowledged.

```ts
export const APPROVED_REAL_FLEET = [
  ['Kia', 'K5', 'В342НР797'],
  ['Skoda', 'Octavia', 'Е435АН997'],
  ['Kia', 'Cerato', 'С886АУ997'],
  ['Skoda', 'Octavia', 'Т949АМ997'],
  ['Mercedes-Benz', 'E220d 4Matic', 'М283АМ997'],
  ['Volkswagen', 'Polo', 'Р400АМ997'],
  ['Volkswagen', 'Polo', 'А156АХ997'],
  ['Kia', 'Rio', 'Р604АО997'],
  ['Kia', 'Ceed', 'А429АУ997'],
  ['Toyota', 'Camry', 'Н726АХ550'],
] as const;
```

- [ ] **Step 4: Run GREEN and commit**

Run: `npx vitest run src/modules/telematics/glonasssoft/fleet-reconciliation.test.ts src/modules/telematics/glonasssoft/actions.test.ts`  
Expected: all pass; no database mutation in tests outside mocks/disposable fixtures.

```powershell
git add src/modules/telematics/glonasssoft scripts/reconcile-real-fleet.ts package.json
git commit -m "feat(vehicles): reconcile approved real fleet"
```

### Task 4: Persist current positions and bounded track history

**Files:**

- Create: `src/modules/telematics/glonasssoft/sync-company.server.ts`
- Create: `src/modules/telematics/glonasssoft/sync-company.server.test.ts`
- Create: `src/modules/telematics/glonasssoft/sync-tracks.server.ts`
- Create: `src/modules/telematics/glonasssoft/sync-tracks.server.test.ts`
- Create: `src/app/api/internal/telematics/glonasssoft/sync/route.ts`
- Create: `src/app/api/internal/telematics/glonasssoft/sync/route.test.ts`

**Interfaces:**

- Produces: `syncCompanyLatestPositions(companyId)` returning counts and provider health without secrets.
- Produces: `syncVehicleTrack({ companyId, vehicleId, from, to })` with maximum seven-day Moscow interval.

- [ ] **Step 1: Read Next.js 16 route/runtime guidance completely**

Read the exact files under `node_modules/next/dist/docs/` covering Route Handlers, runtime, caching and request APIs; record the chosen Node runtime and no-store behavior in the route test name.

- [ ] **Step 2: Write failing persistence/idempotency/auth tests**

Prove tenant scoping before provider access, whitelist/link filtering, one position per provider message, idempotent replay, bounded seven-day tracks, invalid coordinates skipped with health error, and internal route authentication before database/provider use.

```ts
await syncCompanyLatestPositions('company-a');
expect(positionUpsert).toHaveBeenCalledWith(
  expect.objectContaining({
    where: expect.objectContaining({ vehicleId_provider_externalId: expect.anything() }),
  }),
);
expect(clientFactory).not.toHaveBeenCalledWhenAccessIsDenied();
```

- [ ] **Step 3: Run RED**

Run: `npx vitest run src/modules/telematics/glonasssoft/sync-company.server.test.ts src/modules/telematics/glonasssoft/sync-tracks.server.test.ts src/app/api/internal/telematics/glonasssoft/sync/route.test.ts`  
Expected: FAIL because sync modules/routes are absent.

- [ ] **Step 4: Implement latest-position and track synchronization**

Decrypt credentials only after fresh company/admin or service-token authorization. Upsert positions/events by provider identity, update vehicle odometer only from newer trusted telemetry, save provider/received timestamps, and update integration health. Never clear the last good position on provider failure.

- [ ] **Step 5: Run GREEN and commit**

Run the three focused files from Step 3.  
Expected: all pass.

```powershell
git add src/modules/telematics/glonasssoft/sync-company.server.ts src/modules/telematics/glonasssoft/sync-company.server.test.ts src/modules/telematics/glonasssoft/sync-tracks.server.ts src/modules/telematics/glonasssoft/sync-tracks.server.test.ts src/app/api/internal/telematics/glonasssoft/sync
git commit -m "feat(telematics): synchronize real fleet telemetry"
```

### Task 5: Replace demo map projections with real tenant data

**Files:**

- Create: `src/modules/online-map/server/queries.ts`
- Create: `src/modules/online-map/server/queries.test.ts`
- Modify: `src/modules/online-map/types.ts`
- Modify: `src/modules/online-map/track-types.ts`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMapClient.tsx`
- Modify: `src/modules/online-map/components/SelectedVehiclePanel.tsx`
- Modify: `src/app/(protected)/map/page.tsx`
- Modify: `src/app/(protected)/map/route-states.test.tsx`
- Delete: `src/modules/online-map/fixtures.ts`
- Delete: `src/modules/online-map/track-fixtures.ts`

**Interfaces:**

- Consumes: persisted `VehiclePosition`, provider link, active `Rental`, `Client` display projection.
- Produces: `listOnlineMapVehiclesForCurrentUser()` and `getVehicleTrackForCurrentUser(input)`.

- [ ] **Step 1: Read Next.js 16 Server Component and caching guides completely**

Select explicit no-store/dynamic behavior for live map reads and server-authoritative access checks.

- [ ] **Step 2: Write failing query and UI tests**

Cover exactly approved active vehicles, current rental/client at `now`, missing coordinates represented as `no-data`, Moscow labels, revoked membership failing before telemetry/storage reads, no demo label, and real track response replacing fixtures.

```ts
expect(result.find((row) => row.plate === 'А156АХ997')?.currentRental).toEqual({
  contractNumber: 'ME-2026-0003-BK',
  clientName: 'Горбунов Глеб Геннадьевич',
});
expect(screen.queryByText('Демонстрационные данные')).not.toBeInTheDocument();
```

- [ ] **Step 3: Run RED**

Run: `npx vitest run src/modules/online-map/server/queries.test.ts src/modules/online-map/components/OnlineMapWorkspace.test.tsx src/app/(protected)/map/route-states.test.tsx`  
Expected: FAIL on missing real query/no-data/current-rental behavior.

- [ ] **Step 4: Implement server projections and map states**

Extend status to `moving | idle | offline | maintenance | no-data`; make coordinates nullable; list no-data vehicles in the sidebar but do not create invalid markers; show current contract/client only for a matching active rental; display last successful synchronization and a provider error banner without fake coordinates.

- [ ] **Step 5: Run GREEN and commit**

Run the three focused suites from Step 3 plus `src/modules/online-map/filter-vehicles.test.ts`.  
Expected: all pass.

```powershell
git add src/modules/online-map src/app/(protected)/map
git commit -m "feat(map): show real fleet telemetry"
```

### Task 6: Add real vehicle and client history projections

**Files:**

- Create: `src/modules/vehicles/server/history-query.ts`
- Create: `src/modules/vehicles/server/history-query.test.ts`
- Modify: `src/modules/vehicles/components/VehicleDetailPage.tsx`
- Modify: `src/modules/vehicles/components/VehicleDetailPage.test.ts`
- Create: `src/modules/vehicles/components/VehicleTelemetryHistory.tsx`
- Modify: `src/modules/clients/server/client-rentals.ts`
- Modify: `src/modules/clients/server/client-rentals.test.ts`
- Modify: `src/modules/clients/components/ClientDetailPage.tsx`
- Modify: `src/modules/clients/components/ClientDetailPage.test.tsx`
- Modify: `src/modules/clients/components/ClientRentalHistory.tsx`
- Modify: `src/modules/clients/components/ClientRentalHistory.test.tsx`

**Interfaces:**

- Produces: tenant-scoped vehicle history containing current/future/past rentals, telemetry summaries, fines, maintenance, washes and documents.
- Produces: client rental history containing vehicle, contract, documents, issue/return mileage/fuel, limit/overage and attributed fines.

- [ ] **Step 1: Write failing tenant/history tests**

Cover current renter derived from half-open rental interval, completed/future histories, no permanent client field on vehicle, mileage limit/overage, issue/return fuel, fine attribution, maintenance blocking, archived vehicle history visibility by direct authorized URL, and foreign-company denial.

- [ ] **Step 2: Run RED**

Run the new history tests and existing vehicle/client detail focused suites.  
Expected: FAIL because unified history projections/components are absent.

- [ ] **Step 3: Implement bounded projections and UI sections**

Use database pagination for long histories, compact Russian labels, stable 44px controls and responsive single-column mobile layout. Link contracts/documents through protected routes already present. Do not expose decrypted identity data in telemetry responses.

- [ ] **Step 4: Run GREEN and commit**

Run the same focused suites.  
Expected: all pass.

```powershell
git add src/modules/vehicles src/modules/clients
git commit -m "feat(fleet): connect vehicle and client histories"
```

### Task 7: Integrate availability, mileage overage and scheduled synchronization

**Files:**

- Modify: `src/modules/rentals/domain/availability.ts`
- Modify: `src/modules/rentals/domain/availability.test.ts`
- Create: `src/modules/telematics/domain/rental-mileage.ts`
- Create: `src/modules/telematics/domain/rental-mileage.test.ts`
- Create: `scripts/sync-glonasssoft.ts`
- Modify: `package.json`
- Modify: `deploy/telegram-bot/compose.yaml` or the repository's actual scheduler compose file found during implementation
- Modify: `.env.example`

**Interfaces:**

- Produces: `calculateRentalMileage({ issueKm, returnKm, liveKm, includedKmPerDay, billableDays })` using decimal-safe integer tenths.
- Consumes: existing rental overlap and maintenance-blocking rules.

- [ ] **Step 1: Write failing domain and scheduler contract tests**

Prove maintenance prevents rental selection, extension conflicts are detected, live mileage is advisory before return, final mileage uses signed return value, overage never becomes negative, and scheduler refuses missing service authentication.

```ts
expect(
  calculateRentalMileage({ issueTenths: 100000, returnTenths: 108500, includedKm: 600 }),
).toMatchObject({
  drivenTenths: 8500,
  overageTenths: 2500,
  source: 'RETURN',
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/modules/rentals/domain/availability.test.ts src/modules/telematics/domain/rental-mileage.test.ts`  
Expected: FAIL on missing mileage domain and any uncovered maintenance/extension case.

- [ ] **Step 3: Implement domain calculation and bounded scheduler command**

The scheduler enumerates enabled integrations in bounded batches, calls the authenticated internal route, records non-secret health, exits non-zero on systemic failure and never logs credentials/session headers.

- [ ] **Step 4: Run GREEN and commit**

Run the two focused suites plus a dry scheduler invocation with mocked network.  
Expected: all pass and no secrets in output.

```powershell
git add src/modules/rentals/domain/availability.ts src/modules/rentals/domain/availability.test.ts src/modules/telematics/domain scripts/sync-glonasssoft.ts package.json .env.example deploy
git commit -m "feat(fleet): automate telemetry and mileage checks"
```

### Task 8: Verify, document and perform guarded local rollout

**Files:**

- Create: `docs/runbooks/glonasssoft.md`
- Modify: `docs/PROJECT_GUIDE.md` only after preserving and reconciling the user's existing modification
- Create: `tests/glonasssoft-fleet.spec.ts`

**Interfaces:**

- Consumes: all prior tasks.
- Produces: reproducible deployment, backup, preview, apply, rollback and secret-rotation procedure.

- [ ] **Step 1: Write the runbook and Playwright scenarios**

Document secret setup without values, connection test, migration order, database backup command, preview output review, guarded apply, rollback, scheduler health, rate-limit response, credential rotation and removal of stale sessions. Browser coverage must verify map list/no-data/current-renter, vehicle history, client history and tenant denial without depending on live provider availability.

- [ ] **Step 2: Run focused and static gates**

Run: `npm run typecheck`  
Run: `npm run lint`  
Run: `npm run test:unit`  
Run: `npx prettier --check <all scoped changed text files>`  
Run: `git diff --check`  
Expected: all exit 0; only explicitly documented pre-existing warnings may remain.

- [ ] **Step 3: Validate deployment artifacts without touching shared data**

Run Prisma format/generate/validate, Compose config if the scheduler is containerized, and `npx playwright test --list tests/glonasssoft-fleet.spec.ts`.  
Expected: schema/artifacts valid and scenarios discovered.

- [ ] **Step 4: Create a backup and run preview on the explicitly selected local company**

First verify the resolved database URL and backup destination. Run the preview-only fleet command and save its non-secret report. Expected: exactly ten approved active outcomes, no destructive action, every deletion candidate has zero references, and every referenced out-of-list vehicle is archive-only.

- [ ] **Step 5: Apply only after preview invariants pass**

Set the one-shot apply guard, apply the exact signed preview, synchronize latest positions, and visually verify `/map`, one vehicle card and one client card. Abort without mutation if the preview changed, duplicates exist, provider objects are missing, or backup verification failed.

- [ ] **Step 6: Final verification and commit**

Repeat focused telemetry/map/history suites, typecheck, lint, unit tests, format and diff checks after rollout scripts/report changes.

```powershell
git add docs/runbooks/glonasssoft.md tests/glonasssoft-fleet.spec.ts docs/PROJECT_GUIDE.md
git commit -m "docs(telematics): document real fleet rollout"
```

## Self-Review Results

- Spec coverage: exact ten-car whitelist, safe delete/archive, provider auth/rate limits, tenant security, live/latest positions, real tracks, client/rental/vehicle relationship, cards, mileage, maintenance availability, scheduler, rollout and tests are mapped to Tasks 1–8.
- Placeholder scan: no deferred implementation markers remain; every production and test path is resolved against the current repository.
- Type consistency: `TelematicsIntegration`, `TelematicsVehicleLink`, `GlonassSoftClient`, `previewRealFleet`, `syncCompanyLatestPositions`, `syncVehicleTrack` and map/history projection names are stable across producing and consuming tasks.
- Deployment safety: no step applies a migration, saves credentials, deletes fleet data or calls a live mutation before backup, preview validation and explicit one-shot guard.
