# Workday Three-Card Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tall workday cards with the approved three-across rectangular layout and remove GPS-loss alerts from the carousel.

**Architecture:** Keep the existing carousel component and data contract. Filter GPS-loss attention items in the pure carousel mapper, then reshape only the workday CSS so routing, modals, date loading and mobile swipe remain unchanged.

**Tech Stack:** React 19, Next.js 16, TypeScript, CSS, Vitest, Testing Library.

## Global Constraints

- Desktop shows exactly three equal cards.
- The event badge stays in the current top-right position.
- GPS-loss attention is excluded only from this carousel.
- No red inset stripe or danger card shadow.
- Preserve mobile swipe and accessible arrow controls.

---

### Task 1: Filter GPS-loss carousel items

**Files:**
- Modify: `src/modules/dashboard/workday-carousel.ts`
- Test: `src/modules/dashboard/workday-carousel.test.ts`

**Interfaces:**
- Consumes: `DashboardAttentionItemDto[]` in `buildWorkdayCarouselItems`.
- Produces: `WorkdayCarouselItem[]` without attention items whose title reports missing GPS signal.

- [ ] **Step 1: Write the failing test**

Add a test passing one GPS-loss attention and one unrelated important attention, then expect only the unrelated attention in the result.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/dashboard/workday-carousel.test.ts`
Expected: FAIL because GPS attention is present.

- [ ] **Step 3: Write minimal implementation**

Add a focused predicate for GPS-loss attention based on its existing stable title and filter it before mapping attention items.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/dashboard/workday-carousel.test.ts`
Expected: PASS.

### Task 2: Apply the approved rectangular layout

**Files:**
- Modify: `src/app/workday.css`

**Interfaces:**
- Preserve `.workday-event-grid`, `.workday-event-card`, `.workday-event-status` and carousel arrow class names.

- [ ] **Step 1: Keep the three-column grid**

Set desktop columns to `calc((100% - 28px) / 3)` and reduce card height while retaining scroll snap.

- [ ] **Step 2: Reshape the card**

Use a compact left-image/right-information layout, 14–16px radius, neutral border and no danger inset shadow.

- [ ] **Step 3: Preserve responsive behavior**

Keep two columns at the existing tablet breakpoint and an 88% swipe card on mobile.

### Task 3: Verify and deploy

**Files:**
- No source additions.

**Interfaces:**
- Production release remains behind `/opt/pilot-plus/current` with the previous release retained.

- [ ] **Step 1: Run focused tests and checks**

Run the carousel/component tests, `npm run typecheck`, scoped ESLint and `npm run build`; require zero failures in scoped checks.

- [ ] **Step 2: Deploy an isolated release**

Copy the current production release, overlay only verified files, build, atomically switch the symlink and automatically roll back on failed health check.

- [ ] **Step 3: Verify production visually**

Confirm three visible cards, top-right badges, no GPS carousel cards and no red left stripe.
