# Lease-to-Own Payment Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Отправлять клиенту и рабочей группе идемпотентные уведомления в 09:00 МСК за день до каждого неоплаченного платежа активной аренды с правом выкупа.

**Architecture:** Новый модуль отвечает за московское окно запуска, безопасный разбор `snapshot.paymentSchedule`, постановку двух заданий без персональных данных и форматирование единого сообщения. Существующий claim-обработчик получает актуальные данные аренды перед отправкой, а существующий API запускает новый сборщик рядом с остальными планировщиками.

**Tech Stack:** TypeScript, Next.js 16.2 Route Handlers, Prisma 6.16, Vitest 3, существующая очередь `BotNotificationJob`.

## Global Constraints

- Использовать только название Supa Pro / СУПА ПРО.
- Источник даты и суммы — `snapshot.paymentSchedule`; отсутствующие данные не выдумывать.
- Окно запуска — 09:00–09:14 МСК за день до платежа.
- Обрабатывать только `ACTIVE` + `LEASE_TO_OWN`; платежи `PAID` пропускать.
- В очереди не хранить расшифрованные персональные данные.
- Клиентское уведомление не должно блокировать уведомление рабочей группе.
- Формат сообщения должен совпадать с утверждёнными блоками Telegram Supa Pro.

---

### Task 1: Планировщик и формат сообщения

**Files:**
- Create: `src/modules/bot-api/lease-payment-reminders.ts`
- Test: `src/modules/bot-api/lease-payment-reminders.test.ts`

**Interfaces:**
- Consumes: `Prisma.BotNotificationJobCreateManyInput`, `formatTelegramMessage`, `telegramSection`.
- Produces: `enqueueLeasePaymentReminders(now: Date, database?: LeasePaymentReminderDatabase): Promise<number>`, `findDueLeasePayment(snapshot: unknown, tomorrowDate: string): LeasePayment | null`, `formatLeasePaymentReminderMessage(input: LeasePaymentReminderMessageInput): string`.

- [ ] **Step 1: Write failing tests for time, recipients, schedule, idempotency data and copy**

```ts
it('queues staff and client reminders at 09:00 MSK one day before payment', async () => {
  await enqueueLeasePaymentReminders(new Date('2026-12-02T06:05:00Z'), database as never);
  expect(createMany).toHaveBeenCalledWith({
    data: expect.arrayContaining([
      expect.objectContaining({ template: 'LEASE_TO_OWN_PAYMENT_STAFF' }),
      expect.objectContaining({ template: 'LEASE_TO_OWN_PAYMENT_CLIENT' }),
    ]),
    skipDuplicates: true,
  });
});

it('formats the approved Supa Pro payment reminder blocks', () => {
  expect(formatLeasePaymentReminderMessage(input)).toContain('⏰ <b>Завтра платёж по аренде с выкупом</b>');
  expect(formatLeasePaymentReminderMessage(input)).toContain('🚗 <b>Авто</b>');
  expect(formatLeasePaymentReminderMessage(input)).toContain('⚡ <b>Действие</b>');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/modules/bot-api/lease-payment-reminders.test.ts`

Expected: FAIL because the module and exports do not exist.

- [ ] **Step 3: Implement the minimal scheduler and pure formatter**

```ts
export async function enqueueLeasePaymentReminders(now: Date, database = prisma) {
  if (!isMoscowReminderWindow(now)) return 0;
  const tomorrow = moscowDateKey(new Date(now.getTime() + DAY_MS));
  // Read bindings, active client identities and active LEASE_TO_OWN rentals.
  // Parse only validated paymentSchedule rows and create id-only staff/client jobs.
  return (await database.botNotificationJob.createMany({ data: rows, skipDuplicates: true })).count;
}
```

The staff event key is `lease-payment:<companyId>:<rentalId>:<number>:<dueDate>:staff`; the client key ends with `:client`. Payload contains only `rentalId`, `paymentNumber`, and `dueDate`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run src/modules/bot-api/lease-payment-reminders.test.ts`

Expected: PASS for the 09:00 window, paid/non-lease exclusions, two recipients, missing identity, event keys and message copy.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/modules/bot-api/lease-payment-reminders.ts src/modules/bot-api/lease-payment-reminders.test.ts
git commit -m "feat: queue lease payment reminders"
```

### Task 2: Claim-time rendering, routing and API integration

