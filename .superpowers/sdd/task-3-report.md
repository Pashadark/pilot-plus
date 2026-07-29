# Task 3 — даты, сводка и воспроизведение маршрута

## Status

Завершено. Реализовано полностью управляемое отображение маршрута выбранного автомобиля:
выбор даты и быстрых периодов, дневная сводка, выбор события, ручной ползунок и
автоматическое воспроизведение. Состояние и interval сбрасываются при смене даты,
автомобиля, скрытии выбранного автомобиля фильтром и закрытии панели.

Кодовый commit: `88564fe feat: add track dates and playback controls`.

## TDD evidence

### RED

Команда:

```text
npx vitest run src/modules/online-map/components/OnlineMapWorkspace.test.tsx
```

Первый запуск после добавления интеграционных сценариев:

```text
Test Files  1 failed (1)
Tests       5 failed | 5 passed (10)
```

Ожидаемые причины падения: отсутствовали `Дата маршрута`, событие маршрута,
`Положение на маршруте` и `Воспроизвести маршрут`.

Узкие контрактные тесты для новых компонентов также были добавлены до компонентов.
Контрольный RED:

```text
Failed to resolve import "./TrackDaySummary"
Test Files  1 failed (1)
```

### GREEN

После минимальной реализации:

```text
npx vitest run src/modules/online-map/components/OnlineMapWorkspace.test.tsx

Test Files  1 passed (1)
Tests       12 passed (12)
```

Совместная focused-регрессия workspace и жизненного цикла карты:

```text
npx vitest run src/modules/online-map/components/OnlineMapWorkspace.test.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts

Test Files  2 passed (2)
Tests       20 passed (20)
```

Проверены: последняя дата, ручной выбор дня, «Сегодня», «Вчера», «7 дней»,
русское пустое состояние, сводка, событие → progress/маркер, ручной slider,
шаг autoplay `2` каждые `250 ms`, остановка на `100`, reduced motion,
сбросы даты/автомобиля/события/таймера и закрытие панели.

## Files

Созданы:

- `src/modules/online-map/components/TrackDateControls.tsx`
- `src/modules/online-map/components/TrackDaySummary.tsx`
- `src/modules/online-map/components/TrackPlayback.tsx`

Изменены:

- `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- `src/modules/online-map/components/SelectedVehiclePanel.tsx`
- `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`
- `src/modules/online-map/components/OnlineFleetMap.tsx`
- `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

`OnlineFleetMapClient.tsx` проверен, но менять его не потребовалось: он прозрачно
принимает и передаёт тот же `OnlineFleetMapProps`.

`OnlineFleetMap.tsx` — подтверждённое владельцем задачи минимальное исключение из
первоначального списка файлов: пять новых props переведены из optional/defaulted
в required. `OnlineFleetMap.cleanup.test.ts` изменён только для передачи этих
обязательных props в существующий render-вызов. Поведение Task 2 не менялось.

Чужие незакоммиченные изменения в `task-1-report.md` и `task-2-report.md` сохранены
и не добавлялись в индекс.

## Verification

```text
npm run typecheck
> tsc --noEmit
exit 0
```

```text
npm run lint -- --max-warnings=0
> eslint --max-warnings=0
exit 0
```

```text
npx prettier --check <изменённые TS/TSX-файлы>
All matched files use Prettier code style!
```

```text
git diff --check
exit 0
```

## Self-review

- Все пользовательские строки новые/изменённые — русские.
- Select, быстрые chips, play/pause и slider имеют область взаимодействия не менее `44 px`.
- На мобильном карта остаётся основной: нижняя панель ограничена `48dvh`, имеет
  внутренний scroll и safe-area padding; все три маршрутных блока находятся внутри панели.
- На desktop playback визуально вынесен вниз по центру карты через container-responsive
  классы, а дата и сводка остаются в правой панели.
- `useReducedMotion` блокирует автоматический запуск, но не отключает range input;
  кнопка содержит русскую подсказку.
- Событие ищет связанную точку по `pointId`, вычисляет точный процент относительно
  `points.length - 1` и останавливает autoplay.
- Effect всегда очищает interval при unmount и смене зависимостей; явные обработчики
  сбрасывают progress, playing, дату и событие в требуемых переходах.
- «7 дней» намеренно сохраняет текущую дату и полный список доступных дат согласно brief.

## Concerns

Блокирующих замечаний нет. Данные остаются демонстрационными fixtures, поэтому
«Сегодня» и «Вчера» означают первую и вторую доступные даты, как определено требованиями.
