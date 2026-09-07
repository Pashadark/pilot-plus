# Lead Operations And Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable two-channel lead notifications, scheduled lead work items, client fine aggregates, and rule-driven operational Telegram summaries.

**Architecture:** Extend the existing `Lead`, dashboard, fines, and `BotNotificationJob` verticals instead of creating parallel subsystems. Mutations create audit rows and id-only notification jobs transactionally; the existing bot worker hydrates and delivers messages. Scheduled collectors enqueue idempotent jobs from persisted rental, fine, and telematics data.

**Tech Stack:** Next.js 16.2 App Router and Server Actions, React 19.2, TypeScript 5 strict mode, Prisma 6.16/PostgreSQL 17, Vitest 3, Python 3.12/aiogram 3 bot worker.

## Global Constraints

- Preserve all existing dirty-worktree changes and do not resume the paused RentRide integration.
- Keep every query and mutation tenant-scoped by `companyId` and permission.
- Store only entity IDs and non-sensitive event metadata in `BotNotificationJob.payload`.
- Use `Europe/Moscow` for business schedules and displayed times.
- Do not add a new runtime dependency.
- Every Prisma schema change requires an additive migration.
- Follow TDD: failing targeted test, minimal implementation, targeted green test, then regression.
- Production deployment and `prisma migrate deploy` require a separate backup and explicit owner approval.

---

