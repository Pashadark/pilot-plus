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
- `npx playwright test tests/dashboard.spec.ts tests/ui-kit.spec.ts --workers=1` — 95/96 PASS; единственный существующий desktop toast-тест флейкнул один раз, его mobile-вариант прошёл.
- Изолированный повтор desktop toast-теста — PASS, 1/1.
- Drawer focus-wrap после актуализации последнего focusable — PASS в desktop и mobile.
- `git diff --check` и scoped Prettier check — выполняются перед commit.

## Известные предупреждения

- Next.js сохраняет уже известные предупреждения о нескольких lockfile/workspace root и широком NFT trace Prisma; Task 7 их не изменяет.
