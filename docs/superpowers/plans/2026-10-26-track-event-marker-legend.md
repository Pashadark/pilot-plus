# Track Event Marker Legend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в карточку шкалы скорости понятную легенду поинтов превышения и резкого разгона.

**Architecture:** Изменение остаётся внутри существующего `TrackSpeedLegend`. Две локальные SVG-пиктограммы получают видимые подписи; тест фиксирует пользовательский текст и назначение событий.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Использовать только название Supa Pro / СУПА ПРО.
- Не менять логотип, геометрию карты и шкалу скоростей.
- Не добавлять тени и свечение.

---

### Task 1: Добавить легенду GPS-событий

**Files:**
- Modify: `src/modules/online-map/components/TrackSpeedLegend.tsx`
- Test: `src/modules/online-map/components/TrackSpeedLegend.test.tsx`

**Interfaces:**
- Consumes: существующий компонент `TrackSpeedLegend(): JSX.Element`.
- Produces: две видимые подписи «Превышение» и «Резкий разгон» и общий поясняющий текст.

- [ ] **Step 1: Дополнить тест ожидаемыми подписями и пояснением**

```tsx
expect(screen.getByText('Превышение')).toBeTruthy();
expect(screen.getByText('Резкий разгон')).toBeTruthy();
expect(screen.getByText(/Это GPS-события, а не подтверждённые штрафы/)).toBeTruthy();
```

- [ ] **Step 2: Запустить тест и подтвердить падение**

Run: `npx vitest run src/modules/online-map/components/TrackSpeedLegend.test.tsx`
Expected: FAIL, потому что новые подписи ещё не отрисовываются.

- [ ] **Step 3: Добавить два компактных маркера и пояснение**

Добавить под диапазонами скорости строку из двух элементов: красный круг со спидометром и оранжевый скруглённый ромб с двойной стрелкой. SVG должны быть декоративными (`aria-hidden="true"`), а подписи — обычным текстом.

- [ ] **Step 4: Запустить целевой тест**

Run: `npx vitest run src/modules/online-map/components/TrackSpeedLegend.test.tsx`
Expected: PASS.

- [ ] **Step 5: Проверить форматирование изменённых файлов**

Run: `npx prettier --check src/modules/online-map/components/TrackSpeedLegend.tsx src/modules/online-map/components/TrackSpeedLegend.test.tsx`
Expected: оба файла соответствуют форматированию.
