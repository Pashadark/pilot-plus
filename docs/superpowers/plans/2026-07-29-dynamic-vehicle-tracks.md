# Dynamic Vehicle Tracks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить на онлайн-карту Pilot+ демонстрационные маршруты автомобилей по датам: полупрозрачные участки по скорости, события строго на линии, карточки начала/финиша и ручное воспроизведение поездки.

**Architecture:** Данные треков хранятся отдельно от фикстур автомобилей и преобразуются чистыми функциями в сериализуемую модель отображения. `OnlineMapWorkspace` управляет автомобилем, датой и воспроизведением, а MapLibre-слой только рисует полученную модель и сообщает о наведении/выборе события. Компоненты управления, сводки и popup остаются небольшими и используют существующую дизайн-систему Pilot+.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, MapLibre GL 5, Vitest, Testing Library, Playwright.

## Global Constraints

- Все пользовательские тексты и комментарии в проекте — на русском языке.
- На этом этапе используются стабильные демонстрационные данные, без подключения реальной телематики.
- Для каждого из пяти тестовых автомобилей подготовить маршруты минимум за три даты.
- Цвет скорости: зелёный `0–39 км/ч`, жёлтый `40–69 км/ч`, красный `70+ км/ч`.
- Базовая прозрачность линий — `0.72`; наведённый или выбранный сегмент толще и заметнее.
- Координаты события должны совпадать с координатами конкретной точки трека.
- На мобильном экране карта остаётся главным содержимым, интерактивные цели имеют размер минимум `44×44 px`.
- При `prefers-reduced-motion: reduce` автоматическое плавное воспроизведение отключается, ручной ползунок продолжает работать.
- Не добавлять новые runtime-зависимости.
- Перед изменением Next.js-кода читать релевантные руководства из `node_modules/next/dist/docs/`.

---

## File Map

- Create `src/modules/online-map/track-types.ts` — доменные типы трека, сегмента, события и модели отображения.
- Create `src/modules/online-map/track-fixtures.ts` — стабильные демонстрационные треки пяти автомобилей за три даты.
- Create `src/modules/online-map/track-model.ts` — чистое построение сегментов, событий, периодов, сводки и позиции воспроизведения.
- Create `src/modules/online-map/track-model.test.ts` — модульные тесты порогов скорости, привязки событий, периодов и воспроизведения.
- Create `src/modules/online-map/components/VehicleTrackLayers.tsx` — регистрация и очистка источников/слоёв MapLibre.
- Create `src/modules/online-map/components/TrackEventPopup.tsx` — русская карточка события.
- Create `src/modules/online-map/components/TrackDateControls.tsx` — дата и быстрые периоды.
- Create `src/modules/online-map/components/TrackPlayback.tsx` — кнопка и ползунок воспроизведения.
- Create `src/modules/online-map/components/TrackDaySummary.tsx` — сводка дня и пустое состояние.
- Modify `src/modules/online-map/components/OnlineFleetMap.tsx` — принять модель трека, вписать маршрут и синхронизировать карту.
- Modify `src/modules/online-map/components/OnlineFleetMapClient.tsx` — прокинуть расширенные свойства.
- Modify `src/modules/online-map/components/OnlineMapWorkspace.tsx` — состояние даты, периода, события и воспроизведения.
- Modify `src/modules/online-map/components/SelectedVehiclePanel.tsx` — разместить сводку и управление треком.
- Modify `src/modules/online-map/components/OnlineMapWorkspace.test.tsx` — интеграционные тесты интерфейса.
- Modify `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts` — тест очистки трековых ресурсов.
- Modify `src/app/(protected)/map/loading.tsx` — скелетоны новых элементов управления.
- Modify `tests/online-map.spec.ts` — десктопные и мобильные E2E-сценарии.
- Modify `docs/PROJECT_GUIDE.md` — зафиксировать готовую демонстрацию маршрутов и ограничение источника данных.

### Task 1: Доменная модель и демонстрационные данные маршрутов

**Files:**
- Create: `src/modules/online-map/track-types.ts`
- Create: `src/modules/online-map/track-fixtures.ts`
- Create: `src/modules/online-map/track-model.ts`
- Create: `src/modules/online-map/track-model.test.ts`

