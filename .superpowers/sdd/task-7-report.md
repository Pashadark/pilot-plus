# Отчёт по Task 7: mobile breadcrumbs, scroll-to-top и shortcuts

## Статус

DONE

## Реализация

- Мобильный header показывает семантические хлебные крошки в однострочном горизонтально прокручиваемом контейнере без переполнения страницы.
- Состояние мобильного drawer поднято в `ShellFrame`; закрытие по Escape, кнопке и переходу использует единый callback и сохраняет существующие focus trap, scroll lock и возврат фокуса.
- Добавлен `useGlobalShortcuts` с одной подпиской `keydown` и cleanup. Клавиши `T`, `F`, `/` и `Escape` игнорируются в `input`, `textarea`, `select`, `contenteditable` и при любых модификаторах. `/` вызывает `preventDefault()` только при актуально доступном `focusSearch`.
- `T` вызывает существующий `toggleTheme` из `ThemeProvider`; `F` и `/` фокусируют первое отображаемое поле поиска.
- Добавлена кнопка «Наверх»: появляется после 400 px, прокручивает к началу с `smooth`, а при `prefers-reduced-motion: reduce` использует `auto`.

## TDD и review

- Shortcut RED: suite упал из-за отсутствующего `useGlobalShortcuts`.
- Shortcut GREEN: 15/15; после review добавлен отдельный RED для актуальности callback и итоговый GREEN 16/16.
- Mobile E2E RED: 4/4 новых сценария упали на отсутствующих breadcrumbs, shortcut и scroll-to-top.
- Mobile E2E GREEN: 4/4 целевых сценария прошли.
- Независимый review: Critical не найдено; Important про динамический `/ preventDefault()` закрыт pure-listener regression test.
- Усилен breadcrumb E2E: проверяются реальное переполнение контейнера и изменение `scrollLeft`.

## Проверки

- `npm run lint` — PASS, exit 0.
- `npm run typecheck` — PASS, exit 0.
- `npm run test:unit` — PASS, 22 файла и 107/107 тестов.
- `npm run build` — PASS, Next.js 16.2.10 production build.
- `npx playwright test tests/dashboard.spec.ts tests/ui-kit.spec.ts --workers=1` — PASS, единый чистый прогон 96/96 в desktop и mobile.
- Drawer focus-wrap после актуализации последнего focusable — PASS в desktop и mobile.
- `git diff --check` и scoped Prettier check — выполняются перед commit.

## Post-review fix

### Исправления

- Контракт `focusSearch` изменён на `() => boolean`: `/` вызывает callback первым и отменяет событие только при фактически успешной фокусировке.
- `ShellFrame` исключает disabled, readonly, `aria-disabled`, `aria-hidden`, `display: none`, `visibility: hidden` и не имеющие client rect поля; `true` возвращается только когда найденное поле стало `document.activeElement`.
- Listener теперь получает тот же ref-object, что использует hook, и читает `ref.current` на каждом событии.
- Ref синхронизируется в `useLayoutEffect`, поэтому актуальные callbacks устанавливаются до paint и следующего пользовательского события.
- E2E различает видимый поиск компонентов и настольный dashboard, где responsive search-поля скрыты. `/` и `F` фокусируют правильное поле; cancelable `/` без видимого поиска остаётся неотменённым.

### RED / GREEN

- Unit RED: 2 ожидаемых падения — callback с `false` всё ещё вызывал `preventDefault`, listener ожидал getter вместо ref-object.
- Browser RED: desktop dashboard получил `defaultPrevented: true`, ожидалось `false`.
- Unit GREEN: `useGlobalShortcuts.test.ts` — 16/16 PASS.
- Focused E2E GREEN: shortcut/search assertions — 4/4 PASS в desktop и mobile.
- Full GREEN: `npm run test:unit` — 107/107; lint и typecheck — exit 0; полный Playwright — единый чистый 96/96 PASS.

## Известные предупреждения

- Next.js сохраняет уже известные предупреждения о нескольких lockfile/workspace root и широком NFT trace Prisma; Task 7 их не изменяет.
