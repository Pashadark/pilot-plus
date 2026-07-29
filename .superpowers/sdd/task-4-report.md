# Task 4 — скелетоны, E2E, документация и полная проверка

## Статус

Task 4 завершена. Добавлена доступная сериализованная поверхность реального `VehicleTrackViewModel`,
расширен skeleton `/map`, актуализирован проектный handoff и проверен полный пользовательский поток
динамических маршрутов на desktop, телефоне и планшете.

## RED

1. После добавления базового сценария:

   ```powershell
   npx playwright test tests/online-map.spec.ts --project=desktop --grep "показывает цветной маршрут"
   ```

   Результат: `1 failed`; ожидаемое функциональное падение на отсутствующем
   `[data-track-color="green"]`.

2. После добавления полного набора требований:

   ```powershell
   npx playwright test tests/online-map.spec.ts --project=desktop --grep "показывает цветной|все действия маршрута|маршрут не создаёт горизонтальную"
   ```

   Результат: `4 failed`; во всех случаях отсутствовал `data-testid="vehicle-track-a11y"`.

3. E2E отдельно выявил узкий дефект предыдущей реализации: slider переходил к точке события, но
   `data-playback-point` реального MapLibre marker оставался на `p0`. Причина: update-effect вызывал
   `Marker.setLngLat`, но dataset задавался только при создании marker. После согласования с
   родительской задачей добавлена синхронизация dataset перед реальным перемещением.

Первый технический запуск остановился до проверки функции из-за отсутствия auth-переменных в
worktree. Все зачтённые RED/GREEN-прогоны выполнялись с безопасной загрузкой корневого `.env` без
вывода значений и на изолированных портах.

## GREEN

- Цвета `green/yellow/red`, вычисленная opacity `0.72`, дата и координаты сериализуются из того же
  view model, который получает MapLibre.
- Координата события «Заправка» точно совпадает с координатой точки линии.
- Hover/focus сегмента вызывает реальные popup callbacks с временем, скоростью и адресом.
- Клик/Enter по событию открывает реальный popup и перемещает slider/marker.
- Начало и конец маршрута управляют тем же progress callback, что slider.
- Воспроизведение меняет реальный `data-playback-point`; закрытие карточки удаляет surface, слои и
  playback marker.
- Проверены keyboard-only сценарий и отсутствие overflow на `390×844`, `1024×768`, а также
  существующие проверки `1440×900`.

Итоговый browser-прогон:

```powershell
npx playwright test tests/online-map.spec.ts --workers=1
```

Результат: `22 passed`, `4 skipped`, код `0`. Skip относятся только к намеренно
desktop/mobile-specific сценариям противоположного проекта.

## Изменённые файлы

- `src/app/(protected)/map/loading.tsx`
- `src/modules/online-map/components/VehicleTrackLayers.tsx`
- `src/modules/online-map/components/OnlineFleetMap.tsx`
- `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`
- `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`
- `tests/online-map.spec.ts`
- `docs/PROJECT_GUIDE.md`
- `.superpowers/sdd/task-4-report.md`

Отчёты Task 1–2 сохранены без изменений этой задачи.

## Полная проверка

| Команда | Результат |
| --- | --- |
| `npm run typecheck` | PASS, код `0` |
| `npm run lint` | PASS, код `0`, без warnings |
| `npm run test:unit` | PASS: 79 файлов, 384 теста |
| `npm run build` | PASS, код `0`, 15/15 static pages |
| `npx playwright test tests/online-map.spec.ts --workers=1` | PASS: 22, skipped: 4 |
| `npx prettier --check <все файлы Task 4>` | PASS |
| `npx prettier --check docs/PROJECT_GUIDE.md` | PASS |
| `git diff --check` | PASS, вывода нет |

`npm run format:check` остаётся красным на 14 несвязанных baseline-файлах, которые существовали до
Task 4. Все файлы этой задачи отдельно проходят Prettier. Они не переформатировались массово, чтобы
не затронуть пользовательские изменения.

## Self-review и замечания

- В brief указано `--project=chromium`, но в репозитории проекты называются `desktop` и `mobile`;
  оба используют Chromium devices. Итоговая команда без фильтра проекта проверила оба проекта и
  сильнее указанной команды.
- Параллельный E2E с восемью workers один раз поймал существующую auth-гонку:
  `/?welcome=1` вместо строгого `/` в `tests/helpers/auth.ts`. Последовательный канонический прогон
  стабильно зелёный; auth-helper вне scope Task 4 не менялся.
