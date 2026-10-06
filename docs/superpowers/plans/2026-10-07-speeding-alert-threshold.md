# Speeding Alert Threshold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Отправлять Telegram-уведомление при первом достижении 145 км/ч и не повторять его, пока скорость не опустится ниже порога.

**Architecture:** Логика остаётся в синхронизации последних позиций ГЛОНАСССОФТ. Новая позиция сравнивается с последней сохранённой позицией автомобиля: событие `SPEEDING` создаётся при первой позиции 145+ или при переходе с менее 145 на 145+, а непрерывная серия 145+ не создаёт повторных событий. Существующий конвейер `VehicleEvent` → `BotNotificationJob` → Telegram не изменяется.

**Tech Stack:** TypeScript 5, Prisma 6, Vitest 3, GLONASSSoft integration, Telegram notification jobs.

## Global Constraints

- Порог равен 145 км/ч включительно.
- Первая известная позиция со скоростью 145+ должна создать событие.
- Повторное событие разрешается только после сохранённой позиции ниже 145 км/ч.
- Повторная provider-позиция не должна создавать событие.
- Не менять формат доставки Telegram, права доступа и другие типы событий.
- Не добавлять зависимости и не менять Prisma schema.

---

### Task 1: Порог и защита от повторных уведомлений

**Files:**
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.ts:250-264`
- Test: `src/modules/telematics/glonasssoft/sync-company.server.test.ts:139-169`

**Interfaces:**
- Consumes: последняя позиция `previous` с полем `speedKph: number | null` и текущая точка `point.speedKph: number`.
- Produces: `VehicleEvent` типа `SPEEDING` только при пересечении константы `SPEEDING_ALERT_THRESHOLD_KPH = 145`.

- [ ] **Step 1: Заменить старый параметризованный тест граничными сценариями**

Добавить вспомогательную функцию внутри тестового файла, которая запускает одну синхронизацию с заданными текущей и предыдущей скоростями:

```ts
async function syncSpeed(currentSpeedKph: number, previousSpeedKph: number | null) {
  const prisma = database();
  const vehicleEvent = { createMany: vi.fn().mockResolvedValue({ count: 1 }) };
  const transaction = {
    vehiclePosition: {
      findFirst: vi.fn().mockResolvedValue(
        previousSpeedKph === null
          ? null
          : {
              latitude: 55.74,
              longitude: 37.6,
              speedKph: previousSpeedKph,
              recordedAt: new Date('2026-08-20T08:59:00Z'),
            },
      ),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    vehicleEvent,
  };
  prisma.$transaction.mockImplementation((callback) => callback(transaction));
  await syncCompanyLatestPositions('company-a', {
    prisma,
    createClient: vi.fn(() => ({
      getLastData: vi.fn().mockResolvedValue([
        {
          externalId: '42',
          receivedAt: '2026-08-20T09:00:30Z',
          recordedAt: '2026-08-20T09:00:00Z',
          state: 4,
          latitude: 55.75,
          longitude: 37.61,
          speedKph: currentSpeedKph,
          odometerKm: 1,
          fuelPercent: 50,
        },
      ]),
    })),
    decrypt: vi.fn((value: string) => value),
  });
  return vehicleEvent;
}
```

Добавить тесты:

```ts
it('не создаёт предупреждение ниже 145 км/ч', async () => {
  expect((await syncSpeed(144, 120)).createMany).not.toHaveBeenCalled();
});

it('создаёт предупреждение при достижении 145 км/ч', async () => {
  const vehicleEvent = await syncSpeed(145, 144);
  expect(vehicleEvent.createMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        type: 'SPEEDING',
        severity: 'DANGER',
        title: 'Скорость 145 км/ч',
        description: 'Зафиксирована скорость 145 км/ч или выше.',
        externalId: expect.stringContaining('speeding-145'),
      }),
    ],
    skipDuplicates: true,
  });
});

it('не пропускает первую позицию со скоростью 145 км/ч или выше', async () => {
  expect((await syncSpeed(151, null)).createMany).toHaveBeenCalledTimes(1);
});

it('не повторяет предупреждение при непрерывном превышении', async () => {
  expect((await syncSpeed(150, 145)).createMany).not.toHaveBeenCalled();
});

it('снова предупреждает после снижения скорости ниже порога', async () => {
  expect((await syncSpeed(146, 120)).createMany).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Запустить тест и подтвердить ожидаемое падение**

Run:

```powershell
npx vitest run src/modules/telematics/glonasssoft/sync-company.server.test.ts
```

Expected: новые тесты падают, потому что текущая реализация создаёт события от 130 км/ч и повторяет их для последовательных точек 145+.

- [ ] **Step 3: Реализовать минимальную проверку пересечения порога**

В `sync-company.server.ts` рядом с типами добавить:

```ts
const SPEEDING_ALERT_THRESHOLD_KPH = 145;
```

Заменить условие создания события:

```ts
const previousSpeedKph = previous?.speedKph ?? null;
const crossedSpeedingThreshold =
  point.speedKph >= SPEEDING_ALERT_THRESHOLD_KPH &&
  (previousSpeedKph === null || previousSpeedKph < SPEEDING_ALERT_THRESHOLD_KPH);

if (crossedSpeedingThreshold) {
  await database.vehicleEvent?.createMany({
    data: [
      {
        vehicleId,
        type: 'SPEEDING',
        severity: 'DANGER',
        title: `Скорость ${Math.round(point.speedKph)} км/ч`,
        description: `Зафиксирована скорость ${SPEEDING_ALERT_THRESHOLD_KPH} км/ч или выше.`,
        location: point.address,
        recordedAt,
        provider: 'GLONASSSOFT',
        externalId: `${externalId}:speeding-${SPEEDING_ALERT_THRESHOLD_KPH}`,
      },
    ],
    skipDuplicates: true,
  });
}
```

- [ ] **Step 4: Запустить целевой тест**

Run:

```powershell
npx vitest run src/modules/telematics/glonasssoft/sync-company.server.test.ts
```

Expected: весь файл тестов проходит.

- [ ] **Step 5: Запустить проверки изменённого TypeScript-кода**

Run:

```powershell
npm run typecheck
npm run lint
```

Expected: обе команды завершаются с кодом 0 без новых ошибок.

- [ ] **Step 6: Проверить diff и зафиксировать изменение**

Run:

```powershell
git diff --check
git diff -- src/modules/telematics/glonasssoft/sync-company.server.ts src/modules/telematics/glonasssoft/sync-company.server.test.ts
git add src/modules/telematics/glonasssoft/sync-company.server.ts src/modules/telematics/glonasssoft/sync-company.server.test.ts
git commit -m "fix: notify speeding only when crossing 145 kph"
```

Expected: diff содержит только порог, защиту от повторов и соответствующие тесты.
