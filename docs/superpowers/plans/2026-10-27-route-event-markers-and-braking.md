# Route Event Markers And Braking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать утверждённые поинты маршрута Supa Pro и полноценное GPS-событие резкого торможения от детектора до карты и Telegram.

**Architecture:** Чистый доменный детектор создаёт нормализованное событие `HARSH_BRAKING`; существующий цикл синхронизации сохраняет его в `VehicleEvent` и ставит уведомления. История маршрута переводит событие в `harsh-braking`, а MapLibre рисует все маршрутные поинты через единый набор иконок и zoom-выражений с точным якорем. Настройки остаются многоуровневыми: системные значения → компания → автомобиль.

**Tech Stack:** Next.js, React, TypeScript, Prisma/PostgreSQL, MapLibre GL JS, Vitest, Testing Library, Telegram Bot API.

## Global Constraints

- Использовать только название Supa Pro / СУПА ПРО.
- Не менять утверждённый логотип и геометрию маркера автомобиля.
- Не затрагивать посторонние изменения в грязном worktree.
- Все новые доменные ветки покрывать тестом до реализации.
- До миграции production сделать резервную копию БД; выкладка только после целевых тестов и production build.

---

### Task 1: Домен резкого торможения

**Files:**
- Create: `src/modules/telematics/domain/harsh-braking.ts`
- Create: `src/modules/telematics/domain/harsh-braking.test.ts`

**Interfaces:**
- Consumes: GPS samples `{ id, recordedAt, latitude, longitude, speedKph }`.
- Produces: `DetectedBrakingEvent` with signed `peakAccelerationMps2`, start/end speed, duration and point ids.

- [ ] **Step 1: Написать падающие тесты**

Проверить обычное замедление, резкое торможение, критическое торможение, разрыв GPS, выброс и объединение соседних эпизодов.

- [ ] **Step 2: Запустить тест и подтвердить падение**

Run: `npx vitest run src/modules/telematics/domain/harsh-braking.test.ts`

- [ ] **Step 3: Реализовать чистый детектор**

Порог задаётся положительной величиной, расчёт хранит отрицательное ускорение; событие создаётся при `accelerationMps2 <= -threshold` и подтверждается в окне времени.

- [ ] **Step 4: Запустить тест**

Run: `npx vitest run src/modules/telematics/domain/harsh-braking.test.ts`

---

### Task 2: Настройки и схема данных

**Files:**
- Modify: `src/modules/telematics/domain/gps-settings.ts`
- Modify: `src/modules/telematics/domain/gps-settings.test.ts`
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20261027090000_add_harsh_braking_settings/migration.sql`

**Interfaces:**
- Add: `brakingDetectionEnabled`, `harshBrakingThresholdMps2`, `criticalBrakingThresholdMps2`.
- Preserve: company defaults and nullable vehicle overrides.

- [ ] **Step 1: Расширить тесты resolver**
- [ ] **Step 2: Добавить типы, defaults и Prisma поля**
- [ ] **Step 3: Добавить только additive migration**
- [ ] **Step 4: Проверить Prisma**

Run: `npx prisma format && npx prisma validate && npx prisma generate`

---

### Task 3: Сохранение события и запуск из синхронизации

**Files:**
- Create: `src/modules/telematics/glonasssoft/harsh-braking-events.server.ts`
- Create: `src/modules/telematics/glonasssoft/harsh-braking-events.server.test.ts`
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.ts`
- Modify: `src/modules/telematics/glonasssoft/sync-company.server.test.ts`

**Interfaces:**
- Persist: `VehicleEvent.type = 'HARSH_BRAKING'`, provider `SUPA_PRO_GPS`.
- Store: signed negative peak in `maxAccelerationMps2`, plus speeds/duration/track point ids.

- [ ] **Step 1: Написать тесты persistence и dedupe**
- [ ] **Step 2: Реализовать repository adapter по образцу acceleration**
- [ ] **Step 3: Подключить после сохранения новой GPS-точки**
- [ ] **Step 4: Прогнать оба набора тестов**

Run: `npx vitest run src/modules/telematics/glonasssoft/harsh-braking-events.server.test.ts src/modules/telematics/glonasssoft/sync-company.server.test.ts`

---

### Task 4: Telegram для сотрудника и клиента

