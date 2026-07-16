# Отчёт по Task 2: сворачиваемая Mosaic-оболочка

## Статус

Реализация завершена. `AppShell` сохранён серверной композицией, а интерактивное состояние ширины вынесено в единственный клиентский `ShellFrame`. Lifecycle и содержимое карты не изменялись.

## Сделано

- Добавлен клиентский `ShellFrame` с CSS-переменной ширины 80/240 px, контрактами `app-shell`, `desktop-sidebar` и `data-sidebar-expanded`.
- Состояние сохраняется в `localStorage` по ключу `pilot-sidebar-expanded` значениями `true`/`false`.
- Для совместимости с React lint persistence реализован через `useSyncExternalStore`, `storage` и внутреннее событие текущей вкладки.
- Sidebar получил Mosaic-строку логотипа, схлопываемые подписи, сохранённые navigation data/links, активный state и нижний `IconButton`.
- Header получил общий отступ от динамической ширины, 44 px actions, 40 px поиск в 44 px wrapper и разделитель профиля.
- Мобильный drawer и его контракты не изменены; `Sidebar` по умолчанию остаётся раскрытым и без desktop-toggle.
- Добавлены два Playwright-контракта persistence и resize карты.

## TDD: RED

Команда:

```powershell
npx playwright test --project=desktop tests/dashboard.spec.ts -g "навигаци" --workers=1
```

Результат: существующий тест PASS; оба новых теста FAIL из-за отсутствующих кнопки раскрытия/testid/контрактов (5.5 s и 30.0 s). Процесс достиг timeout 120 s на teardown с существующим предупреждением FleetMap о синхронном unmount React root.

## TDD: GREEN и проверки

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- Navigation subset — 3/3 фактически PASS (последние времена: 639 ms, 1.4 s, 758 ms); runner не завершился и достиг timeout из-за прежнего FleetMap teardown warning.
- Повторный GREEN дал те же 3/3 PASS (618 ms, 1.4 s, 815 ms), затем тот же teardown timeout.
- Попытка отдельного reuse-server: сервер не поднялся на `127.0.0.1:3000`, поэтому полный desktop suite не запускался повторно.
- `npx prettier --check ...` — после форматирования PASS.
- `git diff --check` — PASS.

## Изменённые файлы

- `src/shared/components/app-shell/ShellFrame.tsx`
- `src/shared/components/app-shell/AppShell.tsx`
- `src/shared/components/app-shell/Sidebar.tsx`
- `src/shared/components/app-shell/Header.tsx`
- `tests/dashboard.spec.ts`

`MobileNavigation.tsx` проверен, но не потребовал изменения: defaults нового Sidebar сохраняют прежнее поведение и focus order drawer.

## Саморевью

- Server/client boundary соответствует локальной документации Next.js 16: server-rendered children передаются в клиентский slot, props сериализуемы.
- Карта не импортируется и не перемонтируется оболочкой; меняются только layout CSS properties.
- navigation data, href, aria-labels, testids и мобильные контракты сохранены.
- `onToggle` оставлен опциональным, чтобы desktop Sidebar получал control, а мобильный drawer не приобретал лишнюю focusable кнопку и не ломал focus-trap контракт.
- Посторонний `debug.log` не тронут.

## Concerns

Полный desktop dashboard suite не имеет завершившегося exit 0: Playwright подтверждает PASS всех выполненных navigation-тестов, но встроенный webServer зависает на teardown из-за существующего FleetMap React-root warning. Исправление lifecycle карты запрещено границами Task 2.
