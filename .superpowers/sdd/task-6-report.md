# Task 6 — Адаптивная страница истории событий

## Результат

- Добавлен защищённый маршрут `/events`: серверная страница ожидает Next 16 `searchParams`,
  безопасно приводит URL-параметры к `TimelineFilters` и получает данные только через
  `getEventTimeline`.
- Страница использует существующие Pilot+ primitives: четыре `StatCard`, `Card`, `Badge`,
  `Button`, `Modal`, `BottomSheet`, `Skeleton` и глобальные toast-уведомления.
- Desktop показывает URL-backed фильтры поиска, автомобиля, категории, важности, прочтения и
  периода; на телефоне эти же фильтры открываются в доступной нижней панели.
- Лента показывает danger/unread-состояния не только цветом, источник, автомобиль, описание,
  местоположение и все доступные telemetry-поля: скорость, направление с градусом, пробег,
  уровень и объём топлива.
- Доступны tenant-safe отметка одного события, массовая отметка, ручная запись с сохранением
  полей при ошибке, success/error toast и обновление серверного snapshot после успеха.
- Cursor-ссылка сохраняет все активные comma-separated категории и важности, а также остальные
  фильтры. Для пустой компании показывается `История пока пуста.`, а для фильтра — отдельное
  пустое состояние.
- `loading.tsx` резервирует геометрию четырёх KPI, панели фильтров и восьми карточек ленты без
  spinner; `error.tsx` даёт безопасный retry с кодом обращения.

## TDD и проверки

1. До реализации добавлена TSX-спецификация workspace; небольшой `.test.ts`-мост нужен,
   поскольку общий Vitest config обнаруживает только `*.test.ts`.
2. RED подтвердил отсутствие workspace, затем тесты зафиксировали KPI, URL-фильтры,
   danger/unread, ручную запись, read actions, cursor и empty states.
3. Review-исправления дополнили тесты для `read=all`, всех categories/severities в cursor и
   полной telemetry-карточки.

- `npx vitest run src/modules/events/components/EventsWorkspace.test.ts` — 4/4 PASS.
- `npm run typecheck` — PASS.
- Scoped ESLint и Prettier — PASS.
- `git diff --check` — PASS.
