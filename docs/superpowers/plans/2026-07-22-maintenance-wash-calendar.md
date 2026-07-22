# Pilot+ Operations Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить общий адаптивный календарь записей ТО и мойки и сделать success-toast создания независимым от закрывающейся формы.

**Architecture:** Чистые функции строят московскую календарную модель без React и Prisma. Общий client-компонент отображает desktop month grid и mobile agenda, а доменные workspace преобразуют DTO в единый событийный контракт и синхронизируют `view`/`month` через query string.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Tailwind CSS v4, Framer Motion, Vitest, Playwright.

## Global Constraints

- Весь пользовательский текст и комментарии в исходном коде пишутся по-русски.
- Календарные дни и время вычисляются в `Europe/Moscow` через существующий business-time contract.
- Desktop показывает месячную сетку, mobile — повестку без горизонтальной прокрутки.
- Все интерактивные элементы имеют область не меньше 44×44 px.
- Статус всегда передаётся текстом и иконкой, не только цветом.
- Календарь не импортирует Prisma и не знает доменные enum ТО/мойки.
- Один успешный create response создаёт ровно один success-toast после закрытия формы.
- Существующие Server Actions, tenant authorization, роли и модели PostgreSQL не изменяются.

---

### Task 1: Чистая календарная модель Pilot+

**Files:**
- Create: `src/shared/components/operations-calendar/types.ts`
- Create: `src/shared/components/operations-calendar/calendar-model.ts`
- Create: `src/shared/components/operations-calendar/calendar-model.test.ts`
- Create: `src/shared/components/operations-calendar/index.ts`

**Interfaces:**
- Produces: `OperationsCalendarEvent`, `CalendarDay`, `parseCalendarMonth`, `buildCalendarMonth`, `groupCalendarEvents`.
- Consumes: `PILOT_BUSINESS_TIME_ZONE` and business date helpers from `src/shared/business-time.ts`.

- [ ] **Step 1: Write failing model tests**

```ts
it('строит полную сетку с понедельника по воскресенье', () => {
  const month = buildCalendarMonth('2026-07', new Date('2026-07-22T09:00:00Z'));
  expect(month.label).toBe('Июль 2026');
  expect(month.days).toHaveLength(35);
  expect(month.days[0]?.isoDate).toBe('2026-06-29');
  expect(month.days[34]?.isoDate).toBe('2026-08-02');
});

it('группирует московское событие в правильный день', () => {
  const groups = groupCalendarEvents([
    { id: '1', startsAt: '2026-07-21T21:30:00.000Z', title: 'ТО', vehicleLabel: 'PLT-1', statusLabel: 'Запланировано', tone: 'primary', icon: 'tool' },
  ]);
  expect(groups.get('2026-07-22')).toHaveLength(1);
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts`

Expected: FAIL because the model does not exist.

- [ ] **Step 3: Implement exact event and month contracts**

```ts
export interface OperationsCalendarEvent {
  id: string;
  startsAt: string;
  title: string;
  vehicleLabel: string;
  statusLabel: string;
  tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  icon: 'tool' | 'droplet';
}

export interface CalendarDay {
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  events: readonly OperationsCalendarEvent[];
}
```

`parseCalendarMonth` accepts only `/^\d{4}-(0[1-9]|1[0-2])$/`; invalid input falls back to the current Moscow month. `buildCalendarMonth` always starts Monday and ends Sunday.

- [ ] **Step 4: Run GREEN and commit**

Run: `npx vitest run src/shared/components/operations-calendar/calendar-model.test.ts`

Expected: PASS.

Commit: `feat: add operations calendar model`

---

### Task 2: Общий desktop/mobile календарь

**Files:**
- Create: `src/shared/components/operations-calendar/OperationsCalendar.tsx`
- Create: `src/shared/components/operations-calendar/OperationsCalendar.test.ts`
- Create: `src/shared/components/operations-calendar/CalendarEventDialog.tsx`
- Modify: `src/shared/components/operations-calendar/index.ts`

**Interfaces:**
- Consumes: `events`, `month`, `onMonthChange`, `onToday`, `onEventAction?`.
- Produces: `data-testid="operations-calendar-grid"`, `operations-calendar-agenda`, and accessible event dialogs.

- [ ] **Step 1: Write failing component contract tests**

```ts
it('показывает первые три записи и раскрывает остаток дня', () => {
  const html = renderToStaticMarkup(createElement(OperationsCalendar, propsWithFourEvents));
  expect(html).toContain('Ещё 1');
  expect(html).toContain('operations-calendar-grid');
});
```