**Interfaces:**
- Consumes: `OnlineMapVehicle['id']` из `src/modules/online-map/types.ts`.
- Produces: `getVehicleTrackDates(vehicleId)`, `getVehicleTrack(vehicleId, date)`, `buildTrackViewModel(track)`, `getPlaybackPosition(track, progress)`, типы `VehicleTrack`, `VehicleTrackEvent`, `VehicleTrackViewModel`.

- [ ] **Step 1: Написать падающие тесты модели**

```ts
import { describe, expect, it } from 'vitest';

import {
  buildTrackViewModel,
  getPlaybackPosition,
  getVehicleTrackDates,
} from './track-model';
import type { VehicleTrack } from './track-types';

const track: VehicleTrack = {
  vehicleId: 'vehicle-1',
  date: '2026-07-29',
  points: [
    { id: 'p0', coordinates: [92.8, 56], timestamp: '08:00', speedKph: 0, address: 'Старт' },
    { id: 'p1', coordinates: [92.81, 56.01], timestamp: '08:10', speedKph: 39, address: 'Улица 1' },
    { id: 'p2', coordinates: [92.82, 56.02], timestamp: '08:20', speedKph: 40, address: 'Улица 2' },
    { id: 'p3', coordinates: [92.83, 56.03], timestamp: '08:30', speedKph: 70, address: 'Финиш' },
  ],
  events: [
    { id: 'event-1', type: 'stop', pointId: 'p2', title: 'Остановка', description: '10 минут' },
  ],
};

describe('buildTrackViewModel', () => {
  it('окрашивает сегменты по порогам скорости и задаёт прозрачность 0.72', () => {
    const model = buildTrackViewModel(track);
    expect(model.segments.map(({ color, opacity }) => [color, opacity])).toEqual([
      ['green', 0.72],
      ['yellow', 0.72],
      ['red', 0.72],
    ]);
  });

  it('помещает событие точно в координаты связанной точки', () => {
    expect(buildTrackViewModel(track).events[0].coordinates).toEqual([92.82, 56.02]);
  });

  it('возвращает старт, финиш и позицию ползунка', () => {
    const model = buildTrackViewModel(track);
    expect(model.start.coordinates).toEqual([92.8, 56]);
    expect(model.finish.coordinates).toEqual([92.83, 56.03]);
    expect(getPlaybackPosition(track, 50).coordinates).toEqual([92.82, 56.02]);
  });
});

describe('getVehicleTrackDates', () => {
  it('возвращает даты автомобиля от новой к старой', () => {
    expect(getVehicleTrackDates('haval-jolion')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Запустить тест и подтвердить ожидаемое падение**

Run: `npx vitest run src/modules/online-map/track-model.test.ts`

Expected: FAIL с ошибкой импорта `Cannot find module './track-model'`.

- [ ] **Step 3: Добавить точные доменные типы**

```ts
export type TrackCoordinates = readonly [longitude: number, latitude: number];
export type TrackEventType =
  | 'stop'
  | 'refuel'
  | 'speeding'
  | 'connection-loss'
  | 'geofence-enter'
  | 'geofence-exit';
export type TrackSpeedColor = 'green' | 'yellow' | 'red';

export interface VehicleTrackPoint {
  id: string;
  coordinates: TrackCoordinates;
  timestamp: string;
  speedKph: number;
  address: string;
}

export interface VehicleTrackEvent {
  id: string;
  type: TrackEventType;
  pointId: string;
  title: string;
  description: string;
}

export interface VehicleTrack {
  vehicleId: string;
  date: string;
  points: readonly VehicleTrackPoint[];
  events: readonly VehicleTrackEvent[];
}

export interface VehicleTrackSegment {
  id: string;
  from: VehicleTrackPoint;
  to: VehicleTrackPoint;
  speedKph: number;
  color: TrackSpeedColor;
  opacity: 0.72;
}

export interface VehicleTrackEventView extends VehicleTrackEvent {
  coordinates: TrackCoordinates;
  timestamp: string;
  speedKph: number;
  address: string;
}

export interface VehicleTrackViewModel {
  vehicleId: string;
  date: string;
  segments: readonly VehicleTrackSegment[];
  events: readonly VehicleTrackEventView[];
  eventGroups: readonly (VehicleTrackEventView & { count: number })[];
  start: VehicleTrackPoint;
  finish: VehicleTrackPoint;
  distanceKm: number;
  durationMinutes: number;
  maxSpeedKph: number;
}
```

- [ ] **Step 4: Добавить фикстуры и чистые функции**

В `track-fixtures.ts` экспортировать `vehicleTrackFixtures: readonly VehicleTrack[]` с тремя датами для каждого `id` из `onlineMapVehicles`. Каждая поездка содержит 8–12 точек Красноярска, минимум один зелёный, жёлтый и красный сегмент и 3–5 событий, ссылающихся только на существующие `pointId`.

```ts
export function getSpeedColor(speedKph: number): TrackSpeedColor {
  if (speedKph < 40) return 'green';
  if (speedKph < 70) return 'yellow';
  return 'red';
}

