# Map Loading Dot Pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить утверждённую точечную подложку Supa Pro на оба этапа загрузки онлайн-карты.

**Architecture:** Изолированный компонент рендерит доступное состояние динамической загрузки. Его CSS Module также используется контейнером MapLibre, поэтому один паттерн покрывает загрузку JS и тайлов без дополнительного изображения или запроса.

**Tech Stack:** Next.js App Router, React, CSS Modules, Vitest, Testing Library.

## Global Constraints

- Использовать только имя Supa Pro; логотип не изменять и не добавлять в паттерн.
- Тёмный фон строго `#343438`, светлый фон строго `#E0EFFF`, акцент `#0067FF`.
- Не изменять функции карты, маршрута, ошибок или управления.

---

### Task 1: Общая точечная подложка загрузки карты

**Files:**

- Create: `src/modules/online-map/components/OnlineFleetMapClient.test.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMapClient.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMap.tsx`
- Modify: `src/modules/online-map/components/OnlineFleetMap.module.css`

**Interfaces:**

- Produces: CSS class `mapLoadingPattern`, shared by the `next/dynamic` fallback and the MapLibre container.

- [ ] **Step 1: Write the failing test**

```tsx
render(<OnlineFleetMapClient {...({} as OnlineFleetMapProps)} />);
expect(screen.getByRole('status', { name: 'Карта загружается' }).className).toContain(
  'mapLoadingPattern',
);
expect(cssSource).toContain('#343438');
expect(cssSource).toContain('#e0efff');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/online-map/components/OnlineFleetMapClient.test.tsx`
Expected: FAIL because the fallback does not use `mapLoadingPattern` and the approved colors are absent.

- [ ] **Step 3: Implement the minimal component and CSS Module**

Define the seamless dot pattern with `radial-gradient`, replace the current pulse fallback, and attach `styles.mapLoadingPattern` to the MapLibre container.

- [ ] **Step 4: Run focused regression tests**

Run: `npx vitest run src/modules/online-map/components/OnlineFleetMapClient.test.tsx src/modules/online-map/components/OnlineFleetMap.cleanup.test.ts`
Expected: both test files pass.

- [ ] **Step 5: Run formatting and type checks**

Run: `npx prettier --check src/modules/online-map/components/OnlineFleetMapClient.test.tsx src/modules/online-map/components/OnlineFleetMapClient.tsx src/modules/online-map/components/OnlineFleetMap.tsx src/modules/online-map/components/OnlineFleetMap.module.css`

Run: `npm run typecheck`
Expected: no new errors from the online-map files.
