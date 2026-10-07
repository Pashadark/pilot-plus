# Rental Booking Drawer Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rental booking drawer close immediately and match the approved SUPA PRO workflow design.

**Architecture:** Keep the existing booking state machine and server actions. Add local drawer visibility for immediate dismissal, extract the workflow rail into a focused presentational component, and restyle the client search/action row with existing semantic tokens.

**Tech Stack:** React, Next.js App Router, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Use only existing SUPA PRO semantic tokens and shared controls.
- Preserve the four existing booking steps and all server-side booking behavior.
- Interactive targets must be at least 44 px.
- Motion uses opacity and transform only and respects reduced motion.
- Follow red-green-refactor for every behavior change.

---

### Task 1: Immediate drawer dismissal

**Files:**
- Modify: `src/modules/rentals/booking/components/RentalBookingDrawer.test.tsx`
- Modify: `src/modules/rentals/booking/components/RentalBookingDrawer.tsx`

**Interfaces:**
- Consumes: `Drawer.open`, `Drawer.onOpenChange`, Next `router.replace`.
- Produces: local `drawerOpen` state and an idempotent `close()` handler.

- [ ] Write a failing test that clicks `Закрыть`, expects the dialog to disappear synchronously, and expects `router.replace('/rentals?status=CONFIRMED', { scroll: false })` once.
- [ ] Run `npx vitest run src/modules/rentals/booking/components/RentalBookingDrawer.test.tsx` and confirm the dialog remains visible before the fix.
- [ ] Add `drawerOpen`, guard repeated close calls, set it false before navigation, and remove the redundant refresh.
- [ ] Run the focused test and confirm it passes.

### Task 2: Workflow rail and compact client action

**Files:**
- Create: `src/modules/rentals/booking/components/BookingProgress.tsx`
- Create: `src/modules/rentals/booking/components/BookingProgress.test.tsx`
- Modify: `src/modules/rentals/booking/components/RentalBookingDrawer.tsx`
- Modify: `src/modules/rentals/booking/components/BookingClientStep.tsx`
- Modify: `src/modules/rentals/booking/components/BookingClientStep.test.tsx`

**Interfaces:**
- Produces: `BookingProgress({ currentStep }: { currentStep: number })`.
- Consumes: current zero-based booking step.

- [ ] Write failing tests for four numbered steps, three decorative arrows, `aria-current`, completed check state, and the one-line `Новый клиент` action.
- [ ] Run both focused test files and confirm the new expectations fail.
- [ ] Implement `BookingProgress` using semantic tokens, responsive compact labels, and `FiArrowRight`/`FiCheck`.
- [ ] Place the search and compact new-client action in a responsive row; use `whitespace-nowrap` and the soft primary treatment.
- [ ] Refine selected client rows and drawer header/footer to match the approved visual hierarchy without changing data flow.
- [ ] Run all booking component tests and confirm they pass.

### Task 3: Regression and visual verification

**Files:**
- Verify: all files changed in Tasks 1–2.

**Interfaces:**
- Consumes: completed booking drawer implementation.
- Produces: verified production-ready UI.

- [ ] Run `npm run test:unit -- src/modules/rentals/booking`.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- [ ] Open the booking drawer at desktop and mobile widths; verify close behavior, no wrapped client action, no horizontal overflow, focus handling, step states, and sticky footer.
- [ ] Deploy the verified build using the existing release workflow, health-check `/login`, and confirm the production drawer visually.
