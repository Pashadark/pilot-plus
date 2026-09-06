# RentRide Reservation Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically mirror RentRide reservations into СУПА ПРО leads, clients, vehicles and active/completed rentals without changing anything in RentRide.

**Architecture:** A production-only Playwright adapter reads the authenticated RentRide cabinet and converts it to provider-neutral typed records. A transactional application service upserts each external reservation, matches tenant data and applies only approved lifecycle transitions; a hardened systemd timer runs the one-shot command every five minutes, while an admin page supports manual sync and SMS re-authentication.

**Tech Stack:** TypeScript 5 strict mode, Node.js 20+, Next.js 16.2 App Router and Server Actions, React 19.2, Prisma 6.16/PostgreSQL 17, Playwright 1.61, Zod 4, Vitest 3, Tailwind CSS 4, systemd.

## Global Constraints

- RentRide is read-only: never confirm, edit, cancel or otherwise mutate a provider reservation.
- The idempotency key is exactly `[companyId, provider, externalId]` with provider `RENTRIDE`.
- Every RentRide deal creates or updates a lead; a rental is created only for `Эксплуатация` and completed only for `Завершена`.
- A cancelled RentRide deal never silently cancels an already active СУПА ПРО rental.
- Match clients by the tenant-scoped blind index of a normalized Russian phone and vehicles by tenant-scoped `registrationNumberNormalized`.
- Never invent passport data, mileage, fuel, media, damage, deposit decisions or signatures.
- Unknown statuses, missing vehicle plates, ambiguous names, invalid periods and rental overlaps fail closed as `REQUIRES_REVIEW` without blocking other deals.
- Credentials and browser state never enter Git, database payloads, UI results, logs or error messages.
- Production secrets live only in `/etc/pilot-plus.env`; browser state lives only under `/var/lib/pilot-plus/rentride` with mode `0600`.
- Use Europe/Moscow for provider dates and UTC `timestamptz` in PostgreSQL.
- Follow the existing Pilot+ design system; do not add a generic UI framework.
- Preserve the dirty working tree and commit only files belonging to the current task.

## File Structure

- `src/database/prisma/schema.prisma`: integration, external reservation and sync-run persistence.
- `src/database/prisma/migrations/20260906190000_add_rentride_sync/migration.sql`: deployable database migration and indexes.
- `src/database/prisma/rentride-schema.test.ts`: schema contract.
- `src/modules/integrations/rentride/domain.ts`: provider-neutral types, status/date/phone/plate normalization and validation.
- `src/modules/integrations/rentride/adapter.ts`: Playwright-only read adapter and resilient locators.
- `src/modules/integrations/rentride/session-store.ts`: AES-GCM encrypted Playwright state and temporary-file cleanup.
- `src/modules/integrations/rentride/apply-reservation.ts`: tenant-scoped lead/client/vehicle upsert and review decisions.
- `src/modules/integrations/rentride/reconcile-rental.ts`: idempotent ACTIVE/COMPLETED rental lifecycle.
- `src/modules/integrations/rentride/sync.ts`: lease, per-reservation isolation, counters, circuit breaker and run history.
- `src/modules/integrations/rentride/admin.ts`: server-only admin queries.
- `src/modules/integrations/rentride/actions.ts`: authorized manual sync and SMS authentication Server Actions.
- `src/modules/integrations/rentride/components/RentRideIntegrationPage.tsx`: integration control page.
- `src/modules/integrations/rentride/components/RentRideActions.tsx`: pending states for sync and login.
- `src/app/(protected)/admin/integrations/rentride/page.tsx`: protected route composition.
- `src/app/(protected)/admin/integrations/rentride/loading.tsx`: route skeleton.
- `scripts/sync-rentride.ts`: one-shot worker entry point.
- `scripts/configure-rentride.ts`: idempotent production configuration entry point.
- `deploy/pilot-plus-rentride-sync.service`: hardened one-shot unit.
- `deploy/pilot-plus-rentride-sync.timer`: five-minute timer.
- `docs/runbooks/rentride-sync.md`: setup, dry-run, activation, recovery and rollback.
- Existing leads, admin overview and system-health files receive only the fields/cards needed to expose this integration.

---

### Task 1: Persist the integration and external reservations

**Files:**
- Create: `src/database/prisma/rentride-schema.test.ts`
- Create: `src/database/prisma/migrations/20260906190000_add_rentride_sync/migration.sql`
- Modify: `src/database/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma models `RentRideIntegration`, `ExternalReservation`, `RentRideSyncRun` and enums used by every later task.
- Produces: unique external identity `companyId_provider_externalId` and optional one-to-one links to `Lead` and `Rental`.

- [ ] **Step 1: Write the failing schema contract**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('src/database/prisma/schema.prisma', 'utf8');

describe('RentRide schema', () => {
  it('stores tenant-scoped idempotent reservations without provider secrets', () => {
    const integration = schema.match(/model RentRideIntegration \{[\s\S]*?\n\}/)?.[0] ?? '';
    const reservation = schema.match(/model ExternalReservation \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(schema).toContain('model RentRideIntegration {');
    expect(schema).toContain('model ExternalReservation {');
    expect(schema).toContain('model RentRideSyncRun {');
    expect(schema).toContain('@@unique([companyId, provider, externalId])');
    expect(reservation).toContain('phoneEncrypted');
    expect(reservation).toContain('phoneIndex');
    expect(integration).not.toContain('passwordEncrypted');
    expect(reservation).not.toContain('rawHtml');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/database/prisma/rentride-schema.test.ts`

