# Task 4 — маршрут, состояния и browser-проверка онлайн-карты

## Статус

**DONE_WITH_CONCERNS**

Защищённый `/map`, геометрический loading skeleton, объявляемый error boundary Next.js 16.2,
Playwright-покрытие и документация демонстрационных ограничений реализованы. Все замечания
повторного review закрыты.

## Реализация

- `src/app/(protected)/map/page.tsx` собирает страницу через существующие protected layout и
  `AppShell`, содержит доступный `h1`, метку «Демонстрационные данные» и
  `OnlineMapWorkspace`.
- `src/app/(protected)/map/loading.tsx` повторяет геометрию карты, верхних контролов,
  демонстрационной метки и desktop/mobile панели через общий `Skeleton`.
- `src/app/(protected)/map/error.tsx` использует `ErrorState`, актуальный `unstable_retry`,
  `role="alert"` и доступный heading. Код обращения выводится только при непустом digest.
- Cleanup MapLibre удаляет marker/map синхронно, а размонтирование вложенных React roots
  откладывает через `queueMicrotask`, как существующая dashboard-карта. React 19 teardown warning
  больше не воспроизводится.
- `playwright.config.ts` принимает tracked-переменную `PLAYWRIGHT_PORT`. При её наличии
  Playwright обязательно поднимает собственный сервер и не переиспользует случайный listener.
- `tests/online-map.spec.ts` дополнительно проверяет перенаправление анонимного `/map` на
  `/login`.
- `route-states.test.tsx` проверяет loading geometry, error alert/heading, условный reference и
  `unstable_retry`; `OnlineFleetMap.cleanup.test.ts` фиксирует deferred cleanup-контракт.
- `docs/PROJECT_GUIDE.md` явно описывает пять fixtures и отсутствие живой телеметрии MQTT/Redis.

## TDD

- Исходный RED: 4/4 browser-сценария упали из-за отсутствующего `/map`.
- Review RED:
  `npx vitest run "src/app/(protected)/map/route-states.test.tsx"
  src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts` — 3 ожидаемых падения:
  отсутствовали `role="alert"`, условный reference и deferred `root.unmount()`.
- Review GREEN: та же команда — 2 файла, 4/4 теста прошли.

## Проверки

- PASS — `$env:PLAYWRIGHT_PORT='3414'; npx playwright test tests/online-map.spec.ts
  --workers=1 --project=desktop` — 5/5. Учётные данные загружены только в память процесса через
  существующий auth-helper; порт 3000 не использовался.
- PASS — `npx vitest run src/modules/online-map
  "src/app/(protected)/map/route-states.test.tsx"` — 5 файлов, 10/10 тестов.
- PASS — `npm run typecheck`.
- PASS — полный `npm run lint`.
- PASS — scoped Prettier для всех изменённых исходников, тестов, config и этого отчёта.
- PASS — `npm run build`; production route table содержит `ƒ /map`.
- PASS — `git diff --check`.
- FAIL (pre-existing, вне Task 4) — `npm run format:check`: 14 несформатированных файлов в
  существующих modules/app/shared/tests. Они не изменялись, чтобы не смешивать чужие продуктовые
  правки с fix commit.

## Concerns

- Build остаётся зелёным, но печатает уже известные предупреждения о нескольких lockfiles и
  слишком широком Prisma NFT trace из `src/database/generated/prisma/index.js`; оба не относятся
  к Task 4.
- Полный format-check заблокирован 14 существующими файлами вне scope. Scoped проверка всех
  файлов fix commit проходит.
- Чужое незавершённое изменение `.superpowers/sdd/task-1-report.md` сохранено и не включается в
  commit.
