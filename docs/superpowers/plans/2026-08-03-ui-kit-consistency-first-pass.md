# Pilot+ UI-kit Consistency First Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привести общую оболочку, профиль, состояние системы и операционные календари Pilot+ к единому контракту `/ui-kit`, добавив рабочие уведомления, аватар пользователя и проверку API.

**Architecture:** Общие визуальные правила закрепляются небольшими компонентами `PageHeader`, `Avatar` и `NotificationCenter`. Доменные данные остаются в модулях: уведомления имеют отдельный типизированный fixture-источник, health checker возвращает четыре независимых результата, а ТО и мойка преобразуют PostgreSQL DTO в существующий общий формат календаря.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Tailwind CSS 4, CSS variables Pilot+, React Icons, Vitest, Testing Library, Playwright.

## Global Constraints

- Перед изменением Next.js-кода прочитать релевантные материалы из `node_modules/next/dist/docs/`.
- Не добавлять новые npm-зависимости.
- Весь пользовательский текст и комментарии в коде писать на русском языке.
- `/ui-kit` и семантические CSS variables Pilot+ являются источником визуальных правил.
- Touch target интерактивных элементов — не меньше 44 пикселей.
- Не смешивать fixtures уведомлений с живыми MQTT-данными и явно обозначить демонстрационный источник.
- Не добавлять загрузку пользовательского фото или Prisma-поле аватара на этом этапе.
- Существующие `debug.log`, `dev-server.err.log` и `dev-server.out.log` не добавлять в коммиты и не изменять.

---

## Карта файлов

- Create `src/shared/ui/PageHeader.tsx` — единый заголовок продуктовой страницы.
- Modify `src/shared/ui/index.ts` — экспорт `PageHeader`.
- Modify `src/shared/ui/DataDisplay.tsx` — `Avatar` с необязательным `src` и безопасным fallback на инициалы.
- Modify `src/shared/ui/DataDisplay.test.ts` — тесты инициалов и fallback.
- Create `src/modules/notifications/types.ts` — контракт уведомления.
- Create `src/modules/notifications/fixtures.ts` — явно демонстрационные уведомления.
- Create `src/modules/notifications/NotificationCenter.tsx` — кнопка, badge, popover и состояние прочтения.
- Create `src/modules/notifications/NotificationCenter.test.tsx` — unit/component-проверки.
- Modify `src/shared/components/app-shell/Header.tsx` — подключение уведомлений и реальных данных пользователя.
- Create `src/shared/components/app-shell/Header.test.tsx` — проверка композиции header.
- Modify `src/modules/profile/ProfilePage.tsx` — общий `PageHeader` и карточка личности.
- Create `src/app/(protected)/profile/loading.tsx` — skeleton геометрии профиля.
- Modify `tests/profile.spec.ts` — browser-проверка профиля и аватара.
- Modify `src/modules/system-health/types.ts` — ключ `api`.
- Modify `src/modules/system-health/get-system-health.ts` — четвёртая независимая probe.
- Modify `src/modules/system-health/get-system-health.test.ts` — параллельность, таймаут и частичный отказ четырёх probes.
- Modify `src/modules/system-health/SystemHealthPage.tsx` — `PageHeader`, иконка API и адаптивная сетка.
- Create `src/app/(protected)/system/loading.tsx` — skeleton четырёх health-карточек.
- Modify `tests/system-health.spec.ts` — четыре карточки и отсутствие обрезания PostgreSQL.
- Modify `src/shared/components/operations-calendar/OperationsCalendar.tsx` — компактная полоска события и неизменный overflow.
- Modify `src/shared/components/operations-calendar/OperationsCalendar.test.ts` — содержимое полосок и «Ещё N».
- Modify `src/modules/maintenance/calendar.test.ts` и `src/modules/wash/calendar.test.ts` — короткая подпись автомобиля и тип операции.
- Modify `tests/maintenance.spec.ts` и `tests/wash.spec.ts` — видимые записи в днях.
- Modify `src/app/(protected)/ui-kit/sections.tsx` — витрина утверждённых `PageHeader`, `Avatar` и уведомлений.
- Modify `tests/ui-kit.spec.ts` — наличие контрактных примеров.
- Modify `docs/PROJECT_GUIDE.md` — зафиксировать выполненный проход.

### Task 1: Закрепить общую типографику и аватар