- Build сохраняет известные warnings о нескольких lockfiles/workspace root и NFT tracing
  `next.config.ts`; сборка завершается успешно. Эти предупреждения не вызваны динамическими треками.
- Новых зависимостей нет. Источник маршрутов остаётся `track-fixtures.ts`; API/MQTT не имитируется.

## Исправления после review

Все четыре замечания review закрыты:

1. Desktop-сценарий `1440×900` вызывает `expectNoPageOverflow` сразу после готовности трека.
2. `vehicle-track-a11y` стал настоящей visually-hidden surface размером `1×1`, с clipping и
   `pointer-events: none`. Он не перехватывает мышь карты, но вложенные кнопки остаются доступны
   через программный focus и Enter/Space.
3. DOM и MapLibre вызывают один локальный `activateEvent`; прежние соседние event-select и
   playback callbacks заменены единым `onEventActivate` от workspace до слоя.
4. Keyboard E2E фокусирует скрытый сегмент маршрута и проверяет popup: `08:00–08:08`,
   `Средняя скорость: 32 км/ч`, `Красноярск, ул. Дубровинского`.

### Review RED

```powershell
npx vitest run src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
```

Результат: `1 failed`, `8 passed`; ожидаемое падение:
`TypeError: options.onEventSelect is not a function`. Новый regression-тест требовал единственный
`onEventActivate`.

```powershell
npx playwright test tests/online-map.spec.ts --project=desktop --workers=1 --grep "показывает цветной маршрут"
```

Результат: `1 failed`; ожидаемое значение `pointer-events: none`, фактическое старое значение
`pointer-events: auto`.

### Review GREEN и финальная проверка

| Команда | Свежий результат |
| --- | --- |
| `npx vitest run OnlineFleetMap.cleanup.test.ts OnlineMapWorkspace.test.tsx` | PASS: 2 файла, 22 теста |
| focused desktop E2E двух динамических сценариев | PASS: 2 теста |
| `npm run typecheck` | PASS, код `0` |
| `npm run lint` | PASS, код `0`, без warnings |
| `npm run test:unit` | PASS: 79 файлов, 384 теста |
| `npx playwright test tests/online-map.spec.ts --workers=1` | PASS: 22, skipped: 4, код `0` |
| `npm run build` | PASS, код `0`, 15/15 static pages |

Во время полного E2E один OSM tile ответил `Failed to fetch`; MapLibre продолжил работу, все 22
исполняемых сценария прошли. Это внешняя tile-сеть, а не ошибка трека.

## Финальный review loop

Clipped semantic segment снова получил `onMouseEnter`, но без восстановления pointer hit-testing:
контейнер остаётся `pointer-events: none`. `onMouseEnter` и `onFocus` используют одну локальную
функцию `activateSegment`, поэтому popup не имеет отдельной бизнес-логики для E2E.

RED:

```powershell
npx playwright test tests/online-map.spec.ts --project=desktop --workers=1 --grep "показывает цветной маршрут"
```

Результат: `1 failed`; после браузерного `dispatchEvent('mouseover')` popup
`08:00–08:08` отсутствовал.

GREEN:

```powershell
npx playwright test tests/online-map.spec.ts --project=desktop --workers=1 --grep "показывает цветной маршрут"
```

Результат: `1 passed (10.1s)`, код `0`. Тест программно отправляет реальный browser `mouseover` на
неперехватывающий segment control и проверяет время, скорость и адрес popup. Отдельная keyboard
проверка focus сохранена.

```powershell
npm run typecheck
```

Результат: PASS, код `0`.

Post-fix formatting и whitespace:

```powershell
npx prettier --check ".superpowers/sdd/task-4-report.md" "docs/PROJECT_GUIDE.md" "src/app/(protected)/map/loading.tsx" "src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts" "src/modules/online-map/components/OnlineFleetMap.tsx" "src/modules/online-map/components/OnlineMapWorkspace.test.tsx" "src/modules/online-map/components/OnlineMapWorkspace.tsx" "src/modules/online-map/components/VehicleTrackLayers.tsx" "tests/online-map.spec.ts"
git diff --check
```

Ожидаемый и подтверждённый ниже результат: Prettier — `All matched files use Prettier code style!`;
`git diff --check` — код `0`, вывода нет.