export function getVehicleTrackDates(vehicleId: string): readonly string[] {
  return vehicleTrackFixtures
    .filter((track) => track.vehicleId === vehicleId)
    .map((track) => track.date)
    .sort((left, right) => right.localeCompare(left));
}

export function getVehicleTrack(vehicleId: string, date: string): VehicleTrack | null {
  return (
    vehicleTrackFixtures.find(
      (track) => track.vehicleId === vehicleId && track.date === date,
    ) ?? null
  );
}

export function getPlaybackPosition(track: VehicleTrack, progress: number): VehicleTrackPoint {
  const bounded = Math.min(100, Math.max(0, progress));
  const index = Math.round((bounded / 100) * (track.points.length - 1));
  return track.points[index];
}
```

`buildTrackViewModel` создаёт сегмент между каждой парой соседних точек, привязывает события через `pointId`, группирует совпадающие координаты и рассчитывает расстояние, длительность и максимальную скорость. При числе точек меньше двух функция бросает `Error('Маршрут должен содержать минимум две точки')`; событие с неизвестным `pointId` бросает `Error('Событие не привязано к точке маршрута')`.

- [ ] **Step 5: Запустить модульные тесты**

Run: `npx vitest run src/modules/online-map/track-model.test.ts`

Expected: PASS, включая проверки порогов `39/40/69/70`, группировки одинаковых координат, сортировки дат, исключений и границ ползунка `0/100`.

- [ ] **Step 6: Зафиксировать доменную модель**

```bash
git add src/modules/online-map/track-types.ts src/modules/online-map/track-fixtures.ts src/modules/online-map/track-model.ts src/modules/online-map/track-model.test.ts
git commit -m "feat: add demo vehicle track model"
```

### Task 2: Слои MapLibre, события и жизненный цикл карты

**Files:**
- Create: `src/modules/online-map/components/VehicleTrackLayers.tsx`
- Create: `src/modules/online-map/components/TrackEventPopup.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMap.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

**Interfaces:**
- Consumes: `VehicleTrackViewModel`, `VehicleTrackEventView`, `VehicleTrackPoint`.
- Produces: расширение `OnlineFleetMapProps` полями `trackViewModel`, `playbackPoint`, `selectedEventId`, `onEventSelect`, `onPlaybackProgressRequest`.

- [ ] **Step 1: Расширить тесты очистки MapLibre**

```ts
it('удаляет обработчики, popup, источники и слои маршрута при смене автомобиля', () => {
  const { rerender, unmount } = render(
    <OnlineFleetMap
      vehicles={vehicles}
      selectedVehicleId="haval-jolion"
      trackViewModel={trackViewModel}
      playbackPoint={trackViewModel.start}
      selectedEventId={null}
      onVehicleSelect={vi.fn()}
      onEventSelect={vi.fn()}
      onPlaybackProgressRequest={vi.fn()}
    />,
  );

  rerender(/* та же карта с trackViewModel другого автомобиля */);
  unmount();

  expect(mapOff).toHaveBeenCalledWith('mousemove', 'vehicle-track-hitbox', expect.any(Function));
  expect(removeLayer).toHaveBeenCalledWith('vehicle-track-lines');
  expect(removeSource).toHaveBeenCalledWith('vehicle-track');
  expect(popupRemove).toHaveBeenCalled();
});
```

- [ ] **Step 2: Запустить тест и подтвердить падение**

Run: `npx vitest run src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

Expected: FAIL, потому что трековые props и ресурсы ещё не реализованы.

- [ ] **Step 3: Реализовать сериализацию GeoJSON и регистрацию слоёв**

`VehicleTrackLayers.tsx` экспортирует чистые функции `trackSegmentsToGeoJson`, `trackEventsToGeoJson` и `mountVehicleTrackLayers(map, options)`, возвращающую функцию очистки.

```ts
const TRACK_COLORS = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
} as const;

