# Online Map Side Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Обновить левую и правую панели `/map` по утверждённому макету, не изменяя карту и её поведение.

**Architecture:** Существующий server query расширяет сериализуемый `OnlineMapVehicle` реальными данными изображения, пробега, ТО и активной аренды. Компоненты панелей используют эти поля и текущий рассчитанный маршрут; MapLibre-компоненты и track-модель остаются без изменений.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript strict, Tailwind CSS 4, Prisma 6, Vitest/Testing Library.

## Global Constraints

- Продукт называется только **Supa Pro**; логотип не изменять.
- Не менять MapLibre, слои, маркеры, треки или playback.
- Поддерживать светлую и тёмную темы только через существующие CSS variables.
- Не показывать фиктивные показатели; использовать явный fallback «Нет данных».
- Не передавать телефон клиента в DTO карты.

---

### Task 1: Расширить DTO карты реальными данными

**Files:**
- Modify: `src/modules/online-map/types.ts`
- Modify: `src/modules/online-map/server/queries.ts`
- Test: `src/modules/online-map/server/queries.test.ts`

**Interfaces:**
- Produces: `OnlineMapVehicle.image`, `odometerKm`, `dailyDistanceKm`, `maintenance`, расширенный `currentRental`.
- Consumes: `resolveRentalDepositState`, московскую дату, текущие tenant-scoped Prisma relations.

- [ ] **Step 1: Написать падающий query-тест**

Добавить row с primary image, поездками текущего дня, плановым ТО, active rental, платежом и операцией. Ожидать сериализованные значения и проверить, что query запрашивает только разрешённые relations.

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npx vitest run src/modules/online-map/server/queries.test.ts`

Expected: FAIL — новые поля отсутствуют.

- [ ] **Step 3: Расширить тип и query**

Добавить nullable-поля DTO. Для московского дня вычислить границы через `getPilotBusinessDateParts` и `parsePilotDateTimeLocal`; суммировать `Trip.distanceKm`. Общий пробег брать из последней позиции с fallback на `Vehicle.odometerKm`. ТО выбирать из ближайшей незавершённой maintenance-записи. Аренду и залог отображать только из фактических данных.

- [ ] **Step 4: Запустить query-тест**

Run: `npx vitest run src/modules/online-map/server/queries.test.ts`

Expected: PASS.

### Task 2: Реализовать плотные карточки левого автопарка

**Files:**
- Create: `src/modules/online-map/components/FleetVehicleCard.tsx`
- Modify: `src/modules/online-map/components/FleetVehicleRail.tsx`
- Test: `src/modules/online-map/components/FleetVehicleRail.test.tsx`

**Interfaces:**
- Consumes: расширенный `OnlineMapVehicle`, точный `selectedDayDistanceKm` для выбранной машины.
- Produces: доступную карточку с номером, badges, телематикой и двумя progress bars.

- [ ] **Step 1: Добавить падающие component-тесты**

Проверить отображение ТО, низкого топлива, дневного/общего пробега, лимита и честных fallback при отсутствии телематики.

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `npx vitest run src/modules/online-map/components/FleetVehicleRail.test.tsx`

Expected: FAIL — новые подписи и progress bars отсутствуют.

- [ ] **Step 3: Создать `FleetVehicleCard` и подключить его**

Сохранить button/aria-current, статусную полосу и выбор. Использовать семантические токены, реальный белый госномер и рассчитанные проценты только при полных данных.

- [ ] **Step 4: Запустить component-тест**

Run: `npx vitest run src/modules/online-map/components/FleetVehicleRail.test.tsx`

Expected: PASS.

### Task 3: Реализовать фотографический hero и сводку справа

**Files:**
- Create: `src/modules/online-map/components/TrackEventSummary.tsx`
- Modify: `src/modules/online-map/components/SelectedVehiclePanel.tsx`
- Modify: `src/modules/online-map/components/OnlineMapWorkspace.tsx`
- Test: `src/modules/online-map/components/SelectedVehiclePanel.test.tsx`
- Test: `src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

**Interfaces:**
- Consumes: расширенный `OnlineMapVehicle` и `VehicleTrackPeriodViewModel`.
- Produces: hero с фото, быстрые ссылки, реальные live metrics, rental summary и compact event counters.

- [ ] **Step 1: Добавить падающие тесты правой панели**

Проверить `img` с alt, ссылку `/vehicles/:id`, ссылку аренды, четыре live metrics, срок/ставку/залог и счётчики событий.

- [ ] **Step 2: Запустить тесты и подтвердить RED**

Run: `npx vitest run src/modules/online-map/components/SelectedVehiclePanel.test.tsx src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

Expected: FAIL — hero и event summary отсутствуют.

- [ ] **Step 3: Реализовать правую панель**

Использовать обычный `<img>` для уже нормализованного/защищённого `localPath`, чтобы не отправлять приватный URL через image optimizer. Сохранить mobile collapse, scroll и существующие slots маршрута. Перед подробными событиями вставить `TrackEventSummary`.

- [ ] **Step 4: Запустить targeted regression**

Run: `npx vitest run src/modules/online-map/server/queries.test.ts src/modules/online-map/components/FleetVehicleRail.test.tsx src/modules/online-map/components/SelectedVehiclePanel.test.tsx src/modules/online-map/components/OnlineMapWorkspace.test.tsx`

Expected: PASS.

### Task 4: Финальная проверка

**Files:**
- Verify only.

- [ ] **Step 1: Проверить типы и lint**

Run: `npm run typecheck && npm run lint`

Expected: оба процесса завершаются с exit code 0.

- [ ] **Step 2: Запустить unit regression**

Run: `npm run test:unit`

Expected: 0 failed tests.

- [ ] **Step 3: Собрать production bundle**

Run: `npm run build`

Expected: успешная Next.js production build; известное NFT warning допустимо.

- [ ] **Step 4: Визуально проверить обе темы**

Открыть `/map` в светлой и тёмной темах на desktop и mobile, проверить фото, progress bars, скролл, отсутствие горизонтального переполнения и неизменность карты.

