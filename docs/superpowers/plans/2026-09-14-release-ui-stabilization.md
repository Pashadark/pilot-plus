# Release UI Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current СУПА ПРО interface usable on tablet and narrow-desktop widths without redesigning the product or changing business behavior.

**Architecture:** Keep the existing Pilot+ components and data contracts. Add one responsive shell decision, reuse native disclosure semantics for advanced filters, switch data tables to their existing mobile cards at a wider breakpoint, and introduce a pure notification grouping projection before rendering.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve the current blue Pilot+ design system, light/dark themes, permissions, links and business data.
- Do not overwrite unrelated uncommitted work in the shared working tree.
- Use test-first changes and run lint, typecheck, focused unit tests and production build.
- Verify at 390, 768, 850, 1024, 1280 and 1440 px.
- Do not add dependencies.

---

### Task 1: Responsive application shell

**Files:**
- Modify: `src/shared/components/app-shell/ShellFrame.tsx`
- Modify: `src/shared/components/app-shell/Sidebar.tsx`
- Test: `src/shared/components/app-shell/ShellFrame.test.tsx`
- Test: `src/shared/components/app-shell/Sidebar.test.ts`

**Interfaces:**
- Consumes: persisted `pilot-sidebar-expanded` preference.
- Produces: `effectiveExpanded: boolean`, which is always false below 1280 px and follows the persisted preference at 1280 px and above.

- [ ] **Step 1: Write failing shell tests**

Add assertions that the shell exposes the compact sidebar width for tablet layouts and that full expansion is gated by the wide-desktop media query.

- [ ] **Step 2: Verify the focused tests fail**

Run: `npx vitest run src/shared/components/app-shell/ShellFrame.test.tsx src/shared/components/app-shell/Sidebar.test.ts`

Expected: FAIL because the current shell follows only local storage and expands from `md`.

- [ ] **Step 3: Implement the responsive preference**

Use `useSyncExternalStore` with `matchMedia('(min-width: 1280px)')`, calculate `effectiveExpanded = wideDesktop && preferredExpanded`, pass it to `Sidebar`, and hide the expand/collapse control when it cannot affect tablet layout.

- [ ] **Step 4: Verify the shell tests pass**

Run the command from Step 2. Expected: PASS.

### Task 2: Earlier card layouts for operational tables

**Files:**
- Modify: `src/modules/rentals/components/RentalListPage.tsx`
- Modify: `src/modules/clients/components/ClientGrid.tsx`
- Modify: `src/modules/maintenance/components/MaintenanceWorkspace.tsx`
- Test: `src/modules/rentals/components/RentalListPage.test.tsx`
- Test: `src/modules/clients/components/ClientGrid.test.tsx`
- Test: `src/modules/maintenance/components/MaintenanceWorkspace.test.ts`

**Interfaces:**
- Consumes: existing desktop row and mobile-card representations.
- Produces: cards below 1280 px and tables at 1280 px and above, with unchanged links, statuses and actions.

- [ ] **Step 1: Write failing breakpoint tests**

Assert that table wrappers use `xl:block` and card wrappers use `xl:hidden` for rentals, clients and maintenance.

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx src/modules/clients/components/ClientGrid.test.tsx src/modules/maintenance/components/MaintenanceWorkspace.test.ts`

Expected: FAIL because the current breakpoint is `md`.

- [ ] **Step 3: Change only presentation breakpoints**

Replace the paired `md:block` / `md:hidden` presentation classes with `xl:block` / `xl:hidden`. Do not change table columns or card business content.

- [ ] **Step 4: Verify the tests pass**

Run the command from Step 2. Expected: PASS.

### Task 3: Content-first filter disclosures

**Files:**
- Modify: `src/modules/vehicles/components/VehicleFilters.tsx`
- Modify: `src/modules/fines/components/FinesPage.tsx`
- Modify: `src/modules/maintenance/components/MaintenanceWorkspace.tsx`
- Test: `src/modules/vehicles/components/VehicleFilters.test.tsx`
- Test: `src/modules/fines/components/FinesPage.test.tsx`
- Test: `src/modules/maintenance/components/MaintenanceWorkspace.test.ts`

**Interfaces:**
- Consumes: existing filter values and callbacks/query parameters.
- Produces: always-visible search and primary status, plus an accessible `details` disclosure labelled `Все фильтры` with the number of active advanced filters.

- [ ] **Step 1: Write failing interaction tests**

Assert that advanced controls are inside a disclosure, its accessible label includes the active-filter count, and reset still clears every value.

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run src/modules/vehicles/components/VehicleFilters.test.tsx src/modules/fines/components/FinesPage.test.tsx src/modules/maintenance/components/MaintenanceWorkspace.test.ts`