map.addLayer({
  id: 'vehicle-track-lines',
  type: 'line',
  source: 'vehicle-track',
  paint: {
    'line-color': ['get', 'color'],
    'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.95, 0.72],
    'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 7, 5],
  },
  layout: { 'line-cap': 'round', 'line-join': 'round' },
});
```

Добавить отдельный прозрачный hitbox шириной `16`, круги событий, начальную и конечную метки, а также символы направления. Обработчики `mousemove`, `mouseleave`, `click` должны выставлять feature-state, менять курсор и вызывать переданные callbacks. Функция очистки снимает обработчики и удаляет ресурсы только если они существуют.

- [ ] **Step 4: Реализовать доступный popup события**

```tsx
export function TrackEventPopup({
  event,
  count,
}: {
  event: VehicleTrackEventView;
  count: number;
}) {
  return (
    <article aria-label={`Событие: ${event.title}`} className="min-w-56 space-y-2 p-1">
      <div className="flex items-center justify-between gap-3">
        <strong>{event.title}</strong>
        {count > 1 ? <Badge>{count} события</Badge> : null}
      </div>
      <p>{event.timestamp} · {event.speedKph} км/ч</p>
      <p>{event.address}</p>
      <p>{event.description}</p>
    </article>
  );
}
```

- [ ] **Step 5: Подключить слои к `OnlineFleetMap`**

Расширить props:

```ts
export interface OnlineFleetMapProps {
  vehicles: readonly OnlineMapVehicle[];
  selectedVehicleId: string | null;
  trackViewModel: VehicleTrackViewModel | null;
  playbackPoint: VehicleTrackPoint | null;
  selectedEventId: string | null;
  onVehicleSelect: (vehicle: OnlineMapVehicle) => void;
  onEventSelect: (event: VehicleTrackEventView) => void;
  onPlaybackProgressRequest: (event: VehicleTrackEventView) => void;
}
```

После `map.load` смонтировать трековые слои, вызвать `fitBounds` по всем координатам с отступами под правую/нижнюю панель и создать отдельный marker для `playbackPoint`. Наведение на сегмент показывает MapLibre popup с временем начала/конца, средней скоростью и адресом точки `to`; клик по событию открывает `TrackEventPopup` и передаёт событие наверх. Ошибка слоя записывается в локальное состояние и показывает компактное сообщение «Маршрут временно недоступен», не скрывая базовую карту.

- [ ] **Step 6: Запустить тесты MapLibre**

Run: `npx vitest run src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

Expected: PASS; повторный mount/unmount не оставляет обработчиков, слоёв, popup или marker воспроизведения.

- [ ] **Step 7: Зафиксировать картографический слой**

```bash
git add src/modules/online-map/components/VehicleTrackLayers.tsx src/modules/online-map/components/TrackEventPopup.tsx src/modules/online-map/components/OnlineFleetMap.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts
git commit -m "feat: render speed-colored tracks on map"
```

### Task 3: Даты, сводка и воспроизведение в рабочем пространстве

**Files:**
- Create: `src/modules/online-map/components/TrackDateControls.tsx`
- Create: `src/modules/online-map/components/TrackPlayback.tsx`
- Create: `src/modules/online-map/components/TrackDaySummary.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMapClient.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Modify: `src/modules/online-map/components/SelectedVehiclePanel.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

**Interfaces:**
- Consumes: функции и типы Task 1, расширенные `OnlineFleetMapProps` Task 2.
- Produces: полностью управляемый маршрут выбранного автомобиля с датой, быстрыми периодами, событием и прогрессом.

- [ ] **Step 1: Написать падающие интеграционные тесты**

```tsx
it('выбирает последнюю дату автомобиля и передаёт маршрут карте', async () => {
  render(<OnlineMapWorkspace mapComponent={MapProbe} />);
  await user.click(screen.getByRole('button', { name: /А 123 МР 77/i }));
  expect(screen.getByLabelText('Дата маршрута')).toHaveValue('2026-07-29');
  expect(screen.getByText('Сводка маршрута')).toBeInTheDocument();
  expect(lastMapProps.trackViewModel?.vehicleId).toBe('haval-jolion');
});

it('меняет день, синхронизирует событие и ползунок', async () => {
  // выбрать автомобиль, изменить дату, имитировать onEventSelect
  expect(screen.getByRole('slider', { name: 'Положение на маршруте' })).toHaveValue('50');
});

it('закрытие панели очищает маршрут и воспроизведение', async () => {
  await user.click(screen.getByRole('button', { name: 'Закрыть карточку автомобиля' }));
  expect(lastMapProps.trackViewModel).toBeNull();
  expect(screen.queryByLabelText('Положение на маршруте')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Запустить тест и подтвердить падение**

Run: `npx vitest run src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

