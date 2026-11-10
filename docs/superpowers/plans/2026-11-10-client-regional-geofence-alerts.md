# Client Regional Geofence Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Отправлять авторизованному клиенту немедленное предупреждение о подтверждённом выезде из разрешённой территории и повторное предупреждение через час, только пока машина остаётся вне зоны.

**Architecture:** Существующий региональный GPS-evaluator возвращает контекст подтверждённого события в GLONASSSoft pipeline. Новый узкий модуль создаёт две идемпотентные задачи в существующей `BotNotificationJob`; hydration немедленной задачи подтверждает исходное событие, а часовой задачи дополнительно проверяет актуальные аренду, версию и состояние `OUTSIDE`. Отдельный scheduler и новая таблица не нужны.

**Tech Stack:** TypeScript, Next.js 16 server modules, Prisma 6, PostgreSQL/PostGIS, Vitest, существующая очередь Telegram-уведомлений Supa Pro.

## Global Constraints

- Использовать существующую очередь `BotNotificationJob` и существующий GPS-поток.
- Получатель — только активная Telegram-привязка типа `CLIENT` той же компании и клиента аренды.
- Немедленное и часовое уведомления идемпотентны по `eventId`.
- Часовое уведомление не отправляется после возврата, завершения аренды, отключения или изменения версии геозоны.
- Ошибка чтения состояния не считается подтверждением нарушения и не должна отправлять сообщение.
- Новая миграция базы данных не требуется.

---

### Task 1: Очередь и тексты клиентских уведомлений

**Files:**
- Create: `src/modules/bot-api/client-regional-geofence-notifications.ts`
- Create: `src/modules/bot-api/client-regional-geofence-notifications.test.ts`

**Interfaces:**
- Produces: `queueClientRegionalGeofenceNotifications(input): Promise<{ immediateQueued: boolean; reminderQueued: boolean }>`.
- Produces: `formatClientRegionalGeofenceMessage(input): string`, где `stage` — `'IMMEDIATE' | 'ONE_HOUR'`.

- [ ] **Step 1: Write failing formatter and queue tests**

```ts
it('formats the immediate client warning with blocking risk', () => {
  const message = formatClientRegionalGeofenceMessage({
    stage: 'IMMEDIATE', vehicle: 'Toyota Camry', registrationNumber: 'Р957АН997',
  });
  expect(message).toContain('🚨 <b>Выезд за разрешённую территорию</b>');
  expect(message).toContain('Автомобиль может быть дистанционно заблокирован');
});

it('queues immediate and one-hour jobs for the active linked client', async () => {
  await queueClientRegionalGeofenceNotifications({
    companyId: 'company-1', vehicleId: 'vehicle-1', rentalId: 'rental-1',
    clientId: 'client-1', eventId: 'event-1', geofenceVersion: 3,
    recordedAt: new Date('2026-11-10T09:00:00Z'), prisma,
  });
  expect(createMany).toHaveBeenCalledWith({
    data: expect.arrayContaining([
      expect.objectContaining({ eventKey: 'regional-geofence:client:event-1:immediate' }),
      expect.objectContaining({
        eventKey: 'regional-geofence:client:event-1:one-hour',
        availableAt: new Date('2026-11-10T10:00:00Z'),
      }),
    ]),
    skipDuplicates: true,
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/bot-api/client-regional-geofence-notifications.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the focused module**

```ts
export async function queueClientRegionalGeofenceNotifications(input: QueueInput) {
  const identity = await input.prisma.telegramIdentity.findUnique({
    where: { companyId_clientId: { companyId: input.companyId, clientId: input.clientId } },
    select: { id: true, isActive: true },
  });
  if (!identity?.isActive) return { immediateQueued: false, reminderQueued: false };
  const payload = {
    vehicleId: input.vehicleId, rentalId: input.rentalId, clientId: input.clientId,
    eventId: input.eventId, geofenceVersion: input.geofenceVersion,
  };
  const result = await input.prisma.botNotificationJob.createMany({
    data: [
      { companyId: input.companyId, identityId: identity.id, chatId: null,
        eventKey: `regional-geofence:client:${input.eventId}:immediate`,
        template: 'CLIENT_REGIONAL_GEOFENCE_ALERT', payload: { ...payload, stage: 'IMMEDIATE' },
        availableAt: input.recordedAt },
      { companyId: input.companyId, identityId: identity.id, chatId: null,
        eventKey: `regional-geofence:client:${input.eventId}:one-hour`,
        template: 'CLIENT_REGIONAL_GEOFENCE_ALERT', payload: { ...payload, stage: 'ONE_HOUR' },
        availableAt: new Date(input.recordedAt.getTime() + 60 * 60_000) },
    ],
    skipDuplicates: true,
  });
  return { immediateQueued: result.count > 0, reminderQueued: result.count > 1 };
}
```

Formatter uses HTML escaping and exactly the approved blocks for both stages.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npx vitest run src/modules/bot-api/client-regional-geofence-notifications.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/bot-api/client-regional-geofence-notifications.ts src/modules/bot-api/client-regional-geofence-notifications.test.ts
git commit -m "feat: queue client regional geofence alerts"
```

### Task 2: Передача подтверждённого события из GPS-пайплайна

**Files:**
- Modify: `src/modules/regional-geofences/server/evaluate-position.ts`
- Modify: `src/modules/regional-geofences/server/evaluate-position.test.ts`
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.ts`
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.test.ts`

