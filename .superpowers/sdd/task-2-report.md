# Task 2 — доступный анимированный маркер

## Статус

Завершено. Добавлен клиентский `VehicleMapMarker` для типизированных fixtures онлайн-карты.

## Изменённые файлы

- `src/modules/online-map/components/VehicleMapMarker.tsx` — нативная кнопка-маркер размером 44×44 px, иконка транспорта, статус, выбранное состояние, detail-preview и анимация Framer Motion.
- `src/modules/online-map/components/VehicleMapMarker.test.tsx` — проверка выбора автомобиля с клавиатуры.
- `vitest.config.ts` — согласованная минимальная правка `include`, добавляющая обнаружение `.test.tsx` наряду с существующими `.test.ts`.

## Доказательства RED → GREEN

1. RED: после создания теста и настройки обнаружения `.test.tsx` команда
   `npx vitest run src/modules/online-map/components/VehicleMapMarker.test.tsx`
   завершилась ошибкой `Failed to resolve import "./VehicleMapMarker"` — компонента ещё не было.
2. GREEN: после минимальной реализации та же команда завершилась успешно:
   `1 test passed`.

## Проверки

- `npx vitest run src/modules/online-map/components/VehicleMapMarker.test.tsx` — 1 тест пройден.
- `npm run typecheck` — пройден.
- `npx eslint src/modules/online-map/components/VehicleMapMarker.tsx src/modules/online-map/components/VehicleMapMarker.test.tsx vitest.config.ts` — пройден.
- `npx prettier --check src/modules/online-map/components/VehicleMapMarker.tsx src/modules/online-map/components/VehicleMapMarker.test.tsx vitest.config.ts` — пройден.
- `git diff --check` и `git diff --cached --check` — без ошибок пробелов.

## Commit

`3778b8f feat: add animated fleet map marker`

## Self-review

- Использованы только семантические токены Pilot+; новые зависимости не добавлялись.
- Взаимодействие реализовано нативной кнопкой: фокус клавиатуры, Enter/Space и touch/click вызывают один `onSelect`.
- Touch target — `size-11` (44×44 px); визуальная поверхность находится внутри него.
- Preview доступен при hover, keyboard focus и выбранном состоянии.
- Анимация применяет `whileHover` и `whileFocus` с длительностью 200 мс; для `prefers-reduced-motion` transform-анимация отключается, дополнительно присутствует `motion-reduce:transform-none`.

## Concerns

- Согласованный scope включает минимальную правку `vitest.config.ts`: без неё существующий pattern `src/**/*.test.ts` не находил обязательный файл Task 2 с расширением `.test.tsx`.
- Незаписанное до начала Task 2 изменение `.superpowers/sdd/task-1-report.md` сохранено и не входит в commit Task 2.
- Попытка отдельно закоммитить этот обязательный отчёт после кодового commit была заблокирована sandbox: Git не смог создать `.git/worktrees/online-fleet-map/index.lock` из-за `Permission denied`. Сам отчёт, исходники и результаты проверок сохранены в worktree; кодовый commit `3778b8f` создан успешно.

## Исправление review

### Изменённые файлы

- `src/modules/online-map/components/VehicleMapMarker.tsx` — `motion.button` теперь является фактически фокусируемой нативной кнопкой и владельцем `whileHover`/`whileFocus`; preview использует явный `border-[var(--color-border)]`.
- `src/modules/online-map/components/VehicleMapMarker.test.tsx` — директива jsdom перенесена в начало файла, чтобы тест гарантированно выполнялся в браузерной среде.
- `.superpowers/sdd/task-2-report.md` — добавлен этот отчёт об исправлении.

### Проверки исправления

- `npx vitest run src/modules/online-map/components/VehicleMapMarker.test.tsx` — пройден: 1 файл, 1 тест.
- `npm run typecheck` — пройден.
- `npx eslint src/modules/online-map/components/VehicleMapMarker.tsx src/modules/online-map/components/VehicleMapMarker.test.tsx vitest.config.ts` — пройден.
- `npx prettier --check src/modules/online-map/components/VehicleMapMarker.tsx src/modules/online-map/components/VehicleMapMarker.test.tsx vitest.config.ts` — пройден.
