# Telegram Daily Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Заявки` and `Автопарк` show live Moscow-day data and send one durable 00:05 daily digest to each company's authorized Telegram work group.

**Architecture:** Pilot+ owns group bindings, tenant authorization, Moscow-day calculations, availability, digest creation, and PII hydration. The Python bot owns Telegram presentation and polling only. Existing durable `BotNotificationJob` leasing delivers idempotent daily summaries and recovers missed sends after restarts.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Prisma/PostgreSQL, Zod, Vitest, Python 3.12, aiogram 3.30, pytest, Docker Compose.

## Global Constraints

- Rental requests are read-only in Telegram; creation, approval, rejection, and editing remain desktop-only.
- The digest runs for the current `Europe/Moscow` day at or after 00:05 and is unique by company/date.
- Only `SUPER_ADMIN`, `COMPANY_ADMIN`, and `DISPATCHER` may bind a work group or read staff operations.
- Private chats cannot be bound; one active group exists per company and one company owns a group ID.
- The bot never connects directly to PostgreSQL and never trusts a company ID supplied by Telegram.
- PII is hydrated only after a durable job is claimed for the authorized bound group and is not logged or stored in the job payload.
- All callbacks are acknowledged and every visible menu action responds in Russian.

---

### Task 1: Durable company-to-group binding

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260820090000_add_telegram_group_binding/migration.sql`
- Modify: `src/database/prisma/telegram-bot-schema.test.ts`
- Create: `src/modules/bot-api/group-bindings.ts`
- Create: `src/modules/bot-api/group-bindings.test.ts`
- Create: `src/app/api/bot/v1/group-bindings/route.ts`
- Create: `src/app/api/bot/v1/group-bindings/route.test.ts`

**Interfaces:**
- Produces Prisma model `TelegramGroupBinding` with unique `companyId` and unique `telegramChatId`.
- Produces `bindTelegramGroup(identity, input, database?) -> { companyId, telegramChatId, title }`.
- Produces protected `POST /api/bot/v1/group-bindings` accepting `{ telegramChatId: string, title: string | null, chatType: "group" | "supergroup" }`.

- [ ] **Step 1: Add RED schema assertions**

Add assertions that the schema contains:

```ts
model TelegramGroupBinding {
  id             String   @id @default(cuid())
  companyId      String   @unique
  telegramChatId String   @unique
  title          String?
  boundByUserId  String
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)
}
```

Also assert the migration creates both unique indexes and foreign keys to `Company` and `User` with safe delete behavior.

- [ ] **Step 2: Run schema test and verify RED**

Run: `npx vitest run src/database/prisma/telegram-bot-schema.test.ts`

Expected: FAIL because the model and migration do not exist.

- [ ] **Step 3: Add the model and additive migration**

Add `telegramGroupBinding TelegramGroupBinding?` to `Company`, `boundTelegramGroups TelegramGroupBinding[]` to `User`, and the model above with relations:

```prisma
company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
boundBy User @relation(fields: [boundByUserId], references: [id], onDelete: Restrict)
```

The migration must only create the table, indexes, and foreign keys. It must not update existing rows or apply to a shared database during implementation.

- [ ] **Step 4: Verify Prisma GREEN**

Run:

```powershell
npx prisma format --schema src/database/prisma/schema.prisma
npx prisma generate --schema src/database/prisma/schema.prisma
$env:DATABASE_URL='postgresql://pilot:pilot@127.0.0.1:5433/pilot'; npx prisma validate --schema src/database/prisma/schema.prisma
npx vitest run src/database/prisma/telegram-bot-schema.test.ts
```

Expected: all commands exit 0 and the schema test passes.

- [ ] **Step 5: Write RED binding tests**

Cover:

```ts
it('binds a supergroup to the active staff company and audits without PII')
it('rejects private chats, clients, DRIVER, and VIEWER')
it('rejects a chat already owned by another company')
it('atomically rebinds the same company and records the current actor')
```

Use a transaction mock that requires a fresh `telegramIdentity` plus active `CompanyMember` role check inside the same transaction.

- [ ] **Step 6: Run binding tests and verify RED**

Run: `npx vitest run src/modules/bot-api/group-bindings.test.ts src/app/api/bot/v1/group-bindings/route.test.ts`

Expected: FAIL because module and route do not exist.

- [ ] **Step 7: Implement binding and route**

Validate with:

```ts
const groupBindingSchema = z.object({
  telegramChatId: z.string().regex(/^-?[1-9]\d{0,19}$/u),
  title: z.string().trim().min(1).max(200).nullable(),
  chatType: z.enum(['group', 'supergroup']),
});
```

Inside a Serializable transaction, re-read identity, active user, and membership; permit `SUPER_ADMIN` globally or `COMPANY_ADMIN`/`DISPATCHER` in the identity company; upsert by `companyId`; allow the same group only when its current company matches; write an `ASSIGN/SYSTEM/TELEGRAM_GROUP_BINDING` audit containing chat type only.

- [ ] **Step 8: Verify binding GREEN and commit**

Run the focused tests, `npm run typecheck`, scoped Prettier, and `git diff --check`. Commit:

```bash
git add src/database/prisma src/modules/bot-api/group-bindings.ts src/modules/bot-api/group-bindings.test.ts src/app/api/bot/v1/group-bindings
git commit -m "feat(bot): bind company work groups"
```

### Task 2: Tenant-scoped Moscow-day operations API

**Files:**
- Create: `src/modules/bot-api/moscow-day.ts`
- Create: `src/modules/bot-api/moscow-day.test.ts`
- Create: `src/modules/bot-api/daily-operations.ts`
- Create: `src/modules/bot-api/daily-operations.test.ts`
- Create: `src/app/api/bot/v1/staff/today/route.ts`
- Create: `src/app/api/bot/v1/staff/today/route.test.ts`

**Interfaces:**
- Produces `moscowDay(value: Date) -> { key: string; startsAt: Date; endsAt: Date; digestAt: Date }`.
- Produces `getDailyOperations(identity, now, database?) -> DailyOperationsDto`.
- Produces `GET /api/bot/v1/staff/today` for the authenticated Telegram staff identity.

- [ ] **Step 1: Write RED Moscow-boundary tests**

Assert:

```ts
expect(moscowDay(new Date('2026-08-19T21:04:59Z')).key).toBe('2026-08-20');
expect(moscowDay(new Date('2026-08-19T21:04:59Z')).startsAt.toISOString()).toBe('2026-08-19T21:00:00.000Z');
expect(moscowDay(new Date('2026-08-19T21:04:59Z')).endsAt.toISOString()).toBe('2026-08-20T21:00:00.000Z');
expect(moscowDay(new Date('2026-08-19T21:04:59Z')).digestAt.toISOString()).toBe('2026-08-19T21:05:00.000Z');
```

- [ ] **Step 2: Verify RED, then implement the pure helper**

Run the test before and after implementing a strict Moscow UTC+03:00 calendar conversion. Expected RED is missing module; expected GREEN is all boundary assertions passing.

- [ ] **Step 3: Write RED daily-operation tests**

Cover:

```ts
it('returns only same-company pending requests intersecting the Moscow day')
it('classifies vehicles as free, occupied, returning, maintenance, or unavailable')
it('treats rental and maintenance ranges as half-open')
it('rejects clients and DRIVER/VIEWER after a fresh membership reload')
it('decrypts delivery address only for an authorized response and never selects passport data')
```

The DTO must contain bounded arrays (maximum 200 each) and only:

```ts
type DailyOperationsDto = {
  date: string;
  requests: Array<{ id: string; clientName: string; phone: string; startsAt: string; endsAt: string; fulfillmentMode: 'OFFICE' | 'DELIVERY'; deliveryAddress: string | null; vehicleLabel: string | null }>;
  vehicles: Array<{ id: string; label: string; state: 'FREE' | 'OCCUPIED' | 'RETURNING' | 'MAINTENANCE' | 'UNAVAILABLE'; availableFrom: string | null }>;
};
```

- [ ] **Step 4: Verify RED, implement query and route, then verify GREEN**

The server must derive company/role from `resolveBotIdentity`, reload membership in the query, use exact `[startsAt, endsAt)` overlap conditions for rentals, maintenance, and pending requests, and decrypt only phone/delivery address fields. The route accepts no company or date override.

Run focused tests, `npm run typecheck`, scoped Prettier, and `git diff --check`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/bot-api/moscow-day.ts src/modules/bot-api/moscow-day.test.ts src/modules/bot-api/daily-operations.ts src/modules/bot-api/daily-operations.test.ts src/app/api/bot/v1/staff/today
git commit -m "feat(bot): expose daily fleet operations"
```

