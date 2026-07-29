# Task 4 — маршрут, состояния и browser-проверка онлайн-карты

## Статус

**DONE_WITH_CONCERNS**

Защищённый маршрут `/map`, геометрический loading skeleton, error boundary Next.js 16.2,
Playwright-покрытие и описание демонстрационного ограничения в `PROJECT_GUIDE` реализованы.

## Реализация

- `src/app/(protected)/map/page.tsx` собирает страницу через существующий защищённый layout и
  `AppShell`, содержит доступный `h1`, метку «Демонстрационные данные» и
  `OnlineMapWorkspace`.
- `src/app/(protected)/map/loading.tsx` повторяет геометрию карты, верхнего поиска и фильтров,
  демонстрационной метки и desktop/mobile панели с помощью общего `Skeleton`.
- `src/app/(protected)/map/error.tsx` использует общий `ErrorState`, безопасный код обращения и
  актуальный `unstable_retry` из Next.js 16.2.
- `tests/online-map.spec.ts` проверяет ровно пять fixtures, поиск, пустое состояние, выбор,
  desktop hover/focus, нижнюю панель при `390×844`, low-height desktop и отсутствие
  горизонтального/вертикального переполнения.
- `docs/PROJECT_GUIDE.md` явно фиксирует пять fixtures и отсутствие живой телеметрии MQTT/Redis.

## TDD

- RED — `npx playwright test online-map.spec.ts
  --config=.superpowers/sdd/playwright-task4.config.ts --workers=1 --project=desktop`:
  4/4 теста ожидаемо упали из-за отсутствующего `/map` (не найдены heading, маркеры, панель и
  region).
- GREEN — та же команда после реализации на изолированном `127.0.0.1:3414`: 4/4 теста прошли.
- Авторизация выполнена через существующий `tests/helpers/auth.ts`; локальные
  `PILOT_ADMIN_EMAIL` и `PILOT_ADMIN_PASSWORD` загружались только в память процесса из корневого
  `.env` и не выводились.

## Проверки

- PASS — `npx playwright test online-map.spec.ts
  --config=.superpowers/sdd/playwright-task4.config.ts --workers=1 --project=desktop` — 4/4.
- PASS — `npx vitest run src/modules/online-map` — 3 файла, 6/6 тестов.
- PASS — `npm run typecheck`.
- PASS — `npx eslint "src/app/(protected)/map/*.tsx" tests/online-map.spec.ts`.
- PASS — `npx prettier --check "src/app/(protected)/map/page.tsx"
  "src/app/(protected)/map/loading.tsx" "src/app/(protected)/map/error.tsx"
  tests/online-map.spec.ts docs/PROJECT_GUIDE.md`.
- PASS — `npm run build`; production route table содержит `ƒ /map`.
- PASS — `git diff --check`.

## Concerns

- Next.js build остаётся зелёным, но печатает уже известное предупреждение о слишком широком
  Prisma NFT trace из `src/database/generated/prisma/index.js`; оно зафиксировано в
  `PROJECT_GUIDE` и не относится к Task 4.
- Dev E2E печатает React 19 warning о синхронном `root.unmount()` маркеров во время teardown.
  Browser-сценарии проходят; источник находится в существующем Task 3 MapLibre-компоненте и не
  изменялся в рамках запрета на правки других продуктовых модулей.
- Обычный `playwright.config.ts` использует порт 3000. Чтобы не подключаться к чужому main
  server, проверка Task 4 выполнялась с локальным ignored config
  `.superpowers/sdd/playwright-task4.config.ts` на порту 3414.
