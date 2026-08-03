# Map and Calendar Layout Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить обрезание элементов управления онлайн-картой и сделать автомобиль, работу и статус полностью читаемыми внутри календарей ТО и мойки.

**Architecture:** Исправления остаются в существующих компонентах: container-query компоновка карты меняет только геометрию панелей, а общий `OperationsCalendar` получает более читаемую карточку события без доменного дублирования. Адаптеры ТО и мойки продолжают формировать единый `OperationsCalendarEvent` и добавляют безопасный fallback подписи автомобиля.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, MapLibre GL, Vitest, Testing Library, Playwright.

## Global Constraints

- Все пользовательские тексты и комментарии остаются на русском языке.
- Не добавлять runtime-зависимости.
- Карта остаётся главным содержимым рабочего пространства.
- Интерактивные цели остаются не меньше `44×44 px`.
- Desktop controls: до `36rem`; desktop vehicle panel: `25rem` (`400 px`).
- Контрольные размеры: `390×844`, `768×1024`, `1280×720`, `1440×900`.
- Мобильный календарь остаётся повесткой, desktop — сеткой из семи колонок.
- ТО и мойка используют общий `OperationsCalendar`.
- Новые фиктивные production-записи не добавляются.
- Локальные логи `debug.log`, `dev-server.err.log`, `dev-server.out.log` не изменять и не коммитить.

---

## File Map

- Modify `src/modules/online-map/components/OnlineMapWorkspace.tsx` — ширина controls и правой панели.
- Modify `src/modules/online-map/components/SelectedVehiclePanel.tsx` — геометрия playback.
- Modify `src/modules/online-map/components/OnlineFleetMap.tsx` — MapLibre controls и fit padding.
- Modify `src/shared/components/operations-calendar/OperationsCalendar.tsx` — карточка события и высота дня.
- Modify `src/modules/maintenance/calendar.ts`, `src/modules/wash/calendar.ts` — fallback автомобиля.
- Modify соответствующие unit/component/E2E тесты и `docs/PROJECT_GUIDE.md`.

### Task 1: Исправить геометрию онлайн-карты

**Files:**
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Modify: `src/modules/online-map/components/SelectedVehiclePanel.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMap.tsx`
- Test: `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`
- Test: `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

**Interfaces:**
- Consumes: container query `@min-[48rem]`, `--sidebar-width`, selected vehicle state.
- Produces: `data-testid="selected-vehicle-panel"` и обновлённый `getTrackFitOptions(containerWidth, containerHeight)`.

- [ ] **Step 1: Написать падающие component-тесты**

```tsx
it('резервирует непересекающиеся desktop-зоны поиска и карточки', async () => {
  render(<OnlineMapWorkspace mapComponent={MapProbe} />);
  await user.click(screen.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }));

  expect(screen.getByTestId('online-map-controls').className).toContain('36rem');
  expect(screen.getByTestId('selected-vehicle-panel').className).toContain('w-[25rem]');
});
```

В cleanup-тесте ожидать desktop right padding не меньше `416` px.

- [ ] **Step 2: Подтвердить RED**

Run:

```powershell
npx vitest run src/modules/online-map/components/OnlineMapWorkspace.test.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
```

Expected: FAIL — controls содержат `25rem`, панель `w-80`, padding рассчитан под старые `20rem`.

- [ ] **Step 3: Реализовать единую геометрию**

В `OnlineMapWorkspace.tsx`:

```tsx
className="absolute top-3 right-3 left-3 z-20 grid gap-2 @min-[48rem]:right-auto @min-[48rem]:left-4 @min-[48rem]:w-[min(36rem,calc(100%-27rem))]"
```

Для панели:

В существующий `className` панели добавить desktop-модификатор
`@min-[48rem]:w-[25rem]`, заменив текущий `@min-[48rem]:w-80`; остальные классы сохранить.

В `SelectedVehiclePanel.tsx` заменить desktop right offset playback на `26rem`, а доступную ширину — на `calc(100vw - var(--sidebar-width) - 29rem)`.

В `OnlineFleetMap.tsx`:

```ts
export function getTrackFitOptions(containerWidth: number, containerHeight: number) {
  const desktop = containerWidth >= 768;
  return {
    padding: desktop
      ? { top: 72, right: 416, bottom: 88, left: 32 }
      : { top: 144, right: 24, bottom: Math.round(containerHeight * 0.48) + 24, left: 24 },
  };
}
```

MapLibre navigation controls на desktop получают right offset `26rem`.

- [ ] **Step 4: Подтвердить GREEN**

Run focused command из Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/online-map/components/OnlineMapWorkspace.tsx src/modules/online-map/components/SelectedVehiclePanel.tsx src/modules/online-map/components/OnlineFleetMap.tsx src/modules/online-map/components/OnlineMapWorkspace.test.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
git commit -m "fix: widen online map controls and vehicle panel"
```

### Task 2: Сделать записи календарей читаемыми

**Files:**
- Modify: `src/shared/components/operations-calendar/OperationsCalendar.tsx`
- Modify: `src/shared/components/operations-calendar/OperationsCalendar.test.ts`
- Modify: `src/modules/maintenance/calendar.ts`
- Modify: `src/modules/maintenance/calendar.test.ts`
- Modify: `src/modules/wash/calendar.ts`
- Modify: `src/modules/wash/calendar.test.ts`

**Interfaces:**
- Consumes: `OperationsCalendarEvent.vehicleLabel`, `statusLabel`, `title`, `startsAt`.
- Produces: полная подпись автомобиля либо `Автомобиль не указан`.

- [ ] **Step 1: Написать падающие тесты**