Expected: FAIL, элементы управления маршрутом отсутствуют.

- [ ] **Step 3: Реализовать управление датой**

```tsx
export function TrackDateControls({
  dates,
  value,
  onChange,
}: {
  dates: readonly string[];
  value: string;
  onChange: (date: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="grid gap-1 text-sm font-medium">
        Дата маршрута
        <select
          aria-label="Дата маршрута"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
        >
          {dates.map((date) => <option key={date} value={date}>{date}</option>)}
        </select>
      </label>
      <div role="group" aria-label="Быстрый период" className="flex gap-2 overflow-x-auto">
        {['Сегодня', 'Вчера', '7 дней'].map((label) => (
          <FilterChip key={label} onClick={() => onQuickPeriod(label)}>{label}</FilterChip>
        ))}
      </div>
    </div>
  );
}
```

Для демонстрационных данных «Сегодня» выбирает первую доступную дату, «Вчера» — вторую, «7 дней» оставляет список всех доступных дат и выбранную текущую.

- [ ] **Step 4: Реализовать сводку и пустое состояние**

```tsx
export function TrackDaySummary({ model }: { model: VehicleTrackViewModel | null }) {
  if (!model) {
    return (
      <EmptyState
        title="За эту дату поездок нет"
        description="Выберите другой день, чтобы посмотреть маршрут."
      />
    );
  }

  return (
    <section aria-labelledby="track-summary-title">
      <h3 id="track-summary-title">Сводка маршрута</h3>
      <dl className="grid grid-cols-2 gap-3">
        <Metric label="Пробег" value={`${model.distanceKm} км`} />
        <Metric label="В пути" value={`${model.durationMinutes} мин`} />
        <Metric label="Макс. скорость" value={`${model.maxSpeedKph} км/ч`} />
        <Metric label="События" value={String(model.events.length)} />
      </dl>
    </section>
  );
}
```

- [ ] **Step 5: Реализовать ручное и автоматическое воспроизведение**

```tsx
export function TrackPlayback({
  progress,
  playing,
  reducedMotion,
  onProgressChange,
  onPlayingChange,
}: TrackPlaybackProps) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        aria-label={playing ? 'Приостановить маршрут' : 'Воспроизвести маршрут'}
        disabled={reducedMotion}
        onClick={() => onPlayingChange(!playing)}
      >
        {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
      </Button>
      <input
        type="range"
        min="0"
        max="100"
        value={progress}
        aria-label="Положение на маршруте"
        onChange={(event) => onProgressChange(Number(event.currentTarget.value))}
        className="min-h-11 flex-1"
      />
    </div>
  );
}
```

В `OnlineMapWorkspace` интервал воспроизведения увеличивает прогресс на `2` каждые `250 ms`, останавливается на `100`, очищается при unmount/смене автомобиля/даты. При reduced motion кнопка автозапуска недоступна с подсказкой, но `input[type=range]` остаётся активным.

- [ ] **Step 6: Интегрировать состояние в workspace и панель**

При выборе автомобиля получить даты через `getVehicleTrackDates`, выбрать первую, построить модель через `buildTrackViewModel`, сбросить `progress=0` и `selectedEventId=null`. При выборе события найти индекс связанной точки и вычислить `progress = index / (points.length - 1) * 100`. Закрытие панели очищает автомобиль, дату, модель, событие и таймер.

На десктопе `TrackDateControls` и `TrackDaySummary` находятся в правой панели; `TrackPlayback` плавает снизу по центру карты. На мобильном все три блока находятся внутри нижней панели с `max-height: 48dvh`, внутренним скроллом и safe-area padding.

- [ ] **Step 7: Запустить компонентные тесты**