Expected: FAIL because every filter is currently rendered at the top level.

- [ ] **Step 3: Implement disclosures without changing filtering**

Keep the current fields, names and callbacks. Recompose them into a compact primary row and a native disclosure; use existing Button/FormControl styles and no new state where native `details` is sufficient.

- [ ] **Step 4: Verify the tests pass**

Run the command from Step 2. Expected: PASS.

### Task 4: Grouped notification preview

**Files:**
- Create: `src/modules/notifications/group-notifications.ts`
- Create: `src/modules/notifications/group-notifications.test.ts`
- Modify: `src/modules/notifications/NotificationCenter.tsx`
- Modify: `src/modules/notifications/NotificationCenter.test.tsx`

**Interfaces:**
- Produces: `groupNotifications(notifications: readonly PilotNotification[]): readonly NotificationGroup[]`.
- `NotificationGroup` contains `key`, `representative`, `notificationIds`, `count`, and `latestOccurredAt`.

- [ ] **Step 1: Write failing pure projection tests**

Cover identical consecutive vehicle updates, different objects/links, different categories, and stable newest-first output.

- [ ] **Step 2: Verify the grouping test fails**

Run: `npx vitest run src/modules/notifications/group-notifications.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal deterministic grouping**

Group by category, title, href, actor and company within the supplied result set. Preserve all underlying IDs for mark-read operations and use the newest notification as the representative.

- [ ] **Step 4: Write and run failing NotificationCenter tests**

Assert that six identical updates render once as `6 событий`, marking the group reads every underlying ID, and only ten groups appear until `Показать все` is activated.

- [ ] **Step 5: Render grouped notifications**

Use the projection after category filtering, keep the existing anchored popover, add a compact count badge and a single `Показать все` control.

- [ ] **Step 6: Verify notification tests pass**

Run: `npx vitest run src/modules/notifications/group-notifications.test.ts src/modules/notifications/NotificationCenter.test.tsx`

Expected: PASS.

### Task 5: Profile and small responsive polish

**Files:**
- Modify: `src/modules/profile/ProfileWorkspace.tsx`
- Modify: `src/modules/profile/ProfileWorkspace.test.tsx`
- Modify: `src/shared/components/app-shell/Header.tsx`
- Modify: `src/shared/components/app-shell/Header.test.tsx`
- Modify: `src/modules/clients/components/ClientPage.tsx`
- Test: `src/modules/clients/components/ClientPage.test.tsx`

**Interfaces:**
- Consumes: current profile and theme state.
- Produces: readable identity content at tablet width, user-facing names `Новый интерфейс` and `Классический интерфейс`, and a non-wrapping client action.

- [ ] **Step 1: Write failing copy and responsive-class tests**

Assert the profile identity does not use tablet truncation, status layout can wrap below identity, internal `Obsidian` copy is absent, and the add-client label is non-wrapping.

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run src/modules/profile/ProfileWorkspace.test.tsx src/shared/components/app-shell/Header.test.tsx src/modules/clients/components/*.test.tsx`

Expected: FAIL on current copy/classes.

- [ ] **Step 3: Apply presentation-only changes**

Move the two status badges below/alongside identity at a safe breakpoint, replace internal theme wording, and add `whitespace-nowrap` to the client button.

- [ ] **Step 4: Verify the tests pass**

Run the command from Step 2. Expected: PASS.

### Task 6: Integrated verification

**Files:**
- Modify only tests or implementation files from Tasks 1–5 when a regression is found.

- [ ] **Step 1: Run focused unit tests**

Run all test files listed above. Expected: PASS with no React warnings.

- [ ] **Step 2: Run static checks**

Run: `npm run lint`, `npm run typecheck`, and `npm run format:check`. Expected: exit code 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`. Expected: exit code 0.

- [ ] **Step 4: Run targeted browser verification**

Run the authenticated shell, dashboard, rentals, vehicles, clients, fines, maintenance and profile Playwright scenarios at the required widths. Expected: no clipped primary action, no unexpected horizontal page overflow, and no hydration error.

- [ ] **Step 5: Inspect the final diff**

Run `git diff --check` and review only files in this plan. Confirm no unrelated user change was reverted.