### Task 3: Durable 00:05 digest

**Files:**
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`
- Modify: `src/app/api/bot/v1/notifications/claim/route.ts`
- Modify: `bot/services/notifications.py`
- Modify: `bot/tests/test_notifications.py`

**Interfaces:**
- Produces `enqueueDailyDigests(now, database?) -> Promise<number>`.
- Adds notification template `DAILY_OPERATIONS_DIGEST` with job payload `{ date: string }` and event key `daily-operations:<companyId>:<date>`.

- [ ] **Step 1: Write RED enqueue/recovery tests**

Cover exact behavior:

```ts
it('does not enqueue before 00:05 Moscow')
it('enqueues once per bound company after 00:05 with identifier-only payload')
it('uses createMany skipDuplicates to recover a missed run without duplicate delivery')
it('does not enqueue for a company without a group binding')
```

- [ ] **Step 2: Write RED hydration tests**

Claiming `DAILY_OPERATIONS_DIGEST` must hydrate live `DailyOperationsDto`, format the Russian summary, and return the exact bound `telegramChatId`. Assert that the stored job payload contains no name, phone, address, passport, or vehicle details.

- [ ] **Step 3: Verify RED, implement enqueue and hydration, then verify GREEN**

Call `enqueueDailyDigests(now)` before claiming jobs in the protected claim route. Extend `hydrateJob` to select `companyId`, load the binding again, and use the shared daily-operations query by explicit authorized system context. If the binding changed or vanished, return a non-deliverable job error that is rescheduled without sending to the old group.

- [ ] **Step 4: Update Python formatter tests and implementation**

Add a test proving `notification_text()` renders a hydrated daily digest message unchanged and never formats raw identifier-only payload into a misleading notification. Implement the minimal template branch.

- [ ] **Step 5: Run verification and commit**

Run:

```powershell
npx vitest run src/modules/bot-api/notifications.test.ts src/modules/bot-api/daily-operations.test.ts
python -m pytest bot/tests/test_notifications.py -q
npm run typecheck
```

Then scoped Prettier and `git diff --check`. Commit:

```bash
git add src/modules/bot-api/notifications.ts src/modules/bot-api/notifications.test.ts src/app/api/bot/v1/notifications/claim/route.ts bot/services/notifications.py bot/tests/test_notifications.py
git commit -m "feat(bot): deliver daily operations digest"
```

### Task 4: Telegram group setup and live menu sections

**Files:**
- Modify: `bot/services/pilot_api.py`
- Modify: `bot/tests/test_pilot_api.py`
- Modify: `bot/handlers/staff.py`
- Modify: `bot/tests/test_staff_handlers.py`
- Modify: `bot/formatters/rentals.py`
- Create: `bot/formatters/daily_operations.py`
- Create: `bot/tests/test_daily_operations_formatter.py`

**Interfaces:**
- Adds `PilotApiClient.bind_group(telegram_user_id, telegram_chat_id, title, chat_type)`.
- Adds `PilotApiClient.daily_operations(telegram_user_id)`.
- Adds `/pilot_setup` group command.
- Replaces placeholder responses for `Заявки` and `Автопарк` with live API-backed messages.

- [ ] **Step 1: Write RED API-client tests**

Assert exact protected paths, Telegram identity header, bounded JSON body, no redirects, and errors mapped to `PilotApiError`.

- [ ] **Step 2: Write RED handler tests**

Cover:

```python
async def test_pilot_setup_rejects_private_chat_and_client()
async def test_pilot_setup_binds_group_for_authorized_staff()
async def test_requests_button_formats_today_requests_read_only()
async def test_fleet_button_groups_free_returning_and_unavailable_vehicles()
async def test_live_sections_answer_api_failure_and_keep_staff_keyboard()
```

- [ ] **Step 3: Implement client methods, pure formatter, and handlers**

`/pilot_setup` passes Telegram's `chat.id`, optional title, and exact `chat.type`; it never accepts a typed company ID. `Заявки` and `Автопарк` call the same `/staff/today` endpoint and select their own presentation. Empty lists have explicit Russian copy. Messages are chunked below Telegram's 4096-character limit.

- [ ] **Step 4: Run complete bot verification**

Run:

```powershell
python -m compileall -q bot
python -m pytest bot/tests -q
npm run typecheck
```

Expected: all tests pass and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add bot/services/pilot_api.py bot/tests/test_pilot_api.py bot/handlers/staff.py bot/tests/test_staff_handlers.py bot/formatters bot/tests/test_daily_operations_formatter.py
git commit -m "feat(bot): show daily requests and fleet"
```