### Task 1: Extend the lead data contract

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260907090000_add_lead_follow_up/migration.sql`
- Modify: `src/database/prisma/schema.test.ts`
- Modify: `src/modules/leads/types.ts`
- Modify: `src/modules/leads/validation.test.ts`
- Modify: `src/modules/leads/validation.ts`

**Interfaces:**
- Produces: `Lead.lastName: string | null`, `Lead.nextContactAt: Date | null`.
- Produces: `LeadInput.lastName` and `LeadInput.nextContactAt` with optional validated values.

- [ ] **Step 1: Write failing schema and validation tests**

```ts
expect(schema).toMatch(/lastName\s+String\?/u);
expect(schema).toMatch(/nextContactAt\s+DateTime\?\s+@db\.Timestamptz\(3\)/u);
expect(parseLeadInput(formData)).toMatchObject({
  ok: true,
  data: { lastName: '', nextContactAt: null },
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/database/prisma/schema.test.ts src/modules/leads/validation.test.ts`

Expected: FAIL because the schema and parsed lead data do not expose the new fields.

- [ ] **Step 3: Add schema, migration, types, and parsing**

```prisma
lastName     String?
nextContactAt DateTime? @db.Timestamptz(3)

@@index([companyId, status, nextContactAt])
```

```ts
const nextContactRaw = value(formData, 'nextContactAt');
const nextContactAt = nextContactRaw ? new Date(nextContactRaw) : null;
if (nextContactAt && Number.isNaN(nextContactAt.valueOf())) {
  fieldErrors.nextContactAt = 'Укажите корректные дату и время.';
}
```

- [ ] **Step 4: Run targeted tests**

Run: `npx vitest run src/database/prisma/schema.test.ts src/modules/leads/validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the vertical**

```powershell
git add src/database/prisma/schema.prisma src/database/prisma/migrations/20260907090000_add_lead_follow_up src/database/prisma/schema.test.ts src/modules/leads/types.ts src/modules/leads/validation.ts src/modules/leads/validation.test.ts
git commit -m "feat: schedule lead follow-ups"
```

### Task 2: Add transactional lead events and two-channel notification jobs

**Files:**
- Create: `src/modules/leads/notification-jobs.ts`
- Create: `src/modules/leads/notification-jobs.test.ts`
- Modify: `src/modules/leads/actions.ts`
- Create: `src/modules/leads/actions.test.ts`

**Interfaces:**
- Produces: `buildLeadNotificationRows(event, recipients, now): Prisma.BotNotificationJobCreateManyInput[]`.
- Consumes: active `TelegramGroupBinding` and the active staff `TelegramIdentity` belonging to `boundByUserId`.

- [ ] **Step 1: Write failing notification-row and action tests**

```ts
expect(buildLeadNotificationRows(event, recipients, now)).toEqual([
  expect.objectContaining({ template: 'LEAD_CREATED', chatId: '-100777' }),
  expect.objectContaining({ template: 'LEAD_CREATED', identityId: 'identity-owner' }),
]);
expect(JSON.stringify(rows)).not.toMatch(/phone|comment|firstName|lastName/iu);
```

Also assert that selecting the current status performs no update, audit, or enqueue.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/leads/notification-jobs.test.ts src/modules/leads/actions.test.ts`

Expected: FAIL because no event builder or atomic enqueue exists.

- [ ] **Step 3: Implement id-only rows and atomic mutations**

```ts
export type LeadNotificationEvent = {
  companyId: string;
  leadId: string;
  auditId: string;
  template: 'LEAD_CREATED' | 'LEAD_STATUS_CHANGED';
};
```

Use one Prisma transaction for lead mutation, audit creation, recipient lookup, and `createMany({ skipDuplicates: true })`. Build event keys from `leadId` for creation and `auditId` for status changes.

- [ ] **Step 4: Run targeted tests**

Run: `npx vitest run src/modules/leads/notification-jobs.test.ts src/modules/leads/actions.test.ts`

Expected: PASS, including no-op and tenant-boundary cases.

- [ ] **Step 5: Commit the vertical**

```powershell
git add src/modules/leads/notification-jobs.ts src/modules/leads/notification-jobs.test.ts src/modules/leads/actions.ts src/modules/leads/actions.test.ts
git commit -m "feat: notify staff about lead changes"
```

### Task 3: Hydrate safe Telegram lead messages

**Files:**
- Create: `src/modules/bot-api/lead-notifications.ts`
- Create: `src/modules/bot-api/lead-notifications.test.ts`
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`

**Interfaces:**
- Produces: `formatLeadCreatedMessage(input): string` and `formatLeadStatusChangedMessage(input): string`.
- Produces: `hydrateJob` branches for `LEAD_CREATED` and `LEAD_STATUS_CHANGED` returning `{ message, parseMode: 'HTML' }`.

- [ ] **Step 1: Write failing formatter and hydration tests**

```ts
expect(formatLeadStatusChangedMessage(input)).toContain('Новая → Связались');
expect(formatLeadCreatedMessage({ ...input, lastName: null })).toContain('Время не назначено');
expect(message).not.toContain('<script>');
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/bot-api/lead-notifications.test.ts src/modules/bot-api/notifications.test.ts`

Expected: FAIL because the templates are not hydrated.

- [ ] **Step 3: Implement formatters and hydration**

```ts
export const LEAD_STATUS_LABELS = {
  NEW: 'Новая', CONTACTED: 'Связались', QUALIFIED: 'Подтверждена',
  BOOKED: 'Перешла в аренду', LOST: 'Неактуальна',
} as const;
```

Load the lead and audit actor by `companyId` plus ID, decrypt the phone only in memory, format Moscow time, and return safe Telegram HTML.

- [ ] **Step 4: Run targeted tests**

Run: `npx vitest run src/modules/bot-api/lead-notifications.test.ts src/modules/bot-api/notifications.test.ts bot/tests/test_notifications.py`

Expected: PASS.

- [ ] **Step 5: Commit the vertical**

```powershell
git add src/modules/bot-api/lead-notifications.ts src/modules/bot-api/lead-notifications.test.ts src/modules/bot-api/notifications.ts src/modules/bot-api/notifications.test.ts
git commit -m "feat: format lead bot notifications"
```

### Task 4: Update the leads UI and query DTO

**Files:**
- Modify: `src/modules/leads/types.ts`
- Modify: `src/modules/leads/queries.ts`
- Create: `src/modules/leads/queries.test.ts`
- Modify: `src/modules/leads/components/LeadCreateForm.tsx`
- Modify: `src/modules/leads/components/LeadsPage.tsx`
- Create: `src/modules/leads/components/LeadsPage.test.tsx`

**Interfaces:**
- Produces: `LeadItem.lastName`, `LeadItem.nextContactAt`, and `LeadItem.createdAt`.

- [ ] **Step 1: Write failing DTO and rendered-form tests**

```ts
expect(item).toMatchObject({ lastName: 'Петров', nextContactAt: '2026-09-07T12:00:00.000Z' });
expect(screen.getByLabelText('Фамилия')).not.toHaveAttribute('required');
expect(screen.getByRole('option', { name: 'Авито' })).toBeTruthy();
expect(screen.getByRole('option', { name: 'ВКонтакте' })).toBeTruthy();
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/leads/queries.test.ts src/modules/leads/components/LeadsPage.test.tsx`

Expected: FAIL because the fields and options are absent.

- [ ] **Step 3: Implement fields and presentation**

```tsx
<Input label="Фамилия" name="lastName" autoComplete="family-name" />
<Input label="Следующий контакт" name="nextContactAt" type="datetime-local" />
<option>Авито</option>
<option>ВКонтакте</option>
```

Show the full name and either the formatted follow-up time or `Время не назначено`.

- [ ] **Step 4: Run targeted tests**

Run: `npx vitest run src/modules/leads`

Expected: PASS.

- [ ] **Step 5: Commit the vertical**

```powershell
git add src/modules/leads
git commit -m "feat: enrich lead intake"
```

### Task 5: Add leads to the prioritized workday queue

**Files:**
- Modify: `src/modules/dashboard/overview-types.ts`
- Modify: `src/modules/dashboard/server/queries.ts`
- Modify: `src/modules/dashboard/server/queries.test.ts`
- Modify: `src/modules/dashboard/normalizers.ts`
- Modify: `src/modules/dashboard/normalizers.test.ts`
- Modify: `src/modules/dashboard/WorkdayBoard.tsx`
- Modify: `src/modules/dashboard/CommandCenterDashboard.test.tsx`

**Interfaces:**
- Produces: `DashboardWorkItemKind` value `LEAD` and optional `unscheduled: boolean`.
- Consumes: active tenant-scoped leads and permission-gated decrypted phone.

- [ ] **Step 1: Write failing query, ordering, and UI tests**

```ts
expect(result.workItems.map(({ id }) => id)).toEqual([
  'lead:overdue', 'manual-task:scheduled', 'lead:scheduled', 'lead:unscheduled',
]);
expect(result.workItems.at(-1)).toMatchObject({ kind: 'LEAD', unscheduled: true });
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/dashboard/server/queries.test.ts src/modules/dashboard/normalizers.test.ts src/modules/dashboard/CommandCenterDashboard.test.tsx`

Expected: FAIL because leads are not a dashboard source.

- [ ] **Step 3: Query and normalize active leads**

```ts
type LeadSource = {
  id: string; name: string; lastName: string | null; source: string | null;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED'; nextContactAt: Date | null;
  createdAt: Date; phone: string | null; assignedToName: string | null;
};
```

Sort with `overdue` first, then scheduled items, then `unscheduled`, with ISO time and ID tie-breakers. Display `Время не назначено` instead of formatting `createdAt` as an appointment.

- [ ] **Step 4: Run targeted tests**

Run: `npx vitest run src/modules/dashboard`

Expected: PASS.

- [ ] **Step 5: Commit the vertical**

```powershell
git add src/modules/dashboard
git commit -m "feat: add leads to workday queue"
```

### Task 6: Aggregate client fines and render the columns

**Files:**
- Modify: `src/modules/clients/types.ts`
- Modify: `src/modules/clients/server/queries.ts`
- Modify: `src/modules/clients/server/queries.test.ts`
- Modify: `src/modules/clients/components/ClientGrid.tsx`
- Modify: `src/modules/clients/components/ClientGrid.test.tsx`
- Modify: `src/modules/clients/components/ClientCard.tsx`
- Modify: `src/modules/clients/components/ClientCard.test.tsx`

**Interfaces:**
- Produces: `ClientCardDto.fineSummary: { count: number; paidAmountMinor: string }`.

- [ ] **Step 1: Write failing aggregation and rendering tests**

```ts
expect(result.items[0]?.fineSummary).toEqual({ count: 3, paidAmountMinor: '1250000' });
expect(markup).toContain('Штрафы');
expect(markup).toContain('Оплачено');
expect(markup).toContain('12 500 ₽');
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/clients/server/queries.test.ts src/modules/clients/components/ClientGrid.test.tsx src/modules/clients/components/ClientCard.test.tsx`

Expected: FAIL because no fine summary is returned.

- [ ] **Step 3: Add page-bounded tenant aggregation**

```ts
type FineAggregateRow = { clientId: string | null; status: FineStatus; currentAmountMinor: bigint };
```

After selecting the page, query non-cancelled fines only for `{ companyId, clientId: { in: pageIds } }`, count rows, and sum `currentAmountMinor` only when `status === 'PAID'`. Render `0` and `0 ₽` for no rows.

- [ ] **Step 4: Run targeted tests**

Run: `npx vitest run src/modules/clients`

Expected: PASS.

- [ ] **Step 5: Commit the vertical**

```powershell
git add src/modules/clients
git commit -m "feat: show client fine totals"
```

### Task 7: Expand the daily digest and scheduled collectors

**Files:**
- Modify: `src/modules/bot-api/operations-digest.ts`
- Modify: `src/modules/bot-api/operations-digest.test.ts`
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`
- Create: `src/modules/bot-api/operational-alerts.ts`
- Create: `src/modules/bot-api/operational-alerts.test.ts`
- Modify: `src/app/api/bot/v1/notifications/claim/route.ts`
- Modify: `src/app/api/bot/v1/notifications/claim/route.test.ts`

**Interfaces:**
- Produces: `enqueueOperationalAlerts(now, database)` for 15-minute rules.
- Produces: enriched `OperationsDigestInput` with yesterday totals, fleet status, recent fines, leads, categorized offline vehicles, API health, and weekly section.

- [ ] **Step 1: Write failing threshold, deduplication, and digest tests**

```ts
expect(classifyGpsLoss({ rented: true, offlineMs: hours(5) })).toBeNull();
expect(classifyGpsLoss({ rented: true, offlineMs: hours(20) })).toBe('RENTAL_WARNING');
expect(classifyGpsLoss({ rented: true, offlineMs: hours(49) })).toBe('THEFT_RISK');
expect(classifyGpsLoss({ rented: false, offlineMs: hours(49) })).toBe('TRACKER_PROBLEM');
```

Assert 2-hour return reminders, overdue escalation, speed over 130 km/h, geofence events, Monday weekly block, and explicit fine API failure copy.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/bot-api/operational-alerts.test.ts src/modules/bot-api/operations-digest.test.ts src/modules/bot-api/notifications.test.ts src/app/api/bot/v1/notifications/claim/route.test.ts`

Expected: FAIL because the collectors and enriched digest do not exist.

- [ ] **Step 3: Implement rule-based collectors and digest**

```ts
export type GpsLossLevel = 'RENTAL_WARNING' | 'RENTAL_CRITICAL' | 'THEFT_RISK' | 'TRACKER_PROBLEM';
export function classifyGpsLoss(input: { rented: boolean; offlineMs: number }): GpsLossLevel | null;
export async function enqueueOperationalAlerts(now: Date, database = prisma): Promise<number>;
```

Use persisted positions, rentals, vehicle events, fine synchronization status, and deterministic recommendations. Give each threshold its own stable event key. Keep one vehicle in one digest category.

- [ ] **Step 4: Run targeted tests**

Run: `npx vitest run src/modules/bot-api src/app/api/bot/v1/notifications/claim/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the vertical**

```powershell
git add src/modules/bot-api src/app/api/bot/v1/notifications/claim
git commit -m "feat: add operational bot alerts"
```

### Task 8: Verify migrations, application, and bot

**Files:**
- Modify: `docs/runbooks/telegram-bot.md`
- Modify: `.env.example` only if the scheduler needs a new explicit interval setting.

**Interfaces:**
- Produces: an operator runbook for 08:00 daily runs, 15-minute alerts, 3-hour fine sync, delivery diagnostics, and rollback.

- [ ] **Step 1: Document exact production schedules and checks**

```text
08:00 Europe/Moscow — daily digest; Monday includes the weekly section.
*/15 minutes — GPS, speed, geofence and overdue-rental collectors.
0 */3 hours — fine synchronization and new-fine notifications.
```

- [ ] **Step 2: Validate Prisma and generated types**

Run: `npx prisma format && npx prisma validate && npx prisma generate`

Expected: all commands exit 0.

- [ ] **Step 3: Run focused and complete verification**

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm run test:unit`

Run: `python -m pytest bot/tests`

Run: `npm run build`

Expected: all commands exit 0; no test depends on production credentials or mutates production data.

- [ ] **Step 4: Review the resulting diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intended files are changed or newly created in addition to the pre-existing dirty worktree.

- [ ] **Step 5: Commit runbook changes**

```powershell
git add docs/runbooks/telegram-bot.md .env.example
git commit -m "docs: operate lead and fleet alerts"
```

Deployment remains a separate action: back up PostgreSQL, deploy the verified commit, apply the additive migration, restart the application and bot, then verify one test lead reaches both recipients.
