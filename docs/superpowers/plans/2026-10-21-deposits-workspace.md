# Deposits Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved variant A deposits workspace and urgent-return counter to Supa Pro.

**Architecture:** A company-scoped server query reads rentals with their append-only deposit ledger, then a pure projection derives balances, deadlines, statuses, totals, and search/filter results. A server page renders the existing AppShell and passes serializable rows into a focused workspace component. The protected layout computes only the urgent counter for navigation.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Prisma, Tailwind CSS 4, Vitest.

## Global Constraints

- Use only the name Supa Pro / СУПА ПРО and the approved existing logo implementation.
- Preserve the custom graphite design system and `#0067ff` primary accent.
- Do not create a second deposit balance table or mutate ledger history.
- Scope every query by the authenticated company and existing rental access.

---

### Task 1: Deposit projection and company query

**Files:**
- Create: `src/modules/deposits/workspace/model.ts`
- Create: `src/modules/deposits/workspace/model.test.ts`
- Create: `src/modules/deposits/server/queries.ts`
- Create: `src/modules/deposits/server/sidebar-count.ts`
- Test: `src/modules/deposits/server/sidebar-count.test.ts`

**Interfaces:**
- Produces: `DepositWorkspaceRow`, `DepositWorkspaceSummary`, `buildDepositWorkspace`, `getDepositWorkspace`, `getUrgentDepositSidebarCount`.

- [ ] Write failing tests for balance projection, 21-business-day deadline, urgent/soon/returned/debt statuses, summary totals, search and sidebar count.
- [ ] Run `npx vitest run src/modules/deposits/workspace/model.test.ts src/modules/deposits/server/sidebar-count.test.ts` and confirm RED.
- [ ] Implement the pure projection and company-scoped Prisma query using `DepositLedgerEntry`.
- [ ] Run the same tests and confirm GREEN.

### Task 2: Deposits page

**Files:**
- Create: `src/app/(protected)/deposits/page.tsx`
- Create: `src/modules/deposits/workspace/DepositsWorkspace.tsx`
- Create: `src/modules/deposits/workspace/DepositsWorkspace.test.tsx`
- Create: `src/modules/deposits/workspace/deposits-workspace.module.css`

**Interfaces:**
- Consumes: serializable rows and summary from Task 1.
- Produces: responsive `/deposits` staff workspace.

- [ ] Write a failing component test for the four summary cards, filters, rows, ledger history and rental link.
- [ ] Run the component test and confirm RED.
- [ ] Implement the server page and client-side search/filter/expansion using existing design tokens.
- [ ] Run the component test and confirm GREEN.

### Task 3: Navigation counter

**Files:**
- Modify: `src/shared/components/app-shell/navigation.ts`
- Modify: `src/shared/components/app-shell/Sidebar.tsx`
- Modify: `src/shared/components/app-shell/AppShell.tsx`
- Modify: `src/shared/components/app-shell/ShellFrame.tsx`
- Modify: `src/app/(protected)/layout.tsx`
- Modify: `src/shared/components/app-shell/Sidebar.test.ts`
- Modify: `src/app/(protected)/layout.test.ts`

**Interfaces:**
- Consumes: `getUrgentDepositSidebarCount`.
- Produces: `/deposits` navigation entry and blue oval badge.

- [ ] Extend existing tests to require the deposits navigation entry and exact urgent count.
- [ ] Run focused tests and confirm RED.
- [ ] Thread `openDepositCount` through the protected shell and render the oval badge.
- [ ] Run focused tests and confirm GREEN.

### Task 4: Verification and deployment

**Files:**
- Verify all files above without unrelated edits.

- [ ] Run focused Vitest suites for deposits and app shell.
- [ ] Run `npm run typecheck` and record unrelated pre-existing failures separately.
- [ ] Run `npm run build` with sufficient Node heap.
- [ ] Back up production, deploy through the zero-downtime release script, and verify `/deposits`, the current symlink, service health, and public login health.