Expected: FAIL because the three models do not exist.

- [ ] **Step 3: Add the Prisma enums, relations and models**

Add these enums and models, plus matching relation arrays on `Company`, `User`, `Lead`, `Client`, `Vehicle` and `Rental`:

```prisma
enum ExternalReservationProvider {
  RENTRIDE
}

enum ExternalReservationStatus {
  NEW
  CONTACTED
  QUALIFIED
  BOOKED
  IN_USE
  COMPLETED
  CANCELLED
  UNKNOWN
}

enum ExternalReservationSyncState {
  SYNCED
  REQUIRES_REVIEW
  ERROR
}

enum RentRideAuthState {
  CONNECTED
  AUTH_REQUIRED
  ERROR
  DISABLED
}

enum RentRideSyncMode {
  DRY_RUN
  APPLY
}

enum RentRideSyncRunStatus {
  RUNNING
  SUCCESS
  PARTIAL
  FAILED
}

model RentRideIntegration {
  id                  String            @id @default(cuid())
  companyId           String            @unique
  company             Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  actorUserId         String
  actorUser           User              @relation("RentRideActor", fields: [actorUserId], references: [id], onDelete: Restrict)
  enabled             Boolean           @default(false)
  authState           RentRideAuthState @default(AUTH_REQUIRED)
  lastAttemptAt       DateTime?          @db.Timestamptz(3)
  lastSuccessAt       DateTime?          @db.Timestamptz(3)
  lastErrorCode       String?
  consecutiveFailures Int               @default(0)
  pausedUntil         DateTime?          @db.Timestamptz(3)
  syncRequestedAt     DateTime?          @db.Timestamptz(3)
  leaseOwner          String?
  leaseExpiresAt      DateTime?          @db.Timestamptz(3)
  reservations        ExternalReservation[]
  runs                RentRideSyncRun[]
  createdAt           DateTime           @default(now()) @db.Timestamptz(3)
  updatedAt           DateTime           @updatedAt @db.Timestamptz(3)
}

model ExternalReservation {
  id                           String                       @id @default(cuid())
  companyId                    String
  company                      Company                      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  integrationId                String
  integration                  RentRideIntegration          @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  provider                     ExternalReservationProvider  @default(RENTRIDE)
  externalId                   String
  sourceStatus                 String
  status                       ExternalReservationStatus
  clientName                   String
  phoneEncrypted               String
  phoneIndex                   String
  vehicleLabel                 String?
  vehicleYear                  Int?
  registrationNumberNormalized String?
  startsAt                     DateTime?                     @db.Timestamptz(3)
  endsAt                       DateTime?                     @db.Timestamptz(3)
  dailyRateMinor               BigInt?
  totalPriceMinor              BigInt?
  depositMinor                 BigInt?
  includedMileageKm            Int?
  pickupAddressEncrypted       String?
  tripRegionEncrypted          String?
  sourceCreatedAt              DateTime?                     @db.Timestamptz(3)
  sourceUpdatedAt              DateTime?                     @db.Timestamptz(3)
  payloadHash                  String
  syncState                    ExternalReservationSyncState @default(SYNCED)
  errorCode                    String?
  leadId                       String?                       @unique
  lead                         Lead?                         @relation(fields: [leadId], references: [id], onDelete: SetNull)
  clientId                     String?
  client                       Client?                       @relation(fields: [clientId], references: [id], onDelete: SetNull)
  vehicleId                    String?
  vehicle                      Vehicle?                      @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  rentalId                     String?                       @unique
  rental                       Rental?                       @relation(fields: [rentalId], references: [id], onDelete: SetNull)
  firstSeenAt                  DateTime                      @default(now()) @db.Timestamptz(3)
  lastSeenAt                   DateTime                      @default(now()) @db.Timestamptz(3)
  createdAt                    DateTime                      @default(now()) @db.Timestamptz(3)
  updatedAt                    DateTime                      @updatedAt @db.Timestamptz(3)

  @@unique([companyId, provider, externalId])
  @@index([integrationId, syncState, updatedAt])
  @@index([companyId, phoneIndex])
  @@index([companyId, registrationNumberNormalized])
}

model RentRideSyncRun {
  id            String                @id @default(cuid())
  integrationId String
  integration   RentRideIntegration   @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  companyId     String
  company       Company               @relation(fields: [companyId], references: [id], onDelete: Cascade)
  mode          RentRideSyncMode
  status        RentRideSyncRunStatus @default(RUNNING)
  discovered    Int                   @default(0)
  created       Int                   @default(0)
  updated       Int                   @default(0)
  rentalsOpened Int                   @default(0)
  rentalsClosed Int                   @default(0)
  reviewRequired Int                  @default(0)
  failed        Int                   @default(0)
  errorCode     String?
  startedAt     DateTime              @default(now()) @db.Timestamptz(3)
  completedAt   DateTime?             @db.Timestamptz(3)

  @@index([integrationId, startedAt])
  @@index([companyId, status, startedAt])
}
```

Add relation fields using explicit names where Prisma requires them:

```prisma
// Company
rentRideIntegration  RentRideIntegration?
externalReservations ExternalReservation[]
rentRideSyncRuns     RentRideSyncRun[]

// User
rentRideIntegrations RentRideIntegration[] @relation("RentRideActor")

// Lead
externalReservation ExternalReservation?

// Client
externalReservations ExternalReservation[]

// Vehicle
externalReservations ExternalReservation[]

// Rental
externalReservation ExternalReservation?
```