```tsx
it('показывает время, работу, автомобиль и статус отдельными строками', () => {
  render(createElement(OperationsCalendar, createCalendarProps()));
  const event = within(screen.getByTestId('operations-calendar-grid')).getByRole('button', {
    name: 'Среда, 22 июля 2026 г., 09:30, Замена масла, 128 · GWM WEY · А 123 МР 77, статус: Запланировано',
  });

  expect(within(event).getByTestId('operations-calendar-event-vehicle').textContent).toContain(
    '128 · GWM WEY · А 123 МР 77',
  );
});
```

Адаптеры:

```ts
expect(adapter({
  ...record,
  vehicle: { internalNumber: null, model: '', registrationNumber: null },
}).vehicleLabel).toBe('Автомобиль не указан');
```

- [ ] **Step 2: Подтвердить RED**

```powershell
npx vitest run src/shared/components/operations-calendar/OperationsCalendar.test.ts src/modules/maintenance/calendar.test.ts src/modules/wash/calendar.test.ts
```

Expected: FAIL — нет test-id строки автомобиля и fallback.

- [ ] **Step 3: Реализовать карточку события**

```tsx
<span className="grid min-w-0 gap-1">
  <span className="flex min-w-0 items-center gap-1.5 font-semibold">
    <CalendarEventIcon icon={event.icon} />
    <time className="shrink-0 tabular-nums">{formatCalendarEventTime(event)}</time>
    <span className="line-clamp-2">{event.title}</span>
  </span>
  <span
    data-testid="operations-calendar-event-vehicle"
    className="line-clamp-2 leading-4 text-[var(--color-text-secondary)]"
  >
    {event.vehicleLabel}
  </span>
  <span data-testid="operations-calendar-event-status" className="font-medium">
    {event.statusLabel}
  </span>
</span>
```

Gridcell: `min-h-44` вместо `min-h-36`. Лимит трёх событий и «Ещё N» не менять.

В адаптерах:

```ts
const vehicleLabel = [internalNumber, model, registrationNumber]
  .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  .join(' · ');

return vehicleLabel || 'Автомобиль не указан';
```

- [ ] **Step 4: Подтвердить GREEN**

Run focused command из Step 2. Expected: PASS для desktop grid, mobile agenda и «Ещё N».

- [ ] **Step 5: Commit**

```powershell
git add src/shared/components/operations-calendar/OperationsCalendar.tsx src/shared/components/operations-calendar/OperationsCalendar.test.ts src/modules/maintenance/calendar.ts src/modules/maintenance/calendar.test.ts src/modules/wash/calendar.ts src/modules/wash/calendar.test.ts
git commit -m "fix: show vehicle details in operations calendars"
```

### Task 3: Responsive E2E и финальная проверка

**Files:**
- Modify: `tests/online-map.spec.ts`
- Modify: `tests/maintenance.spec.ts`
- Modify: `tests/wash.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`

**Interfaces:**
- Consumes: UI-контракты Tasks 1–2.
- Produces: браузерная защита от повторного обрезания и актуальный handoff.

- [ ] **Step 1: Добавить E2E карты**

```ts
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
]) {
  await page.setViewportSize(viewport);
  await page.goto('/map');
  await page.getByRole('button', { name: 'Выбрать автомобиль А 123 МР 77' }).click();

  const overlap = await page.evaluate(() => {
    const controls = document.querySelector('[data-testid="online-map-controls"]')!.getBoundingClientRect();
    const panel = document.querySelector('[data-testid="selected-vehicle-panel"]')!.getBoundingClientRect();
    return controls.right > panel.left;
  });
  expect(overlap).toBe(false);
}
```

Проверить четыре filter buttons и отсутствие overflow на `390×844`.

- [ ] **Step 2: Добавить E2E календарей**

Для `/maintenance?view=calendar` и `/wash?view=calendar` использовать тестовую запись текущего месяца:

```ts
await expect(page.getByTestId('operations-calendar-event-vehicle')).toContainText('А 123 МР 77');
await expect(page.getByTestId('operations-calendar-event-status')).toBeVisible();
```

Повторить для mobile agenda и проверить отсутствие overflow.

- [ ] **Step 3: Запустить Playwright**

```powershell
npx playwright test tests/online-map.spec.ts tests/maintenance.spec.ts tests/wash.spec.ts --workers=1
```

Expected: PASS; допускаются только заранее обозначенные project skips.

- [ ] **Step 4: Обновить гид**

```md
- Панели онлайн-карты имеют адаптивные непересекающиеся desktop-зоны: controls до 36rem,
  карточка автомобиля 25rem.
- Календари ТО и мойки показывают время, работу, автомобиль и статус непосредственно в дне,
  сохраняя мобильную повестку и раскрытие «Ещё N».
```

- [ ] **Step 5: Полная проверка**

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run build
npx prettier --check src/modules/online-map/components/OnlineMapWorkspace.tsx src/modules/online-map/components/SelectedVehiclePanel.tsx src/modules/online-map/components/OnlineFleetMap.tsx src/shared/components/operations-calendar/OperationsCalendar.tsx src/modules/maintenance/calendar.ts src/modules/wash/calendar.ts tests/online-map.spec.ts tests/maintenance.spec.ts tests/wash.spec.ts docs/PROJECT_GUIDE.md
git diff --check
```

Expected: все команды завершаются с кодом `0`.

- [ ] **Step 6: Commit**

```powershell
git add tests/online-map.spec.ts tests/maintenance.spec.ts tests/wash.spec.ts docs/PROJECT_GUIDE.md
git commit -m "test: verify map and calendar layout fixes"
```