**Interfaces:**
- Consumes: `queueClientRegionalGeofenceNotifications` from Task 1.
- Produces: evaluator result `{ state, eventId, eventType, rentalId, clientId, geofenceVersion }`.

- [ ] **Step 1: Write failing evaluator and pipeline tests**

```ts
expect(result).toMatchObject({
  eventId: 'event-1', eventType: 'OUTSIDE', rentalId: 'rental-1',
  clientId: 'client-1', geofenceVersion: 3,
});
```

The sync test asserts that an `OUTSIDE` result queues the client jobs with the same company, vehicle, rental, client, event, version and recorded time; `APPROACHING`, `RETURNED` and `null` do not.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/regional-geofences/server/evaluate-position.test.ts src/modules/telematics/glonasssoft/sync-company.server.test.ts`

Expected: FAIL because notification context is absent.

- [ ] **Step 3: Implement the minimal integration**

```ts
return {
  state: transition.state,
  eventId: event.id,
  eventType: transition.event,
  rentalId: row.rentalId,
  clientId: row.clientId,
  geofenceVersion: row.version,
};
```

In `sync-company.server.ts`, retain the evaluator result and call `queueClientRegionalGeofenceNotifications` only for `eventType === 'OUTSIDE'`. Preserve the existing catch/log boundary so notification failures cannot stop GPS persistence.

- [ ] **Step 4: Run tests and verify GREEN**

Run the same Vitest command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/regional-geofences/server/evaluate-position.ts src/modules/regional-geofences/server/evaluate-position.test.ts src/modules/telematics/glonasssoft/sync-company.server.ts src/modules/telematics/glonasssoft/sync-company.server.test.ts
git commit -m "feat: enqueue client alerts on geofence exit"
```

### Task 3: Безопасная hydration и клиентская маршрутизация

**Files:**
- Modify: `src/modules/bot-api/notification-routing.ts`
- Modify: `src/modules/bot-api/notification-routing.test.ts`
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`

**Interfaces:**
- Consumes: template `CLIENT_REGIONAL_GEOFENCE_ALERT` and formatter from Task 1.
- Produces: sendable Telegram payload or `null`; `null` causes the existing claim flow to mark the job `CANCELLED`.

- [ ] **Step 1: Write failing routing and hydration tests**

```ts
expect(notificationDestination({
  ...customer, template: 'CLIENT_REGIONAL_GEOFENCE_ALERT'
}, null)).toBe('123');
```

Hydration tests prove: immediate + matching event sends; one-hour + `OUTSIDE` sends; `INSIDE`, `RETURNED`, version mismatch, disabled geofence and completed rental cancel.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/bot-api/notification-routing.test.ts src/modules/bot-api/notifications.test.ts`

Expected: FAIL because the template is not routed or hydrated.

- [ ] **Step 3: Implement routing and hydration**

Add `CLIENT_REGIONAL_GEOFENCE_ALERT` to `customerTemplates`. In `hydrateJob`, validate payload and query:

```ts
const rental = await tx.rental.findFirst({
  where: {
    id: rentalId, companyId: job.companyId, clientId, vehicleId,
    status: { in: ['CONFIRMED', 'ACTIVE'] },
  },
  select: {
    vehicle: { select: { make: true, modelName: true, model: true, registrationNumber: true } },
    regionalGeofence: { select: { enabled: true, version: true, state: true } },
  },
});
const event = await tx.vehicleEvent.findFirst({
  where: { id: eventId, vehicleId, rentalId, type: 'REGIONAL_GEOFENCE_OUTSIDE' },
  select: { id: true },
});
```

Return `null` unless event, active rental, enabled geofence and matching version are present. For `ONE_HOUR`, additionally require `state === 'OUTSIDE'`. Return approved formatter output with `parseMode: 'HTML'` and `clientMenu: true`.

- [ ] **Step 4: Run tests and verify GREEN**

Run the same Vitest command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/bot-api/notification-routing.ts src/modules/bot-api/notification-routing.test.ts src/modules/bot-api/notifications.ts src/modules/bot-api/notifications.test.ts
git commit -m "feat: deliver current client geofence warnings"
```

### Task 4: Regression verification

**Files:**
- Modify only if verification reveals a defect in the files above.

- [ ] **Step 1: Run focused tests**

```bash
npx vitest run src/modules/bot-api/client-regional-geofence-notifications.test.ts src/modules/bot-api/notification-routing.test.ts src/modules/bot-api/notifications.test.ts src/modules/regional-geofences/server/evaluate-position.test.ts src/modules/telematics/glonasssoft/sync-company.server.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run static checks**

```powershell
npm run typecheck
npx eslint src/modules/bot-api/client-regional-geofence-notifications.ts src/modules/bot-api/client-regional-geofence-notifications.test.ts src/modules/bot-api/notification-routing.ts src/modules/bot-api/notification-routing.test.ts src/modules/bot-api/notifications.ts src/modules/bot-api/notifications.test.ts src/modules/regional-geofences/server/evaluate-position.ts src/modules/regional-geofences/server/evaluate-position.test.ts src/modules/telematics/glonasssoft/sync-company.server.ts src/modules/telematics/glonasssoft/sync-company.server.test.ts
git diff --check
```

Expected: zero errors.

- [ ] **Step 3: Run production build with sufficient Node heap**

Run: `$env:NODE_OPTIONS='--max-old-space-size=3072'; npm run build`

Expected: build succeeds; the known existing NFT trace warning may remain.