### Task 5: Deployment and smoke verification

**Files:**
- Update: `docs/runbooks/telegram-bot.md`
- Deploy: committed `bot/` files to `/opt/pilot-plus/bot` on VPS.

**Interfaces:**
- Produces healthy bot container and documented `/pilot_setup` procedure.

- [ ] **Step 1: Run final focused and static checks**

Run all new Vitest files, the complete bot pytest suite, Prisma format/generate/validate, `npm run typecheck`, scoped Prettier, and `git diff --check`.

- [ ] **Step 2: Apply only the new additive migration to the configured local development database**

Run `npx prisma migrate deploy --schema src/database/prisma/schema.prisma`; do not seed or alter unrelated rows. Verify migration status reports no pending migration.

- [ ] **Step 3: Restart local Pilot+ from `main` and verify protected APIs**

Verify the linked profile for Telegram ID `185185047`, bind only a real group via `/pilot_setup`, and confirm private-chat setup is rejected.

- [ ] **Step 4: Archive, upload, rebuild, and restart bot**

Use `git archive` for committed `bot/` files, upload with the deployment SSH key, verify the exact `/opt/pilot-plus/bot` path before replacement, and run Docker Compose with `/etc/pilot-plus-bot.env`.

- [ ] **Step 5: Verify deployment**

Confirm bot and Redis are healthy with zero restarts, tunnel/API reachability is active, `Заявки` and `Автопарк` return live data, `/pilot_setup` binds the intended work group, and a controlled due digest creates exactly one sent job.

## Plan self-review

- Spec coverage: read-only requests, daily availability, role-bound group setup, 00:05 scheduling, idempotent recovery, tenant isolation, PII hydration, live keyboard sections, and deployment are mapped to tasks.
- Scope: wash and maintenance are deliberately separate follow-up plans after this independently deployable daily-operations slice.
- Type consistency: group binding, daily DTO, notification template, Python client methods, and routes use the same names across tasks.
- Placeholder scan: no unfinished implementation markers remain.