Run: `npx vitest run src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

Expected: PASS для выбора последней даты, смены дня, пустой даты, быстрого периода, события, ручного ползунка, reduced motion, сброса при смене автомобиля и закрытия панели.

- [ ] **Step 8: Зафиксировать интерфейс управления**

```bash
git add src/modules/online-map/components/TrackDateControls.tsx src/modules/online-map/components/TrackPlayback.tsx src/modules/online-map/components/TrackDaySummary.tsx src/modules/online-map/components/OnlineFleetMapClient.tsx src/modules/online-map/components/OnlineMapWorkspace.tsx src/modules/online-map/components/SelectedVehiclePanel.tsx src/modules/online-map/components/OnlineMapWorkspace.test.tsx
git commit -m "feat: add track dates and playback controls"
```

### Task 4: Скелетоны, E2E, документация и полная проверка

**Files:**
- Modify: `src/app/(protected)/map/loading.tsx`
- Modify: `tests/online-map.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`

**Interfaces:**
- Consumes: готовый пользовательский поток Tasks 1–3.
- Produces: проверенный адаптивный сценарий и актуальный handoff проекта.

- [ ] **Step 1: Добавить падающие E2E-сценарии**

```ts
test('показывает цветной маршрут, события и воспроизведение', async ({ page }) => {
  await page.goto('/map');
  await page.getByRole('button', { name: /А 123 МР 77/i }).click();
  await expect(page.locator('[data-track-color="green"]')).toBeVisible();
  await expect(page.locator('[data-track-color="yellow"]')).toBeVisible();
  await expect(page.locator('[data-track-color="red"]')).toBeVisible();
  await expect(page.getByLabel('Начало маршрута')).toBeVisible();
  await expect(page.getByLabel('Конец маршрута')).toBeVisible();
  await page.getByLabel('Событие: Заправка').click();
  await expect(page.getByText(/Заправка/)).toBeVisible();
  await expect(page.getByLabel('Положение на маршруте')).not.toHaveValue('0');
});

test('маршрут не создаёт горизонтальную прокрутку на телефоне', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/map');
  await page.getByRole('button', { name: /А 123 МР 77/i }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
```

Для доступного тестового DOM `VehicleTrackLayers` создаёт скрытый контейнер `data-testid="vehicle-track-a11y"` с кнопками событий, начала и финиша; реальная визуализация остаётся в canvas MapLibre.

- [ ] **Step 2: Запустить E2E и подтвердить ожидаемое падение**

Run: `npx playwright test tests/online-map.spec.ts --project=chromium`

Expected: FAIL на отсутствующих трековых элементах/подписях.

- [ ] **Step 3: Обновить загрузочный экран**

В `loading.tsx` сохранить полноэкранную карту и добавить существующие `Skeleton` для:

```tsx
<Skeleton className="h-11 w-full" aria-label="Загружается выбор даты" />
<div className="grid grid-cols-2 gap-3">
  {Array.from({ length: 4 }, (_, index) => (
    <Skeleton key={index} className="h-16 rounded-[var(--radius-md)]" />
  ))}
</div>
<Skeleton className="absolute bottom-4 left-1/2 h-14 w-[min(34rem,calc(100%-2rem))] -translate-x-1/2" />
```

- [ ] **Step 4: Довести E2E до зелёного состояния**

Добавить в E2E проверки:

- линия имеет вычисленную opacity `0.72`;
- событие использует те же координаты, что точка линии, через сериализованные `data-coordinate`;
- наведение на сегмент показывает время, скорость и адрес;
- смена даты меняет `data-track-date`;
- старт воспроизведения двигает marker;
- закрытие панели удаляет трек;
- телефон `390×844` и планшет `1024×768` не имеют горизонтального overflow;
- все действия доступны клавиатурой.

Run: `npx playwright test tests/online-map.spec.ts --project=chromium`

Expected: PASS.

- [ ] **Step 5: Обновить руководство проекта**

В `docs/PROJECT_GUIDE.md` в разделе онлайн-карты зафиксировать:

```md
- Онлайн-карта демонстрирует маршруты пяти тестовых автомобилей минимум за три даты.
- Сегменты окрашиваются по скорости, события привязаны к точкам трека, доступны дата, сводка и воспроизведение.
- Источник маршрутов пока `track-fixtures.ts`; подключение API/MQTT остаётся следующим вертикальным этапом.
```

- [ ] **Step 6: Выполнить полную проверку**

Run:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx playwright test tests/online-map.spec.ts --project=chromium
git diff --check
```

Expected: все команды завершаются с кодом `0`; unit и E2E тесты PASS; `git diff --check` не выводит ошибок.

- [ ] **Step 7: Зафиксировать проверенный пользовательский поток**

```bash
git add src/app/\(protected\)/map/loading.tsx tests/online-map.spec.ts docs/PROJECT_GUIDE.md
git commit -m "test: verify dynamic vehicle tracks"
```

