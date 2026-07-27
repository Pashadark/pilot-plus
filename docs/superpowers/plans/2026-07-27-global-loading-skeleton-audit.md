# Global Loading Skeleton Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Обеспечить геометрически корректный skeleton для каждого Pilot+ маршрута, который ожидает серверные или внешние данные.

**Architecture:** Аудит выполняется отдельно от бизнес-функциональности. Маршруты получают сегментные `loading.tsx` на основе общих Pilot+ skeleton-компонентов; повторяющиеся геометрии выносятся в shared только после подтверждённого повторного использования.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Pilot+ `Skeleton`, Vitest, Playwright.

## Global Constraints

- Не менять бизнес-логику, запросы, миграции или seed.
- Skeleton повторяет итоговый макет и резервирует его высоту.
- Один spinner или текст «Загрузка» не считается skeleton.
- Весь доступный текст на русском.
- Не добавлять зависимости.
- Проверить desktop и mobile, отсутствие layout shift и горизонтального overflow.

---

### Task 1: Инвентаризация и общий контракт

**Files:**
- Create: `src/shared/ui/route-skeletons.tsx`
- Create: `src/shared/ui/route-skeletons.test.tsx`
- Modify: `src/shared/ui/index.ts`
- Create: `docs/quality/loading-skeleton-inventory.md`

- [ ] **Step 1: Build route inventory**

List every protected route and classify it as:

- synchronous/static — skeleton not required;
- server/external data — route skeleton required;
- existing adequate;
- existing incomplete;
- missing.

The initial expected data routes are `/`, `/vehicles`, `/vehicles/[id]`, `/maintenance`,
`/wash`, `/devices`, `/devices/[id]`, `/events`, `/profile`, `/system`.

- [ ] **Step 2: Write shared geometry tests**

Test reusable `StatsSkeleton`, `FilterSkeleton`, `ListRowsSkeleton`, `DetailPanelsSkeleton`,
`MapSkeleton` and `FormSkeleton`. Assert they use `Skeleton`, expose an accessible loading label,
and accept bounded counts.

- [ ] **Step 3: Implement only proven shared patterns**

Export focused components. Do not create a universal configuration object or business-specific
props.

- [ ] **Step 4: Verify and commit**

```powershell
npx vitest run src/shared/ui/route-skeletons.test.tsx
npm run typecheck
npx eslint src/shared/ui
git add src/shared/ui docs/quality/loading-skeleton-inventory.md
git commit -m "feat: define route loading skeletons"
```

---

### Task 2: Dashboard and operational routes

**Files:**
- Create: `src/app/(protected)/loading.tsx`
- Create or Modify: `src/app/(protected)/profile/loading.tsx`
- Create or Modify: `src/app/(protected)/system/loading.tsx`
- Modify: `src/app/(protected)/maintenance/loading.tsx`
- Modify: `src/app/(protected)/wash/loading.tsx`
- Create: `src/app/(protected)/loading-states.test.tsx`

- [ ] **Step 1: Write geometry tests**

Assert dashboard KPI/map/feed/chart blocks, profile form blocks, system status rows and
maintenance/wash list/calendar blocks match their page structure.

- [ ] **Step 2: Implement segment loading files**

Use shared route skeletons plus domain geometry. Keep route headers stable where possible.

- [ ] **Step 3: Verify and commit**

```powershell
npx vitest run "src/app/(protected)/loading-states.test.tsx"
npm run typecheck
npx eslint "src/app/(protected)"
git add "src/app/(protected)"
git commit -m "feat: complete operational loading states"
```

---

### Task 3: Fleet, devices and events routes

**Files:**
- Modify: `src/app/(protected)/vehicles/loading.tsx`
- Modify: `src/app/(protected)/vehicles/[id]/loading.tsx`
- Modify: `src/app/(protected)/devices/loading.tsx`
- Modify: `src/app/(protected)/devices/[id]/loading.tsx`
- Modify: `src/app/(protected)/events/loading.tsx`
- Create: `src/app/(protected)/domain-loading-states.test.tsx`

- [ ] **Step 1: Write route parity tests**

Assert:

- list routes reserve KPI, filters and rows/cards;
- detail routes reserve header, overview panels, map and history;
- events reserve KPI, filters and eight timeline cards;
- all route skeleton roots expose `aria-label="Загрузка данных"`.

- [ ] **Step 2: Implement geometry parity**

Reuse shared patterns and keep desktop/mobile grid breakpoints aligned with the real pages.

- [ ] **Step 3: Verify and commit**

```powershell
npx vitest run "src/app/(protected)/domain-loading-states.test.tsx"
npm run typecheck
npx eslint "src/app/(protected)"
git add "src/app/(protected)"
git commit -m "feat: align domain loading skeletons"
```

---

### Task 4: Visual/E2E audit and documentation

**Files:**
- Create: `tests/loading-skeletons.spec.ts`
- Modify: `docs/quality/loading-skeleton-inventory.md`
- Modify: `docs/PROJECT_GUIDE.md`

- [ ] **Step 1: Add deterministic loading E2E support**

Use a test-only server delay supported by existing environment conventions; never ship a
production delay. Navigate each data route and assert skeleton visibility before final content.

- [ ] **Step 2: Check desktop and mobile**

At desktop and 390×844 assert no horizontal overflow, stable main container dimensions and final
content replacement. Do not use pixel-perfect screenshot thresholds.

- [ ] **Step 3: Finish inventory**

Every audited route must end as `adequate` or have a documented reason why it is synchronous and
does not need a skeleton. No `unknown` rows remain.

- [ ] **Step 4: Full verification and commit**

```powershell
npm run test:unit
npm run lint
npm run typecheck
npm run build
npx playwright test tests/loading-skeletons.spec.ts --workers=1
git diff --check
git add tests/loading-skeletons.spec.ts docs/quality/loading-skeleton-inventory.md docs/PROJECT_GUIDE.md
git commit -m "test: verify global loading skeletons"
```