**Files:**
- Create: `src/shared/ui/PageHeader.tsx`
- Modify: `src/shared/ui/DataDisplay.tsx`
- Modify: `src/shared/ui/DataDisplay.test.ts`
- Modify: `src/shared/ui/index.ts`

**Interfaces:**
- Produces: `PageHeader(props: PageHeaderProps)`, где `eyebrow?: ReactNode`, `title: string`, `description?: ReactNode`, `actions?: ReactNode`, `titleId?: string`.
- Produces: `Avatar({ name, src?, size?, className? })` с размерами `xs | sm | md | lg` и fallback на инициалы.

- [ ] **Step 1: Написать падающие тесты `Avatar`**

Добавить в `DataDisplay.test.ts` проверки:

```tsx
it('строит не более двух инициалов из имени', () => {
  render(<Avatar name="Павел Александрович Седов" />);
  expect(screen.getByRole('img', { name: 'Павел Александрович Седов' })).toHaveTextContent('ПА');
});

it('после ошибки фотографии показывает инициалы', () => {
  render(<Avatar name="Павел Седов" src="/missing.webp" />);
  fireEvent.error(screen.getByRole('img', { name: 'Павел Седов' }));
  expect(screen.getByRole('img', { name: 'Павел Седов' })).toHaveTextContent('ПС');
});
```

- [ ] **Step 2: Запустить тест и подтвердить падение**

Run: `npx vitest run src/shared/ui/DataDisplay.test.ts`

Expected: FAIL, потому что `Avatar` ещё не принимает `src` и не переключает fallback.

- [ ] **Step 3: Реализовать `Avatar` и `PageHeader`**

`Avatar` должен хранить только локальный флаг ошибки изображения:

```tsx
export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof avatarSizes;
  className?: string;
}

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = getInitials(name);

  return (
    <span role="img" aria-label={name} className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)] ${avatarSizes[size]} ${className}`}>
      {src && !imageFailed ? (
        <Image src={src} alt="" fill sizes="56px" className="object-cover" onError={() => setImageFailed(true)} />
      ) : initials}
    </span>
  );
}
```

`PageHeader.tsx`:

```tsx
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
}