**Files:**
- Modify: `src/modules/bot-api/gps-event-notifications.ts`
- Modify: `src/modules/bot-api/gps-event-notifications.test.ts`
- Modify: `src/modules/bot-api/operational-alerts.ts`
- Modify: `src/modules/bot-api/operational-alerts.test.ts`
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`

**Interfaces:**
- Extend kind union with `HARSH_BRAKING`.
- Format blue warning with start/end speed, duration, vehicle, driver, time and action.

- [ ] **Step 1: Добавить падающие format/validation/queue tests**
- [ ] **Step 2: Расширить unions и payload validation**
- [ ] **Step 3: Добавить единый формат сообщений**
- [ ] **Step 4: Запустить целевые тесты**

Run: `npx vitest run src/modules/bot-api/gps-event-notifications.test.ts src/modules/bot-api/operational-alerts.test.ts src/modules/bot-api/notifications.test.ts`

---

### Task 5: История маршрута и нормализация UI

**Files:**
- Modify: `src/modules/online-map/track-types.ts`
- Modify: `src/modules/online-map/server/track-history.ts`
- Modify: `src/modules/online-map/server/track-history.test.ts`
- Modify: `src/modules/online-map/track-model.ts`
- Modify: `src/modules/online-map/track-model.test.ts`
- Modify: `src/modules/events/normalizers.ts`
- Modify: `src/modules/events/normalizers.test.ts`

**Interfaces:**
- Add UI event type `harsh-braking`.
- Metric labels: acceleration `40 → 72 / 3.8 с`, braking `92 → 48 / 2.6 с`, speeding `+15` when limit metadata exists, otherwise speed.

- [ ] **Step 1: Добавить тесты query и normalizers**
- [ ] **Step 2: Маппить `HARSH_BRAKING` в маршрут**
- [ ] **Step 3: Сохранить точную GPS-координату и время события**
- [ ] **Step 4: Запустить тесты модели и истории**

Run: `npx vitest run src/modules/online-map/server/track-history.test.ts src/modules/online-map/track-model.test.ts src/modules/events/normalizers.test.ts`

---

### Task 6: Утверждённая визуальная система маркеров

**Files:**
- Modify: `src/modules/online-map/components/VehicleTrackLayers.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`
- Modify: `src/modules/online-map/components/OnlineFleetMap.module.css`

**Interfaces:**
- Start green, finish graphite/checkered, speeding red, acceleration orange, braking blue.
- Each pin has a short stem and exact anchor dot at the GPS point.
- Zoom 11–12: `0.55–0.6` opacity and reduced size; zoom 15–16: full size/opacity and labels.
- Selected marker remains full opacity.
- Dark outline: `#343438`; light outline: off-white with thin graphite hairline.

- [ ] **Step 1: Добавить GeoJSON/icon/paint-expression tests**
- [ ] **Step 2: Добавить `harsh-braking` icon and color**
- [ ] **Step 3: Реализовать thin theme-aware contour and exact anchor**
- [ ] **Step 4: Добавить zoom expressions for size/opacity/labels**
- [ ] **Step 5: Проверить cleanup MapLibre resources**

Run: `npx vitest run src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`

---

### Task 7: Легенда, карточка события и доступность

**Files:**
- Modify: `src/modules/online-map/components/TrackSpeedLegend.tsx`
- Modify: `src/modules/online-map/components/TrackSpeedLegend.test.tsx`
- Modify: `src/modules/online-map/components/TrackEventList.tsx`

- [ ] **Step 1: Добавить синюю легенду резкого торможения**
- [ ] **Step 2: Объяснить все три GPS-события без формул**
- [ ] **Step 3: Добавить читаемую карточку события и screen-reader labels**
- [ ] **Step 4: Запустить component tests**

Run: `npx vitest run src/modules/online-map/components/TrackSpeedLegend.test.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.tsx`

---

### Task 8: Полная проверка и безопасная выкладка

**Files:**
- Verify only unless a regression requires a scoped fix.

- [ ] **Step 1: Прогнать focused suite**

Run: `npx vitest run src/modules/telematics src/modules/bot-api/gps-event-notifications.test.ts src/modules/bot-api/operational-alerts.test.ts src/modules/online-map`

- [ ] **Step 2: Проверить типы и production build**

Run: `npm run typecheck`

Run: `npm run build`

- [ ] **Step 3: Проверить diff только по задаче**

Run: `git diff --check`

- [ ] **Step 4: Сделать backup production DB и применить миграцию**
- [ ] **Step 5: Выполнить zero-downtime deploy Supa Pro**
- [ ] **Step 6: Canary: health, карта, worker, Telegram delivery, отсутствие новых ошибок**

## Self-review

- [ ] В плане нет заглушек или неописанных веток `HARSH_BRAKING`.
- [ ] Типы одинаковы в detector, DB, queue, Telegram и map UI.
- [ ] Маркеры не перекрывают точку трека и уменьшаются по zoom.
- [ ] Светлая/тёмная тема не меняют семантические цвета событий.
- [ ] Миграция additive и обратимо безопасна для текущего приложения.
- [ ] Production не затронут до успешных тестов и build.