**Files:**
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notification-routing.ts`
- Modify: `src/modules/bot-api/notification-routing.test.ts`
- Modify: `src/app/api/bot/v1/notifications/claim/route.ts`
- Modify: `src/app/api/bot/v1/notifications/claim/route.test.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`

**Interfaces:**
- Consumes: `enqueueLeasePaymentReminders`, `findLeasePaymentByIdentity`, `formatLeasePaymentReminderMessage` from Task 1.
- Produces: routable templates `LEASE_TO_OWN_PAYMENT_STAFF` and `LEASE_TO_OWN_PAYMENT_CLIENT`, dynamically rendered payloads with current rental data.

- [ ] **Step 1: Write failing integration tests**

```ts
expect(notificationDestination(clientPaymentJob, null)).toBe('123');
expect(notificationDestination(staffPaymentJob, '-100777')).toBe('-100777');
expect(paymentCollector).toHaveBeenCalledOnce();
expect(claimed.payload.message).toContain('💰 <b>Платёж</b>');
expect(claimed.payload.actions).toEqual([
  expect.objectContaining({ type: 'contract_url', label: '📄 Открыть договор' }),
]);
```

- [ ] **Step 2: Run integration tests and verify RED**

Run: `npx vitest run src/modules/bot-api/notification-routing.test.ts src/app/api/bot/v1/notifications/claim/route.test.ts src/modules/bot-api/notifications.test.ts`

Expected: FAIL because the new templates are not routed, collected, or rendered.

- [ ] **Step 3: Add template routing and claim-time rendering**

```ts
const customerTemplates = new Set([
  'RENTAL_RETURN_CLIENT',
  'CLIENT_RENTAL_LIFECYCLE',
  'CLIENT_IMPOUND_ALERT',
  'CLIENT_GPS_EVENT',
  'LEASE_TO_OWN_PAYMENT_CLIENT',
]);

const internalTemplates = new Set([
  // existing templates
  'LEASE_TO_OWN_PAYMENT_STAFF',
]);
```

At claim time, re-read the active lease-to-own rental, verify `paymentNumber` and `dueDate` still resolve to an unpaid schedule row, decrypt the phone only for the staff message, and return `null` for stale jobs. Client payload uses `clientMenu: true`; staff payload includes a `contract_url` action.

- [ ] **Step 4: Invoke the collector from the claim route**

```ts
await Promise.allSettled([
  enqueueReturnReminders(now),
  enqueueDailyOperationsDigests(now),
  enqueueLeasePaymentReminders(now),
  enqueueOperationalAlerts(now),
  syncDueCompanyFines(now),
]);
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run src/modules/bot-api/lease-payment-reminders.test.ts src/modules/bot-api/notification-routing.test.ts src/app/api/bot/v1/notifications/claim/route.test.ts src/modules/bot-api/notifications.test.ts`

Expected: PASS.

- [ ] **Step 6: Run project validation**

Run: `npm run typecheck`

Run: `npm run lint -- src/modules/bot-api/lease-payment-reminders.ts src/modules/bot-api/lease-payment-reminders.test.ts src/modules/bot-api/notifications.ts src/modules/bot-api/notification-routing.ts src/app/api/bot/v1/notifications/claim/route.ts`

Run: `git diff --check`

Expected: all commands succeed; unrelated existing worktree changes remain untouched.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/modules/bot-api/lease-payment-reminders.ts src/modules/bot-api/lease-payment-reminders.test.ts src/modules/bot-api/notifications.ts src/modules/bot-api/notifications.test.ts src/modules/bot-api/notification-routing.ts src/modules/bot-api/notification-routing.test.ts src/app/api/bot/v1/notifications/claim/route.ts src/app/api/bot/v1/notifications/claim/route.test.ts
git commit -m "feat: deliver lease payment reminders"
```

### Task 3: Production delivery and canary verification

**Files:**
- Modify in deployment artifact only: current Supa Pro release containing the tested source changes.

**Interfaces:**
- Consumes: passing Task 1 and Task 2 tests.
- Produces: production reminder jobs generated by the existing bot claim cycle.

- [ ] **Step 1: Build the application**

Run: `npm run build`

Expected: production build succeeds.

- [ ] **Step 2: Deploy through the existing Supa Pro release process**

Use the current immutable release/slot workflow; do not edit compiled production assets in place.

- [ ] **Step 3: Verify the live service and idempotency**

Check `/login` returns HTTP 200, the web and bot services are active, and a dry scheduler run at a controlled clock creates at most one staff and one client event key for the same due payment.

- [ ] **Step 4: Record completion**

Report the deployed release, focused test result, build result, live HTTP result, and whether the current BMW 3 payment has a future reminder date of 02.12.2026 at 09:00 МСК.
