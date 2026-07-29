# Task 3 — отчёт о реализации

## Статус

Task 3 реализован в границах brief: добавлены MapLibre canvas, client-only wrapper, адаптивное
рабочее пространство онлайн-карты и панель выбранного автомобиля.

## Изменённые файлы

- `src/modules/online-map/components/OnlineFleetMap.tsx`
- `src/modules/online-map/components/OnlineFleetMapClient.tsx`
- `src/modules/online-map/components/SelectedVehiclePanel.tsx`
- `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

Существующие dashboard-компоненты и файлы вне Task 3 не изменялись. Ранее изменённый
`.superpowers/sdd/task-1-report.md` сохранён без вмешательства и не включается в commit.

## Реализация

- Карта MapLibre создаётся для текущего набора автомобилей с центром Красноярска
  `[92.87, 56.01]` и растровыми тайлами OpenStreetMap.
- Каждый маркер отрисовывается отдельным React root через существующий `VehicleMapMarker`.
- Выбор маркера передаётся в workspace и вызывает `flyTo`; при включённом reduced motion
  длительность перелёта равна нулю.
- Cleanup отключает обработчики и `ResizeObserver`, отменяет animation frame, удаляет маркеры,
  размонтирует все React roots и вызывает `map.remove()`.
- MapLibre загружается через `next/dynamic` с `ssr: false` внутри Client Component, в соответствии
  с локальной документацией Next.js 16.2.
- Поиск по госномеру и четыре статусных фильтра используют готовый
  `filterOnlineMapVehicles`.
- Если фильтрация скрывает выбранный автомобиль, выбирается первый видимый; при пустом результате
  выбор очищается.
- На desktop поиск и фильтры расположены слева сверху, панель автомобиля — справа.
- На mobile фильтры прокручиваются горизонтально, панель закреплена снизу и учитывает
  `safe-area-inset-bottom`.
- Интерактивные элементы имеют touch target не меньше 44 px; применены семантические токены
  Pilot+, русские подписи и отключение лишней анимации при reduced motion.
- Для пустого набора и ошибки загрузки карты предусмотрены честные состояния с понятными
  действиями.

## TDD

### RED

Команда:

```text
npx vitest run src/modules/online-map/components/OnlineMapWorkspace.test.tsx
```

Ожидаемое падение:

```text
Failed to resolve import "./OnlineMapWorkspace"
Test Files 1 failed
```

Тест был создан до production-файлов и зафиксировал контракт `mapComponent`, пять fixtures,
поиск и сброс скрытого выбора.

### GREEN

Команда:

```text
npx vitest run src/modules/online-map
```

Результат:

```text
Test Files 3 passed (3)
Tests 4 passed (4)
```

## Проверки

- `npx vitest run src/modules/online-map` — 3 файла, 4 теста, успешно.
- `npm run typecheck` — успешно.
- scoped `npx eslint` для пяти файлов Task 3 — успешно.
- scoped `npx prettier --check` для пяти файлов Task 3 — успешно.

## Self-review

- Требования brief сопоставлены с реализацией по пунктам.
- Новые зависимости не добавлялись.
- Пользовательские тексты написаны по-русски.
- Цвета и поверхности используют семантические CSS tokens.
- Выбор автомобиля не приводит к пересозданию карты; карта пересоздаётся только при изменении
  набора автомобилей или явном повторе после ошибки.
- Cleanup симметричен созданным MapLibre/React-ресурсам.

## Concerns

Блокирующих замечаний нет. Реальные сетевые тайлы OpenStreetMap и визуальное поведение canvas не
запускаются в jsdom-компонентном тесте; интеграционный браузерный сценарий относится к следующему
этапу подключения маршрута.
