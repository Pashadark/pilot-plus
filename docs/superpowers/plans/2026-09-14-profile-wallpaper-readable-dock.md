# Profile Wallpaper Readable Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать утверждённый вариант 2 шапки профиля с гарантированно читаемой нижней панелью поверх любых обоев.

**Architecture:** Существующий `ProfileWorkspace` сохраняет `next/image`, редакторы аватара и фона. Меняется только responsive-композиция hero-блока; новые данные и зависимости не добавляются.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript, Tailwind CSS 4, Vitest, Testing Library.

## Global Constraints

- Использовать существующие токены Pilot+ и компоненты.
- Не показывать логотип, «Управление автопарком» и город в hero-блоке.
- Сохранить светлую и тёмную темы и мобильную адаптацию.

---

### Task 1: Защитная панель профиля

**Files:**
- Modify: `src/modules/profile/ProfileWorkspace.tsx`
- Test: `src/modules/profile/ProfileWorkspace.test.tsx`

**Interfaces:**
- Consumes: `ProfileViewModel`
- Produces: responsive hero с `data-testid="profile-identity-dock"`

- [ ] **Step 1: Write the failing test**

Добавить проверку наличия `profile-identity-dock`, двух статусных значений внутри него и отсутствия «Управление автопарком».

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/modules/profile/ProfileWorkspace.test.tsx`

Expected: FAIL, потому что `profile-identity-dock` ещё не существует.

- [ ] **Step 3: Write minimal implementation**

Перестроить hero в область обоев и нижнюю защищённую панель, сохранив редакторы, данные и доступность.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/modules/profile/ProfileWorkspace.test.tsx`

Expected: PASS.

- [ ] **Step 5: Verify production build and responsive rendering**

Run: `npm run typecheck`, `npm run build`, затем снять desktop и mobile screenshots.