export function PageHeader({ eyebrow, title, description, actions, titleId }: PageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="text-xs font-semibold tracking-[0.14em] text-[var(--color-primary)] uppercase">{eyebrow}</div> : null}
        <h1 id={titleId} className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">{title}</h1>
        {description ? <div className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">{description}</div> : null}
      </div>
      {actions ? <div className="flex min-h-11 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
```

Экспортировать оба интерфейса через `src/shared/ui/index.ts`.

- [ ] **Step 4: Запустить тесты и проверки типов**

Run: `npx vitest run src/shared/ui/DataDisplay.test.ts && npm run typecheck`

Expected: PASS; TypeScript не сообщает ошибок.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/ui/PageHeader.tsx src/shared/ui/DataDisplay.tsx src/shared/ui/DataDisplay.test.ts src/shared/ui/index.ts
git commit -m "feat: standardize page headers and avatars"
```

### Task 2: Добавить рабочий центр уведомлений в шапку

**Files:**
- Create: `src/modules/notifications/types.ts`
- Create: `src/modules/notifications/fixtures.ts`
- Create: `src/modules/notifications/NotificationCenter.tsx`
- Create: `src/modules/notifications/NotificationCenter.test.tsx`
- Modify: `src/shared/components/app-shell/Header.tsx`
- Create: `src/shared/components/app-shell/Header.test.tsx`

**Interfaces:**
- Produces: `PilotNotification` с `id`, `title`, `description`, `createdAt`, `tone`, `href`.
- Produces: `NotificationCenter({ notifications })` с локальным множеством прочитанных id.
- Consumes: `Avatar` из Task 1 и существующие `IconButton`, `Badge`, `DropdownMenu`.

- [ ] **Step 1: Написать падающие component-тесты**

```tsx
it('показывает число непрочитанных и открывает список', async () => {
  render(<NotificationCenter notifications={demoNotifications} />);
  expect(screen.getByText('3')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Уведомления: 3 непрочитанных' }));
  expect(screen.getByRole('dialog', { name: 'Уведомления' })).toBeVisible();
});

it('помечает все уведомления прочитанными', async () => {
  render(<NotificationCenter notifications={demoNotifications} />);
  await user.click(screen.getByRole('button', { name: /Уведомления/ }));
  await user.click(screen.getByRole('button', { name: 'Отметить всё прочитанным' }));
  expect(screen.queryByTestId('notification-count')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Запустить тест и подтвердить падение**

Run: `npx vitest run src/modules/notifications/NotificationCenter.test.tsx`

Expected: FAIL с отсутствующим модулем `NotificationCenter`.

- [ ] **Step 3: Создать тип и fixture-источник**

```ts
export type NotificationTone = 'success' | 'warning' | 'danger' | 'info';

export interface PilotNotification {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  tone: NotificationTone;
  href: string;
}
```

`fixtures.ts` экспортирует `demoNotifications` с русскими текстами и ссылками только на существующие маршруты `/events`, `/maintenance`, `/devices` и `/vehicles`. Комментарий над массивом явно говорит, что это демонстрационные данные до подключения серверной модели уведомлений.

- [ ] **Step 4: Реализовать `NotificationCenter`**

Компонент использует кнопку `IconButton`, абсолютный badge, доступный popover с `role="dialog"`, ссылки Next.js и четыре семантических tone-класса. Он закрывается по `Esc`, клику вне панели и после перехода. Кнопка очистки меняет локальное множество прочитанных id; данные не записываются в БД.

Ключевой публичный контракт:

```tsx
export function NotificationCenter({ notifications }: { notifications: readonly PilotNotification[] }) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const unreadCount = notifications.filter((item) => !readIds.has(item.id)).length;
  // render IconButton + badge + responsive dialog
}
```

- [ ] **Step 5: Подключить центр и фактического пользователя в `Header`**

Заменить одиночный `FiBell` на:

```tsx
<NotificationCenter notifications={demoNotifications} />
```

Заменить `FiUser` в trigger на `<Avatar name={user.name} size="sm" />`, а статичные строки меню на:

```tsx
<p className="truncate text-sm font-semibold">{user.name}</p>
<p className="truncate text-xs text-[var(--color-text-secondary)]">{user.email}</p>
```

Добавить ссылку «Открыть профиль» на `/profile`; logout остаётся server action.

- [ ] **Step 6: Запустить component-тесты**

Run: `npx vitest run src/modules/notifications/NotificationCenter.test.tsx src/shared/components/app-shell/Header.test.tsx`

Expected: PASS, включая `Esc`, outside click, реальные имя/email и отсутствие статичной строки «Управление Pilot+».

- [ ] **Step 7: Commit**

```powershell
git add src/modules/notifications src/shared/components/app-shell/Header.tsx src/shared/components/app-shell/Header.test.tsx
git commit -m "feat: add header notification center"
```

### Task 3: Привести профиль к общему шаблону

**Files:**
- Modify: `src/modules/profile/ProfilePage.tsx`
- Create: `src/app/(protected)/profile/loading.tsx`
- Modify: `tests/profile.spec.ts`

**Interfaces:**
- Consumes: `PageHeader` и `Avatar` из Task 1, `SafeUser` из auth.
- Produces: карточка личности без изменения auth actions и Prisma schema.

- [ ] **Step 1: Добавить падающую browser-проверку**

```ts
await page.goto('/profile');
await expect(page.getByRole('heading', { name: 'Профиль администратора' })).toBeVisible();
await expect(page.getByRole('img', { name: 'Павел Седов' })).toContainText('ПС');
await expect(page.getByText('sedoffwork@mail.ru')).toBeVisible();
```

- [ ] **Step 2: Запустить проверку и подтвердить падение**

Run: `npx playwright test tests/profile.spec.ts --workers=1`

Expected: FAIL на отсутствии аватара в контенте профиля.

- [ ] **Step 3: Обновить `ProfilePage`**

Использовать:

```tsx
<PageHeader
  eyebrow="Учётная запись"
  title="Профиль администратора"
  titleId="profile-page-title"
  description="Управляйте личными данными и безопасностью учётной записи Pilot+."
/>
<Card className="flex min-w-0 items-center gap-4 p-4 sm:p-5">
  <Avatar name={session.user.name} size="lg" />
  <div className="min-w-0">
    <p className="truncate font-bold text-[var(--color-text)]">{session.user.name}</p>
    <p className="truncate text-sm text-[var(--color-text-secondary)]">{session.user.email}</p>
    <Badge tone="primary" className="mt-2">Администратор</Badge>
  </div>
</Card>
```

Не менять `ProfileForms`, валидацию пароля или server actions.

- [ ] **Step 4: Добавить профильный skeleton**

`loading.tsx` использует только `Card` и `Skeleton` и резервирует геометрию заголовка, identity card и двух форм:

```tsx
export default function ProfileLoading() {
  return (
    <section aria-label="Загрузка профиля" className="grid min-w-0 gap-5 p-4 sm:p-6">
      <div className="grid gap-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-9 w-72 max-w-full" /><Skeleton className="h-5 w-[32rem] max-w-full" /></div>
      <Card className="flex items-center gap-4 p-5"><Skeleton className="size-14 rounded-full" /><div className="grid flex-1 gap-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-56 max-w-full" /></div></Card>
      <Card className="grid gap-4 p-5"><Skeleton className="h-6 w-32" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-40" /></Card>
    </section>
  );
}
```

- [ ] **Step 5: Запустить профильные проверки**

Run: `npx vitest run src/modules/profile && npx playwright test tests/profile.spec.ts --workers=1`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/profile/ProfilePage.tsx src/app/(protected)/profile/loading.tsx tests/profile.spec.ts
git commit -m "feat: add profile identity card"
```

### Task 4: Добавить независимую проверку API Pilot+

**Files:**
- Modify: `src/modules/system-health/types.ts`
- Modify: `src/modules/system-health/get-system-health.ts`
- Modify: `src/modules/system-health/get-system-health.test.ts`
- Modify: `src/modules/system-health/SystemHealthPage.tsx`
- Create: `src/app/(protected)/system/loading.tsx`
- Modify: `tests/system-health.spec.ts`

**Interfaces:**
- `ServiceHealth.key` расширяется до `'api' | 'postgresql' | 'redis' | 'mqtt'`.
- `createSystemHealthChecker` принимает `checkApplication: () => Promise<ServiceHealthStatus>`.
- Возвращаемый порядок: API Pilot+, PostgreSQL, Redis, MQTT.

- [ ] **Step 1: Обновить unit-тесты до четырёх probes**

В каждый вызов `createSystemHealthChecker` добавить `checkApplication`. Основная проверка:

```ts
expect(services.map(({ key, status }) => ({ key, status }))).toEqual([
  { key: 'api', status: 'healthy' },
  { key: 'postgresql', status: 'healthy' },
  { key: 'redis', status: 'unavailable' },
  { key: 'mqtt', status: 'unconfigured' },
]);
```

Добавить отдельный тест: rejected `checkApplication` даёт только `api: unavailable`, а остальные три результата сохраняются.

- [ ] **Step 2: Запустить unit-тест и подтвердить падение**

Run: `npx vitest run src/modules/system-health/get-system-health.test.ts`

Expected: FAIL, потому что ключ `api` и dependency отсутствуют.

- [ ] **Step 3: Реализовать application probe**

```ts
async function checkApplication(): Promise<ServiceHealthStatus> {
  const startedAt = Date.now();
  try {
    const response = Response.json({ status: 'ok' });
    if (!response.ok) throw new Error('Не удалось сформировать ответ API.');
    return { status: 'healthy', latencyMs: Math.max(0, Date.now() - startedAt), checkedAt: new Date().toISOString() };
  } catch {
    return { status: 'unavailable', latencyMs: Math.max(0, Date.now() - startedAt), checkedAt: new Date().toISOString() };
  }
}
```

Запустить application probe в том же `Promise.all` и под тем же общим дедлайном. Не выполнять HTTP-запрос к `/system` и не раскрывать текст исключения.

- [ ] **Step 4: Обновить страницу состояния**

Добавить `api: FiActivity` в `serviceIcons`, заменить локальный header на `PageHeader` и изменить сетку:

```tsx
<section aria-label="Состояние сервисов" className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
```

В `CardHeader` разрешить перенос и убрать `truncate` у названия:

```tsx
<CardHeader className="flex min-w-0 flex-wrap items-center gap-3">
  <div className="flex min-w-0 flex-1 items-center gap-3">
    ...
    <h2 className="min-w-0 break-words text-base font-bold">{service.label}</h2>
  </div>
  <Badge className="shrink-0">...</Badge>
</CardHeader>
```

- [ ] **Step 5: Добавить browser-проверку**

```ts
await expect(page.getByTestId('service-health-card')).toHaveCount(4);
await expect(page.getByRole('heading', { name: 'API Pilot+' })).toBeVisible();
await expect(page.getByRole('heading', { name: 'PostgreSQL' })).toBeVisible();
```

На viewport 1024×768 проверить, что bounding box заголовка PostgreSQL находится внутри bounding box карточки.

- [ ] **Step 6: Добавить skeleton состояния системы**

```tsx
export default function SystemLoading() {
  return (
    <section aria-label="Проверка состояния системы" className="grid min-w-0 gap-5 p-4 sm:p-6">
      <div className="grid gap-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-9 w-72 max-w-full" /><Skeleton className="h-5 w-[36rem] max-w-full" /></div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Card key={index} className="grid gap-4 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-5 w-36" /><Skeleton className="h-16 w-full" /></Card>)}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Запустить health-проверки**

Run: `npx vitest run src/modules/system-health && npx playwright test tests/system-health.spec.ts --workers=1`

Expected: PASS; четыре независимых результата.

- [ ] **Step 8: Commit**

```powershell
git add src/modules/system-health src/app/(protected)/system/loading.tsx tests/system-health.spec.ts
git commit -m "feat: report Pilot API health"
```

### Task 5: Уплотнить календарные записи ТО и мойки

**Files:**
- Modify: `src/shared/components/operations-calendar/OperationsCalendar.tsx`
- Modify: `src/shared/components/operations-calendar/OperationsCalendar.test.ts`
- Modify: `src/modules/maintenance/calendar.test.ts`
- Modify: `src/modules/wash/calendar.test.ts`
- Modify: `tests/maintenance.spec.ts`
- Modify: `tests/wash.spec.ts`

**Interfaces:**
- Не менять `OperationsCalendarEvent` и доменные DTO.
- `EventButton` продолжает передавать выбранное событие в существующий `CalendarEventDialog`.
- Первые три записи видны; четвёртая и последующие доступны через «Ещё N».

- [ ] **Step 1: Уточнить падающие unit-тесты полосы события**

```tsx
expect(screen.getByTestId('operations-calendar-event')).toHaveTextContent('09:30');
expect(screen.getByTestId('operations-calendar-event')).toHaveTextContent('А 123 МР 77');
expect(screen.getByTestId('operations-calendar-event')).toHaveTextContent('Плановое ТО');
expect(screen.getByRole('button', { name: 'Ещё 1' })).toBeVisible();
```

Тест должен также подтвердить, что статус доступен через `aria-label`, даже если визуально вынесен из основной строки.

- [ ] **Step 2: Запустить unit-тест и подтвердить текущее расхождение**

Run: `npx vitest run src/shared/components/operations-calendar/OperationsCalendar.test.ts`

Expected: FAIL на новом `data-testid` или компактной структуре.

- [ ] **Step 3: Сделать запись компактной цветной полосой**

`EventButton` получает `data-testid="operations-calendar-event"`, высоту `min-h-11`, левую цветовую границу и две строки: первая — время и операция, вторая — автомобиль. Статус остаётся в доступной подписи и диалоге.

```tsx
className={`min-h-11 w-full min-w-0 cursor-pointer rounded-[var(--radius-sm)] border border-l-4 px-2 py-1.5 text-left text-xs ... ${eventToneClasses[event.tone]}`}
```

Внутри:

```tsx
<span className="flex min-w-0 items-center gap-1.5 font-semibold">
  <time className="shrink-0 tabular-nums">{formatCalendarEventTime(event)}</time>
  <span className="truncate">{event.title}</span>
</span>
<span data-testid="operations-calendar-event-vehicle" className="block truncate text-[var(--color-text-secondary)]">
  {event.vehicleLabel}
</span>
```

- [ ] **Step 4: Проверить доменные преобразователи**

В тестах maintenance/wash зафиксировать, что `title` содержит тип операции, а `vehicleLabel` приоритетно содержит внутренний номер, модель и госномер, не подменяя отсутствующие значения.

- [ ] **Step 5: Добавить browser-проверки календарей**

После создания реальной тестовой записи через существующие helpers открыть соответствующий месяц и проверить:

```ts
const event = page.getByTestId('operations-calendar-event').filter({ hasText: registrationNumber });
await expect(event).toBeVisible();
await expect(event).toContainText(operationLabel);
```

Тестовые записи удаляются существующим helper teardown; production seed не изменяется.

- [ ] **Step 6: Запустить календарные проверки**

Run: `npx vitest run src/shared/components/operations-calendar src/modules/maintenance/calendar.test.ts src/modules/wash/calendar.test.ts && npx playwright test tests/maintenance.spec.ts tests/wash.spec.ts --workers=1`

Expected: PASS на desktop-grid и mobile-agenda.

- [ ] **Step 7: Commit**

```powershell
git add src/shared/components/operations-calendar src/modules/maintenance/calendar.test.ts src/modules/wash/calendar.test.ts tests/maintenance.spec.ts tests/wash.spec.ts
git commit -m "fix: unify operation calendar event strips"
```

### Task 6: Обновить UI-kit и провести финальную регрессию

**Files:**
- Modify: `src/app/(protected)/ui-kit/sections.tsx`
- Modify: `tests/ui-kit.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`

**Interfaces:**
- `/ui-kit` показывает именно production-компоненты, а не копии их Tailwind-классов.
- Документация отличает демонстрационные уведомления от реальных событий.

- [ ] **Step 1: Добавить падающую проверку UI-kit**

```ts
await expect(page.getByRole('heading', { name: 'Заголовок страницы' })).toBeVisible();
await expect(page.getByText('Аватары и профиль')).toBeVisible();
await expect(page.getByText('Центр уведомлений')).toBeVisible();
```

- [ ] **Step 2: Запустить UI-kit test и подтвердить падение**

Run: `npx playwright test tests/ui-kit.spec.ts --workers=1`

Expected: FAIL на новых контрактных примерах.

- [ ] **Step 3: Добавить production-компоненты в витрину**

В `sections.tsx` импортировать и отрисовать `PageHeader`, `Avatar` и `NotificationCenter` с `demoNotifications`. Не копировать внутренние классы компонентов в демонстрацию. Существующие секции кнопок, badge и skeleton не удалять.

- [ ] **Step 4: Обновить проектный гид**

В раздел «Что работает» добавить:

```markdown
- первый системный проход унификации по `/ui-kit`: общий заголовок страницы, единый аватар, рабочая панель демонстрационных уведомлений, карточка API Pilot+ и компактные записи календарей ТО/мойки;
```

В раздел демонстрационных данных явно добавить, что состояние прочтения уведомлений хранится только в текущей клиентской сессии.

- [ ] **Step 5: Выполнить форматирование и статические проверки**

Run: `npm run format:check && npm run lint && npm run typecheck`

Expected: все команды завершаются с exit code 0.

- [ ] **Step 6: Выполнить unit regression**

Run: `npm run test:unit`

Expected: все тесты PASS.

- [ ] **Step 7: Выполнить последовательный browser regression**

Run: `npx playwright test tests/auth.spec.ts tests/system-states.spec.ts tests/profile.spec.ts tests/system-health.spec.ts tests/dashboard.spec.ts tests/ui-kit.spec.ts tests/vehicles.spec.ts tests/maintenance.spec.ts tests/wash.spec.ts tests/devices.spec.ts --workers=1`

Expected: все тесты PASS; credentialed auth-проверка не пропущена.

- [ ] **Step 8: Проверить production build**

Run: `npm run build`

Expected: Next.js production build завершается с exit code 0.

- [ ] **Step 9: Визуально проверить desktop и mobile**

Открыть `/`, `/profile`, `/system`, `/maintenance?view=calendar`, `/wash?view=calendar`, `/ui-kit` на ширинах 1440, 1024 и 390 пикселей. Подтвердить:

- одинаковую геометрию `PageHeader`;
- одинаковую высоту соседних кнопок;
- отсутствие горизонтального overflow;
- полное название PostgreSQL;
- доступность панели уведомлений;
- видимые полосы записей календаря и рабочий `Ещё N`;
- skeleton без layout shift на маршрутах с серверными данными.

- [ ] **Step 10: Commit**

```powershell
git add src/app/(protected)/ui-kit/sections.tsx tests/ui-kit.spec.ts docs/PROJECT_GUIDE.md
git commit -m "docs: establish ui kit as product contract"
```