- [ ] **Step 4: Add the SQL migration and validate it**

Create PostgreSQL enum types matching the Prisma enums, create the three tables with quoted camel-case columns, then add these constraints and indexes exactly:

```sql
CREATE UNIQUE INDEX "RentRideIntegration_companyId_key" ON "RentRideIntegration"("companyId");
CREATE UNIQUE INDEX "ExternalReservation_companyId_provider_externalId_key"
  ON "ExternalReservation"("companyId", "provider", "externalId");
CREATE UNIQUE INDEX "ExternalReservation_leadId_key" ON "ExternalReservation"("leadId");
CREATE UNIQUE INDEX "ExternalReservation_rentalId_key" ON "ExternalReservation"("rentalId");
ALTER TABLE "ExternalReservation"
  ADD CONSTRAINT "ExternalReservation_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalReservation"
  ADD CONSTRAINT "ExternalReservation_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalReservation"
  ADD CONSTRAINT "ExternalReservation_rentalId_fkey"
  FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Run: `npx prisma format && npx prisma validate && npx prisma generate`

Expected: schema formatted, validation succeeds and Prisma Client generation succeeds.

- [ ] **Step 5: Run the schema test and commit**

Run: `npx vitest run src/database/prisma/rentride-schema.test.ts`

Expected: PASS.

```bash
git add src/database/prisma/schema.prisma src/database/prisma/rentride-schema.test.ts src/database/prisma/migrations/20260906190000_add_rentride_sync/migration.sql
git commit -m "feat: add RentRide synchronization storage"
```

### Task 2: Normalize RentRide statuses and reservation data

**Files:**
- Create: `src/modules/integrations/rentride/domain.ts`
- Create: `src/modules/integrations/rentride/domain.test.ts`

**Interfaces:**
- Produces: `RawRentRideReservation`, `NormalizedRentRideReservation`, `normalizeRentRideReservation(raw)` and `mapRentRideStatus(value)`.
- Consumes: only plain text extracted by the browser adapter; this module has no browser or database dependency.

- [ ] **Step 1: Write failing table-driven domain tests**

```ts
import { describe, expect, it } from 'vitest';
import { mapRentRideStatus, normalizeRentRideReservation } from './domain';

describe('mapRentRideStatus', () => {
  it.each([
    ['Новая', 'NEW'],
    ['Новые', 'NEW'],
    ['Согласование', 'CONTACTED'],
    ['Подтверждена', 'QUALIFIED'],
    ['Подтвержденные', 'QUALIFIED'],
    ['Оплачена', 'BOOKED'],
    ['Оплаченные', 'BOOKED'],
    ['Эксплуатация', 'IN_USE'],
    ['Завершена', 'COMPLETED'],
    ['Отменена', 'CANCELLED'],
    ['Новый статус', 'UNKNOWN'],
  ] as const)('maps %s to %s', (source, expected) => {
    expect(mapRentRideStatus(source)).toBe(expected);
  });
});

