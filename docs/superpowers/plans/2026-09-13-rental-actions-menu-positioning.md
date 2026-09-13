# Rental Actions Menu Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the rental actions menu visually attached to its trigger while the page or a nested container scrolls.

**Architecture:** Preserve the existing body portal and fixed positioning so the menu cannot be clipped by the table. Replace close-on-viewport-change behavior with a requestAnimationFrame-coalesced position recalculation based on the trigger and actual menu dimensions.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, Next.js 16.

## Global Constraints

- Keep the existing 11 actions, grouping, keyboard navigation and focus restoration.
- Keep the menu within a 12 px viewport inset.
- Scroll and resize must reposition, not close, the open menu.
- Do not add dependencies or change unrelated rental behavior.

---

### Task 1: Anchor the menu during viewport changes

**Files:**
- Modify: `src/modules/rentals/components/RentalRowActionsMenu.tsx`
- Test: `src/modules/rentals/components/RentalRowActionsMenu.test.tsx`

**Interfaces:**
- Consumes: `triggerRef`, `menuRef`, `open`, browser `scroll` and `resize` events.
- Produces: stable `{ top, left }` fixed coordinates recalculated via `requestAnimationFrame`.

- [ ] **Step 1: Write the failing test**

Add a test that opens the menu, changes the trigger rectangle, dispatches a captured scroll event and asserts that the menu remains mounted with updated `top` and `left` styles.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/rentals/components/RentalRowActionsMenu.test.tsx`

Expected: the menu is removed after `scroll`, proving the current bug.

- [ ] **Step 3: Implement the minimal fix**

Measure the actual menu when available, align its top to the trigger, clamp both axes to the viewport, and replace the close handler with an animation-frame-scheduled position update. Cancel a pending frame during effect cleanup.

- [ ] **Step 4: Verify component and project**

Run:

```text
npx vitest run src/modules/rentals/components/RentalRowActionsMenu.test.tsx src/modules/rentals/components/RentalListPage.test.tsx
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit successfully; lint may retain only the existing unrelated warnings.

- [ ] **Step 5: Deploy and inspect**

Create a new release copied from the current production release, overlay the two changed source files, build it with the service environment, switch `/opt/pilot-plus/current`, restart `pilot-plus`, and verify the live menu remains open and attached after scrolling.