```ts
it('публикует контракты сетки и мобильной повестки', () => {
  const html = renderToStaticMarkup(createElement(OperationsCalendar, props));
  expect(html).toContain('data-testid="operations-calendar-grid"');
  expect(html).toContain('data-testid="operations-calendar-agenda"');
  expect(html).toContain('Понедельник');
});
```

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/shared/components/operations-calendar/OperationsCalendar.test.ts`

- [ ] **Step 3: Implement responsive component**

Desktop uses `hidden md:grid` seven-column cells. Mobile uses `md:hidden` dated agenda sections. Month controls are `IconButton`/`Button`; event buttons use `min-h-11`, icon, status label and tone classes. Clicking an event opens shared `Modal` with date, vehicle, status and optional domain action slot. «Ещё N» expands only its day.

- [ ] **Step 4: Verify keyboard and reduced-motion behavior**

Use native buttons, existing focus styles and `motion` only when reduced motion is false. Unit rendering must contain accessible names «Предыдущий месяц», «Следующий месяц», «Сегодня».

- [ ] **Step 5: Run GREEN and commit**

Run: `npx vitest run src/shared/components/operations-calendar/OperationsCalendar.test.ts src/shared/components/operations-calendar/calendar-model.test.ts`

Commit: `feat: add responsive operations calendar`

---

### Task 3: Интеграция ТО, мойки и стабильного create-toast

**Files:**
- Create: `src/modules/maintenance/calendar.ts`
- Create: `src/modules/maintenance/calendar.test.ts`
- Create: `src/modules/wash/calendar.ts`
- Create: `src/modules/wash/calendar.test.ts`
- Modify: `src/modules/maintenance/components/MaintenanceWorkspace.tsx`
- Modify: `src/modules/maintenance/components/MaintenanceForm.tsx`
- Modify: `src/modules/wash/components/WashWorkspace.tsx`
- Modify: `src/modules/wash/components/WashForm.tsx`
- Modify: `tests/maintenance.spec.ts`
- Modify: `tests/wash.spec.ts`

**Interfaces:**
- Produces: `maintenanceToCalendarEvent(record)` and `washToCalendarEvent(record)`.
- Workspace owns `view`, `month`, create success toast and modal close lifecycle.

- [ ] **Step 1: Write failing mapper tests**

```ts
expect(maintenanceToCalendarEvent(record)).toMatchObject({
  id: record.id,
  icon: 'tool',
  statusLabel: 'Просрочено',
  vehicleLabel: 'PLT-001 · GWM WEY',
});
expect(washToCalendarEvent(wash)).toMatchObject({ icon: 'droplet', statusLabel: 'Запланировано' });
```

- [ ] **Step 2: Write Playwright RED for view/query/toast**

On both routes require:

```ts
await page.getByRole('tab', { name: 'Календарь' }).click();
await expect(page).toHaveURL(/view=calendar/);
await expect(page.getByTestId('operations-calendar-grid')).toBeVisible();
await page.reload();
await expect(page.getByRole('tab', { name: 'Календарь' })).toHaveAttribute('aria-selected', 'true');
```

Creation assertion must require the form dialog hidden and exactly one matching success toast.

- [ ] **Step 3: Implement query-backed mode and month**

Use `useRouter`, `usePathname`, `useSearchParams`. Preserve unrelated search params. Normalize to `view=list|calendar`; calendar navigation writes `month=YYYY-MM`. List mode retains all current filters/actions.

- [ ] **Step 4: Move create success ownership to workspace**

Forms call `onSuccess(message)` after a successful action and do not call success `showToast` themselves. Workspace callback performs, in order:

```ts
showToast({ tone: 'success', title: message });
setFormOpen(false);
```

Errors keep the form mounted and use inline `role="alert"`; one response cannot dispatch duplicate success toast.

- [ ] **Step 5: Integrate domain events and details**

Pass mapped records to `OperationsCalendar`. Calendar event details reuse existing status badges and domain action callbacks; actions still invoke the existing guarded Server Actions.

- [ ] **Step 6: Run focused verification and commit**

Run:

```powershell
npx vitest run src/modules/maintenance/calendar.test.ts src/modules/wash/calendar.test.ts src/shared/components/operations-calendar/calendar-model.test.ts src/shared/components/operations-calendar/OperationsCalendar.test.ts
npx playwright test tests/maintenance.spec.ts tests/wash.spec.ts --project=desktop --workers=1
npm run typecheck
npm run lint
```

Expected: all PASS; creation produces one success toast, calendar survives reload.

Commit: `feat: integrate maintenance and wash calendars`

---

### Task 4: Мобильная проверка, документация и объединение

**Files:**
- Modify: `tests/maintenance.spec.ts`
- Modify: `tests/wash.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`
- Modify: `README.md`

**Interfaces:**
- Verifies the completed public behavior and documents `view`/`month` URLs.

- [ ] **Step 1: Add mobile agenda acceptance checks**

At 390×844, calendar view must show `operations-calendar-agenda`, hide desktop grid, keep document and dialog `scrollWidth <= clientWidth`, expose 44 px event/month buttons, and open details by keyboard.

```ts
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('/maintenance?view=calendar');
await expect(page.getByTestId('operations-calendar-agenda')).toBeVisible();
await expect(page.getByTestId('operations-calendar-grid')).toBeHidden();
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
```

- [ ] **Step 2: Add month navigation acceptance checks**

Verify previous/next changes `month`, «Сегодня» restores current Moscow month, invalid `month` normalizes safely, and four events in one day expose «Ещё 1».

```ts
await page.getByRole('button', { name: 'Следующий месяц' }).click();
await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
await page.getByRole('button', { name: 'Сегодня' }).click();
await expect(page.getByText('Ещё 1')).toBeVisible();
```

- [ ] **Step 3: Update canonical documentation**

Document calendar routes, shared component boundaries, Moscow timezone, stable create-toast lifecycle and limitations (no drag-and-drop/week view/external sync).

Add exact guide bullets for `?view=calendar&month=YYYY-MM`, `OperationsCalendarEvent`, `Europe/Moscow`, workspace-owned create toast, and the four excluded capabilities.

- [ ] **Step 4: Run final regression**

Run:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npx playwright test tests/dashboard.spec.ts tests/vehicles.spec.ts tests/maintenance.spec.ts tests/wash.spec.ts --project=desktop --workers=1
npm run build
git diff --check
```

Expected: zero errors, all tests pass, build includes `/maintenance` and `/wash`.

- [ ] **Step 5: Commit documentation**

Commit: `docs: document maintenance and wash calendars`

- [ ] **Step 6: Finish branch**

After independent final review is READY, merge `codex/vehicle-fleet-toasts` into local `main`, rerun unit tests on merged result, then remove the owned worktree and feature branch only after merge verification succeeds.