it('normalizes Moscow dates, phone, plate and kopecks', () => {
  const value = normalizeRentRideReservation({
    externalId: '723444', sourceStatus: 'Эксплуатация', clientName: 'Иванов Иван Иванович',
    phone: '+7 (917) 000-00-00', vehicleLabel: 'Mercedes-Benz E 220 d 4MATIC', vehicleYear: '2019',
    registrationNumber: 'М283АМ 997', startsAt: '01.09.2026, 13:00', endsAt: '03.09.2026, 13:00',
    dailyRate: '8 000 ₽', totalPrice: '16 000 ₽', deposit: '20 000 ₽', includedMileage: '600 км',
    pickupAddress: 'Москва', tripRegion: 'Россия', sourceCreatedAt: null, sourceUpdatedAt: null,
  });
  expect(value.registrationNumberNormalized).toBe('М283АМ997');
  expect(value.phoneNormalized).toBe('79170000000');
  expect(value.dailyRateMinor).toBe(800000n);
  expect(value.startsAt.toISOString()).toBe('2026-09-01T10:00:00.000Z');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/modules/integrations/rentride/domain.test.ts`

Expected: FAIL because `domain.ts` does not exist.

- [ ] **Step 3: Implement the complete public domain contract**

```ts
export type RentRideStatus =
  | 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'BOOKED'
  | 'IN_USE' | 'COMPLETED' | 'CANCELLED' | 'UNKNOWN';

export interface RawRentRideReservation {
  externalId: string;
  sourceStatus: string;
  clientName: string;
  phone: string;
  vehicleLabel: string | null;
  vehicleYear: string | null;
  registrationNumber: string | null;
  startsAt: string | null;
  endsAt: string | null;
  dailyRate: string | null;
  totalPrice: string | null;
  deposit: string | null;
  includedMileage: string | null;
  pickupAddress: string | null;
  tripRegion: string | null;
  sourceCreatedAt: string | null;
  sourceUpdatedAt: string | null;
}

export interface NormalizedRentRideReservation {
  externalId: string;
  sourceStatus: string;
  status: RentRideStatus;
  clientName: string;
  phoneNormalized: string;
  vehicleLabel: string | null;
  vehicleYear: number | null;
  registrationNumberNormalized: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  dailyRateMinor: bigint | null;
  totalPriceMinor: bigint | null;
  depositMinor: bigint | null;
  includedMileageKm: number | null;
  pickupAddress: string | null;
  tripRegion: string | null;
  sourceCreatedAt: Date | null;
  sourceUpdatedAt: Date | null;
  payloadHash: string;
}
```

Implement exact whitespace/case folding for the seven known statuses, `normalizeRussianPhone`, Cyrillic plate normalization, safe integer money parsing, strict `externalId`, and a Moscow parser that constructs the UTC instant with a fixed `+03:00` offset. Hash a stable JSON representation with SHA-256; represent bigints as decimal strings before hashing. Reject invalid IDs, phones, unsafe money, impossible dates and `endsAt <= startsAt` with a typed `RentRideDataError` code.

- [ ] **Step 4: Cover fail-closed cases and verify GREEN**

Add tests for an unknown status, invalid phone, invalid date, reversed period, decimal currency and stable hashes. Run:

`npx vitest run src/modules/integrations/rentride/domain.test.ts`

Expected: all domain tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/integrations/rentride/domain.ts src/modules/integrations/rentride/domain.test.ts
git commit -m "feat: normalize RentRide reservations"
```

### Task 3: Encrypt and rotate Playwright session state

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/modules/integrations/rentride/session-store.ts`
- Create: `src/modules/integrations/rentride/session-store.test.ts`

**Interfaces:**
- Produces: `createRentRideSessionStore({ directory, key })` with `withActiveState`, `writeActive`, `writePending`, `withPendingState` and `clear`.
- Consumes: a base64 32-byte `RENTRIDE_SESSION_ENCRYPTION_KEY` and state directory; plaintext exists only in a mode-`0600` temporary file during a callback.

- [ ] **Step 1: Install the production browser runtime**

Run: `npm install playwright@1.61.1 --save-exact`

Expected: `playwright` appears in `dependencies`; `@playwright/test` remains in `devDependencies`.

- [ ] **Step 2: Write failing encryption and cleanup tests**

```ts
it('stores only AES-GCM ciphertext and removes plaintext after the callback', async () => {
  const store = createRentRideSessionStore({ directory, key: Buffer.alloc(32, 7) });
  await store.writeActive(JSON.stringify({ cookies: [{ name: 'session', value: 'sensitive' }] }));
  expect(await readFile(join(directory, 'active.enc'), 'utf8')).not.toContain('sensitive');
  let temporary = '';
  await store.withActiveState(async (path) => {
    temporary = path;
    expect(await readFile(path, 'utf8')).toContain('cookies');
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
  await expect(access(temporary)).rejects.toThrow();
});
```

- [ ] **Step 3: Run the test and verify RED**

Run: `npx vitest run src/modules/integrations/rentride/session-store.test.ts`

Expected: FAIL because the session store does not exist.

- [ ] **Step 4: Implement authenticated AES-256-GCM storage**

Use `randomBytes(12)`, `createCipheriv('aes-256-gcm', key, iv)`, a versioned envelope `{ v: 1, iv, tag, ciphertext }`, atomic write-to-temp then rename, `mkdir({ recursive: true, mode: 0o700 })`, and `open(path, 'wx', 0o600)`. Validate that parsed Playwright state is an object with `cookies` and `origins` arrays. Always unlink plaintext in `finally`; map malformed ciphertext to `RENTRIDE_STATE_INVALID` without echoing content.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/modules/integrations/rentride/session-store.test.ts`

Expected: PASS, including cleanup on a throwing callback.

```bash
git add package.json package-lock.json src/modules/integrations/rentride/session-store.ts src/modules/integrations/rentride/session-store.test.ts
git commit -m "feat: secure RentRide browser sessions"
```

### Task 4: Build the read-only RentRide browser adapter

**Files:**
- Create: `src/modules/integrations/rentride/adapter.ts`
- Create: `src/modules/integrations/rentride/adapter.test.ts`
- Create: `src/modules/integrations/rentride/fixtures/reservations.html`
- Create: `src/modules/integrations/rentride/fixtures/reservation-detail.html`

**Interfaces:**
- Consumes: `RentRideSessionStore`, `RENTRIDE_LOGIN`, `RENTRIDE_PASSWORD`, `https://rentride.ru`.
- Produces: `createRentRideAdapter(config)` with `authenticate`, `completeSms`, `listReservations`, `loadReservation`, `healthCheck`, and `close`.
- Produces: `RentRideAuthRequiredError`, `RentRideLayoutError`, `RentRideRateLimitError` using safe codes only.

- [ ] **Step 1: Add anonymized HTML fixtures and failing extraction tests**

Use fake names, phones and external IDs. Verify list pagination, a deal detail with all known fields, missing optional fields, and detection of a login page:

```ts
it('extracts list rows without relying on generated CSS classes', async () => {
  await page.setContent(reservationsFixture);
  const rows = await extractReservationRows(page);
  expect(rows).toEqual([
    { externalId: '700001', sourceStatus: 'Эксплуатация', sourceUpdatedAt: '06.09.2026, 11:42' },
  ]);
});
```

- [ ] **Step 2: Run the adapter test and verify RED**

Run: `npx vitest run src/modules/integrations/rentride/adapter.test.ts`

Expected: FAIL because the extraction functions do not exist.

- [ ] **Step 3: Implement safe locators and navigation**

Use Playwright locators based on stable URLs, labels, headings and Russian field text. Restrict navigation with `context.route('**/*', ...)`: in read mode allow only `GET`/`HEAD` to `https://rentride.ru`; in authentication mode additionally allow same-origin login and SMS form submissions initiated by the two explicit authentication methods. Abort every other origin and every reservation-changing request. Use `page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 })`, one page at a time, 300–700 ms jitter between detail reads, and at most 100 list pages. Never call `page.content()` in logs or errors.

```ts
export interface RentRideAdapter {
  authenticate(): Promise<'CONNECTED' | 'SMS_REQUIRED'>;
  completeSms(code: string): Promise<void>;
  listReservations(): Promise<Array<{ externalId: string; sourceStatus: string; sourceUpdatedAt: string | null }>>;
  loadReservation(externalId: string): Promise<RawRentRideReservation>;
  healthCheck(): Promise<'CONNECTED' | 'AUTH_REQUIRED'>;
  close(): Promise<void>;
}
```

Login must type credentials only into fields resolved by accessible labels, save pending encrypted state when SMS is requested, and save active encrypted state after the authenticated reservations URL is visible. `completeSms` accepts only `/^\d{4,8}$/u` and never logs the code.

- [ ] **Step 4: Verify the adapter and read-only guard**

Run: `npx vitest run src/modules/integrations/rentride/adapter.test.ts`

Expected: PASS; a test attempting POST/PUT/PATCH/DELETE observes an aborted request.

- [ ] **Step 5: Commit**

```bash
git add src/modules/integrations/rentride
git commit -m "feat: read RentRide reservations safely"
```

### Task 5: Upsert external reservations, leads and clients

**Files:**
- Create: `src/modules/integrations/rentride/apply-reservation.ts`
- Create: `src/modules/integrations/rentride/apply-reservation.test.ts`

**Interfaces:**
- Consumes: `NormalizedRentRideReservation`, tenant/actor IDs, encryption/search keys and a Prisma transaction.
- Produces: `applyRentRideReservation(input, tx)` returning `{ disposition, reservationId, leadId, clientId, vehicleId }`.
- Produces: `CREATED`, `UPDATED`, `UNCHANGED`, `REQUIRES_REVIEW` dispositions with safe reason codes.

- [ ] **Step 1: Write failing idempotency and tenant-boundary tests**

Cover first import, unchanged repeat, changed status, existing phone match inside the same company, same phone in another company, vehicle plate match, missing vehicle, and a one-token client name. The central assertion is:

```ts
await applyRentRideReservation(input, tx);
await applyRentRideReservation(input, tx);
expect(tx.externalReservation.upsert).toHaveBeenCalledTimes(2);
expect(tx.lead.create).toHaveBeenCalledTimes(1);
expect(tx.client.create).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/modules/integrations/rentride/apply-reservation.test.ts`

Expected: FAIL because the application service does not exist.

- [ ] **Step 3: Implement the transaction contract**

```ts
export type ApplyDisposition = 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'REQUIRES_REVIEW';

export interface ApplyReservationResult {
  disposition: ApplyDisposition;
  reservationId: string;
  leadId: string;
  clientId: string | null;
  vehicleId: string | null;
  reviewCode: string | null;
}

export async function applyRentRideReservation(
  input: {
    companyId: string;
    integrationId: string;
    actorUserId: string;
    actorEmail: string;
    reservation: NormalizedRentRideReservation;
    encryptionKey: string;
    searchKey: string;
    now: Date;
    dryRun: boolean;
  },
  tx: RentRideApplyTransaction,
): Promise<ApplyReservationResult>;
```

Map statuses to `LeadStatus`, upsert by `companyId_provider_externalId`, encrypt phone/address/region, set `lastSeenAt`, and avoid writes when `dryRun` is true. Find client by `companyId + phoneIndex`; create only when a valid two-or-more-token name is available, using the first token as `lastName`, second as `firstName`, remaining as `middleName`, `source: 'RentRide'`, `status: 'NEW'`, empty driver categories and no document placeholders. Find the vehicle only by `companyId + registrationNumberNormalized + archivedAt: null`.

Create/update the linked lead as `source: RentRide #<externalId>` and encrypt a short operational comment without storing provider HTML. Audit new clients and leads with `actorUserId`, redacted entity labels and safe source/external ID changes.

- [ ] **Step 4: Verify fail-closed behavior and GREEN**

Run: `npx vitest run src/modules/integrations/rentride/apply-reservation.test.ts`

Expected: all tests PASS; serialized audit arguments contain neither phone nor address.

- [ ] **Step 5: Commit**

```bash
git add src/modules/integrations/rentride/apply-reservation.ts src/modules/integrations/rentride/apply-reservation.test.ts
git commit -m "feat: import RentRide leads and clients"
```

### Task 6: Reconcile active and completed rentals

**Files:**
- Create: `src/modules/integrations/rentride/reconcile-rental.ts`
- Create: `src/modules/integrations/rentride/reconcile-rental.test.ts`

**Interfaces:**
- Consumes: linked external reservation, client, vehicle, integration actor and latest published contract template.
- Produces: `reconcileRentRideRental(input, tx)` returning `NONE`, `OPENED`, `CLOSED` or `REQUIRES_REVIEW`.

- [ ] **Step 1: Write failing lifecycle tests**

Cover `CONTACTED` doing nothing, `IN_USE` creating exactly one ACTIVE rental, repeated `IN_USE`, overlap rejection, missing client/vehicle/template, `COMPLETED` closing only the linked ACTIVE rental, already completed idempotency, and `CANCELLED` after ACTIVE requiring review.

```ts
const first = await reconcileRentRideRental(inputInUse, tx);
const second = await reconcileRentRideRental(inputInUse, tx);
expect(first.kind).toBe('OPENED');
expect(second.kind).toBe('NONE');
expect(tx.rental.create).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/modules/integrations/rentride/reconcile-rental.test.ts`

Expected: FAIL because the reconciler does not exist.

- [ ] **Step 3: Implement legal operational mirrors**

```ts
export type RentalReconcileResult =
  | { kind: 'NONE' }
  | { kind: 'OPENED'; rentalId: string }
  | { kind: 'CLOSED'; rentalId: string }
  | { kind: 'REQUIRES_REVIEW'; code: string };
```

For `IN_USE`, require linked client, vehicle, valid period, provider daily and total prices, and no overlapping `CONFIRMED`/`ACTIVE` rental. Missing required financial values returns `REQUIRES_REVIEW` instead of substituting zero. Select the newest published company template. Create an `ACTIVE` rental directly with `contractNumber: RR-<externalId>`, `confirmedAt` and `activatedAt` equal to the synchronization time, the provider prices, safe billable days, and a versioned snapshot:

```ts
snapshot: {
  schemaVersion: 1,
  externalSource: { provider: 'RENTRIDE', externalId, importedAt: now.toISOString() },
  rental: { startsAt, endsAt, dailyRateMinor, totalPriceMinor, depositMinor },
  notice: 'Операционное зеркало внешней сделки; не является подписанным договором СУПА ПРО',
}
```

For `COMPLETED`, update only the linked row matching `{ status: 'ACTIVE' }` to `{ status: 'COMPLETED', completedAt: now }`; do not create a `RentalOperation`. These are the only fields accepted by the existing legal-snapshot trigger. Audit `RENTAL` creation/closure with `actorEmailSnapshot` from the configured actor and no personal data.

- [ ] **Step 4: Run focused tests plus the legal trigger suite**

Run: `npx vitest run src/modules/integrations/rentride/reconcile-rental.test.ts src/database/prisma/rental-schema.test.ts src/modules/rentals/operations/server/return-rental.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/integrations/rentride/reconcile-rental.ts src/modules/integrations/rentride/reconcile-rental.test.ts
git commit -m "feat: mirror RentRide rental lifecycle"
```

### Task 7: Orchestrate locking, dry-run, failures and the worker command

**Files:**
- Create: `src/modules/integrations/rentride/sync.ts`
- Create: `src/modules/integrations/rentride/sync.test.ts`
- Create: `scripts/sync-rentride.ts`
- Create: `scripts/configure-rentride.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: adapter, application services and Prisma.
- Produces: `runRentRideSync({ mode, integrationId }, deps)` and CLI scripts `integrations:sync-rentride`, `integrations:dry-run-rentride`, `integrations:configure-rentride`.

- [ ] **Step 1: Write failing orchestration tests**

Verify lease exclusion, skip during `pausedUntil`, detail loading only for new/changed list rows, per-deal error isolation, `AUTH_REQUIRED`, three-failure circuit breaker, counter totals, release in `finally`, and dry-run with zero domain writes.

```ts
expect(await Promise.all([run(), run()])).toEqual([
  expect.objectContaining({ acquired: true }),
  expect.objectContaining({ acquired: false, code: 'LEASE_HELD' }),
]);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/modules/integrations/rentride/sync.test.ts`

Expected: FAIL because the orchestrator does not exist.

- [ ] **Step 3: Implement the one-shot orchestrator**

Acquire a five-minute lease using `updateMany` where `leaseExpiresAt` is null or expired, create a `RentRideSyncRun`, update `lastAttemptAt`, and always clear the matching `leaseOwner` in `finally`. Use one transaction per reservation so a malformed deal cannot roll back successful neighbors. Set run status `SUCCESS`, `PARTIAL` or `FAILED` from counters. Clear `syncRequestedAt` only after a run row has reached a terminal status; a worker crash therefore leaves the manual request available for the next timer invocation.

On authentication loss set `authState: AUTH_REQUIRED`, `lastErrorCode: RENTRIDE_AUTH_REQUIRED` and stop without retrying. After three consecutive non-auth failures set `pausedUntil = now + 30 minutes`; a successful run resets failures and pause. Logs are JSON lines containing only run ID, external ID, stage, duration, counters and safe codes.

- [ ] **Step 4: Add the commands and environment validation**

```json
{
  "integrations:configure-rentride": "tsx --conditions=react-server scripts/configure-rentride.ts",
  "integrations:sync-rentride": "tsx --conditions=react-server scripts/sync-rentride.ts --mode=apply",
  "integrations:dry-run-rentride": "tsx --conditions=react-server scripts/sync-rentride.ts --mode=dry-run"
}
```

`configure-rentride.ts` must require `RENTRIDE_COMPANY_SLUG` and `RENTRIDE_ACTOR_EMAIL`, resolve both from PostgreSQL, and upsert the integration disabled. `sync-rentride.ts` must validate `RENTRIDE_LOGIN`, `RENTRIDE_PASSWORD`, `RENTRIDE_SESSION_ENCRYPTION_KEY`, `RENTRIDE_STATE_PATH`, `CLIENT_DATA_ENCRYPTION_KEY` and `CLIENT_SEARCH_KEY` before opening Chromium. It prints safe counters and exits non-zero on `FAILED` or `AUTH_REQUIRED`.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/modules/integrations/rentride/sync.test.ts`

Expected: PASS.

```bash
git add package.json scripts/sync-rentride.ts scripts/configure-rentride.ts src/modules/integrations/rentride/sync.ts src/modules/integrations/rentride/sync.test.ts
git commit -m "feat: schedule idempotent RentRide sync runs"
```

### Task 8: Add the protected integration control page

**Files:**
- Create: `src/modules/integrations/rentride/admin.ts`
- Create: `src/modules/integrations/rentride/admin.test.ts`
- Create: `src/modules/integrations/rentride/actions.ts`
- Create: `src/modules/integrations/rentride/actions.test.ts`
- Create: `src/modules/integrations/rentride/components/RentRideIntegrationPage.tsx`
- Create: `src/modules/integrations/rentride/components/RentRideIntegrationPage.test.tsx`
- Create: `src/modules/integrations/rentride/components/RentRideActions.tsx`
- Create: `src/app/(protected)/admin/integrations/rentride/page.tsx`
- Create: `src/app/(protected)/admin/integrations/rentride/loading.tsx`
- Modify: `src/modules/admin/overview/AdminOverviewPage.tsx`
- Modify: `src/modules/admin/overview/AdminOverviewPage.test.tsx`

**Interfaces:**
- Consumes: `requireAdminCenterAccess`, `runRentRideSync` and adapter authentication methods.
- Produces: admin-only status page, pending-aware manual sync, SMS re-login and review table.

- [ ] **Step 1: Write failing access/action/component tests**

Test SYSTEM and owning COMPANY admin access, rejection of an unrelated company, non-numeric SMS rejection, pending button copy, no secret rendering, run metrics, last error code and review links.

```ts
expect(screen.getByRole('button', { name: 'Синхронизировать сейчас' })).toBeEnabled();
expect(screen.queryByText(/password|cookie|RENTRIDE_PASSWORD/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run src/modules/integrations/rentride/admin.test.ts src/modules/integrations/rentride/actions.test.ts src/modules/integrations/rentride/components/RentRideIntegrationPage.test.tsx`

Expected: FAIL because the page and actions do not exist.

- [ ] **Step 3: Implement tenant-scoped queries and Server Actions**

Every action must call `requireAdminCenterAccess`, reload the integration by allowed company ID, validate untrusted input and return this serializable state:

```ts
export type RentRideActionState = {
  status: 'idle' | 'success' | 'error' | 'sms-required';
  message?: string;
  code?: string;
};
```

`syncRentRideNowAction` does not open a browser inside the Next.js process: it sets `syncRequestedAt` after the same authorization and ownership checks, then revalidates `/admin/integrations/rentride`. The next one-shot worker consumes that request through the normal lease and clears it only after recording a run. `beginRentRideLoginAction` requests login and returns `sms-required`; `completeRentRideSmsAction` accepts only 4–8 digits, completes authentication, clears the code from memory and revalidates the integration page. No action returns thrown provider text.

- [ ] **Step 4: Implement the UI with visible pending states**

Render status, last attempt/success, next timer expectation, counters, safe error, queued manual sync, login recovery, SMS field only while required, and a problem table linking to `/leads`. Use `useActionState` pending state to disable duplicate submissions and show `Ставим в очередь…` or `Проверяем код…`; refresh the route every ten seconds while `syncRequestedAt` remains set. Add an `Интеграция RentRide` card to the existing admin overview.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/modules/integrations/rentride src/modules/admin/overview/AdminOverviewPage.test.tsx`

Expected: PASS.

```bash
git add src/app/\(protected\)/admin/integrations/rentride src/modules/integrations/rentride src/modules/admin/overview/AdminOverviewPage.tsx src/modules/admin/overview/AdminOverviewPage.test.tsx
git commit -m "feat: manage RentRide synchronization"
```

### Task 9: Show RentRide identity and import state in leads

**Files:**
- Modify: `src/modules/leads/types.ts`
- Modify: `src/modules/leads/queries.ts`
- Modify: `src/modules/leads/components/LeadsPage.tsx`
- Create: `src/modules/leads/components/LeadsPage.test.tsx`

**Interfaces:**
- Consumes: optional `Lead.externalReservation` relation.
- Produces: `LeadItem.externalSource` with external ID, source status, sync state and review code.

- [ ] **Step 1: Write the failing presentation test**

```ts
expect(rendered).toContain('RentRide #723444');
expect(rendered).toContain('Эксплуатация');
expect(rendered).toContain('Требуется сопоставить автомобиль');
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/modules/leads/components/LeadsPage.test.tsx`

Expected: FAIL because external source fields are absent.

- [ ] **Step 3: Extend the read model and cards**

```ts
externalSource: {
  provider: 'RENTRIDE';
  externalId: string;
  sourceStatus: string;
  syncState: 'SYNCED' | 'REQUIRES_REVIEW' | 'ERROR';
  errorCode: string | null;
} | null;
```

Select only those fields in `listLeads`; do not expose encrypted external-reservation columns. Render a compact source badge, raw provider status, last import state and Russian safe-code mapping. Keep manual leads unchanged.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/modules/leads`

Expected: PASS.

```bash
git add src/modules/leads
git commit -m "feat: identify RentRide leads"
```

### Task 10: Surface RentRide health on `/system`

**Files:**
- Modify: `src/modules/system-health/get-operational-health.ts`
- Modify: `src/modules/system-health/get-operational-health.test.ts`
- Modify: `src/modules/system-health/SystemHealthPage.tsx`
- Modify: `src/modules/system-health/SystemHealthPage.test.tsx`

**Interfaces:**
- Consumes: RentRide integration heartbeat and count of reservations in `REQUIRES_REVIEW`/`ERROR`.
- Produces: `OperationalHealthItem` with key `rentride` and a link to the control page.

- [ ] **Step 1: Write failing health tests**

Test unconfigured, `AUTH_REQUIRED`, recent success, success older than 15 minutes, safe last error, and review count. The expected healthy snapshot is:

```ts
expect(items.find((item) => item.key === 'rentride')).toMatchObject({
  status: 'healthy',
  errorCode: null,
  metrics: [
    { label: 'Интеграции', value: '1' },
    { label: 'На проверке', value: '0' },
  ],
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run src/modules/system-health/get-operational-health.test.ts src/modules/system-health/SystemHealthPage.test.tsx`

Expected: FAIL because `rentride` is not a valid operation key.

- [ ] **Step 3: Add the RentRide health projection**

Extend `OperationalSnapshot` with configured count, auth state, last attempt/success/error and review count. A disabled/missing integration is `unconfigured`; `AUTH_REQUIRED` or `ERROR` is `unavailable`; a success not older than 15 minutes is `healthy`; a success 15–30 minutes old is `degraded`; older is `unavailable`. Add `FiRefreshCw` icon and `/admin/integrations/rentride` action link without exposing secrets.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/modules/system-health`

Expected: PASS.

```bash
git add src/modules/system-health
git commit -m "feat: monitor RentRide synchronization"
```

### Task 11: Package, verify and activate the production timer

**Files:**
- Create: `deploy/pilot-plus-rentride-sync.service`
- Create: `deploy/pilot-plus-rentride-sync.timer`
- Create: `docs/runbooks/rentride-sync.md`
- Modify: `docs/PROJECT_GUIDE.md`
- Modify: `tests/system-health.spec.ts`
- Modify: `tests/rentals.spec.ts`

**Interfaces:**
- Consumes: all previous tasks and production environment variables.
- Produces: reproducible VPS installation, dry-run gate, automatic five-minute sync and documented rollback.

- [ ] **Step 1: Add browser-level acceptance tests**

Add authenticated E2E assertions that the integration route is admin-only, manual sync exposes a pending state, an imported lead displays `RentRide #<id>`, linked rentals show their external source, and `/system` has a RentRide card. Stub the adapter; browser tests must not contact RentRide.

- [ ] **Step 2: Add hardened systemd units**

Use this service contract:

```ini
[Unit]
Description=Pilot+ RentRide reservation synchronization
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=oneshot
User=pilot-plus
Group=pilot-plus
WorkingDirectory=/opt/pilot-plus/current
Environment=NODE_ENV=production
Environment=PLAYWRIGHT_BROWSERS_PATH=/opt/pilot-plus/shared/playwright
EnvironmentFile=/etc/pilot-plus.env
ExecStart=/usr/bin/npm run integrations:sync-rentride
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/pilot-plus/rentride
TimeoutStartSec=240
```

Use this timer contract:

```ini
[Unit]
Description=Run Pilot+ RentRide synchronization every five minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
RandomizedDelaySec=15s
Persistent=true
Unit=pilot-plus-rentride-sync.service

[Install]
WantedBy=timers.target
```

- [ ] **Step 3: Write the production runbook**

Document these exact gates without including secret values:

1. Back up PostgreSQL.
2. Deploy the release with the integration disabled.
3. Apply `prisma migrate deploy` and run `prisma validate`.
4. Create `/var/lib/pilot-plus/rentride` owned by `pilot-plus:pilot-plus`, mode `0700`.
5. Add the eight required RentRide/client environment variables to `/etc/pilot-plus.env`, mode `0600`.
6. Install Chromium to `/opt/pilot-plus/shared/playwright` with `PLAYWRIGHT_BROWSERS_PATH=... npx playwright install --with-deps chromium`.
7. Run `npm run integrations:configure-rentride`.
8. Complete SMS login from the protected admin page.
9. Run `npm run integrations:dry-run-rentride`; compare counts, clients, plates, periods and conflicts.
10. Enable the integration row, run one APPLY manually, inspect leads/rentals/audit, then enable the timer.
11. Verify `systemctl status`, `systemctl list-timers`, safe journal output and `/system`.
12. Roll back by disabling the timer and release; never mass-delete imported records.

- [ ] **Step 4: Run the full local verification gate**

Run in this order:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx playwright test tests/system-health.spec.ts tests/rentals.spec.ts --workers=1
git diff --check
```

Expected: every command exits `0`; build completes; no test contacts the live provider; `git diff --check` prints nothing.

- [ ] **Step 5: Commit the packaging**

```bash
git add deploy/pilot-plus-rentride-sync.service deploy/pilot-plus-rentride-sync.timer docs/runbooks/rentride-sync.md docs/PROJECT_GUIDE.md tests/system-health.spec.ts tests/rentals.spec.ts
git commit -m "docs: operationalize RentRide synchronization"
```

- [ ] **Step 6: Deploy with the dry-run safety gate**

On the VPS, follow the runbook exactly. Before APPLY, save the dry-run counters and manually verify every unmatched plate and overlap. After the first APPLY, query unique `(companyId, provider, externalId)` values and confirm that no duplicate `RR-<externalId>` contract number exists. Enable the timer only after these checks pass.
