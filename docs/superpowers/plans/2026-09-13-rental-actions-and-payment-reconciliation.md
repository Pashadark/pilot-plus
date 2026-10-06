# Rental Actions And Payment Reconciliation Implementation Plan

> **For Codex:** Execute this plan inline with `executing-plans`. Preserve the dirty worktree and do not overwrite unrelated user changes.

**Goal:** Add the complete eleven-action menu to active rentals, deep-link payment/deposit actions into the existing settlement workspace, and reconcile every payable production rental to 100% through additive audited payments.

**Architecture:** Keep the rental table server-rendered and move only interactive menu behavior into a focused client component. Reuse existing detail routes and anchors. Put reconciliation arithmetic in a pure tested planner and use a dry-run-first production script with deterministic idempotency keys and a transaction.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest/Testing Library, Prisma/PostgreSQL.

---

## Task 1: Read framework guidance and establish focused regression tests

**Files:**
- Read: `node_modules/next/dist/docs/`
- Modify: `src/modules/rentals/components/RentalListPage.test.tsx`
- Create: `src/modules/rentals/components/RentalRowActionsMenu.test.tsx`

1. Read the installed Next.js documentation for Client Components, App Router search parameters, and navigation links before changing code.
2. Add failing tests that render an active rental and assert the exact eleven actions and order:
   `Открыть договор`, `Редактировать условия`, `Внести или исправить оплату`, `Управление залогом`, `Открыть клиента`, `Открыть автомобиль`, `История действий`, `Скачать PDF`, `Скачать DOCX`, `Скопировать номер договора`, `Скопировать ссылку`.
3. Assert the expected URLs, the latest PDF/DOCX versions, and disabled explanatory document items when a format is unavailable.
4. Add clipboard success/failure tests and assert Pilot+ toast messages.
5. Run the focused tests and record the expected RED result because the client menu does not yet exist.

## Task 2: Implement the accessible rental action menu and integrate desktop/mobile layouts

**Files:**
- Create: `src/modules/rentals/components/RentalRowActionsMenu.tsx`
- Modify: `src/modules/rentals/components/RentalListPage.tsx`
- Modify: `src/modules/rentals/components/RentalListPage.test.tsx`

1. Create a small serializable action-menu model containing rental, client, vehicle, contract, and latest document data.
2. Implement a client component with a 40×40 trigger, grouped menu rows, semantic links/buttons, Escape close, outside-click close, and trigger focus restoration.
3. Implement clipboard writes for contract number and absolute rental URL; show success or danger toasts through the existing toast provider.
4. Keep missing PDF/DOCX rows visible and disabled with a concise reason.
5. Replace the desktop `<details>` overflow with the new component and expose the same component on mobile cards. Keep compact `Продлить` and `Завершить` buttons outside the menu.
6. Run the focused component tests until GREEN.

## Task 3: Support direct payment and deposit entry links

**Files:**
- Modify: `src/app/(protected)/rentals/[id]/page.tsx`
- Modify: `src/modules/rentals/settlement/components/RentalSettlementCard.tsx`
- Modify: `src/modules/rentals/settlement/components/RentalSettlementCard.test.tsx`
- Modify: `src/app/(protected)/rentals/[id]/route-states.test.tsx`

1. Add failing tests for `?settlement=rent` and `?settlement=deposit` and for invalid values falling back to rental payment.
2. Extend the route search-parameter parser with a narrow `rent | deposit` value.
3. Pass the validated selection into `RentalSettlementCard` and map it to the existing `RENT | DEPOSIT` select value.
4. Preserve existing action-modal behavior and server-side access checks.
5. Run settlement and route tests until GREEN.

## Task 4: Build the additive owner-confirmed payment reconciliation

**Files:**
- Create: `src/modules/rentals/server/owner-confirmed-payment-reconciliation.ts`
- Create: `src/modules/rentals/server/owner-confirmed-payment-reconciliation.test.ts`
- Create: `scripts/reconcile-owner-confirmed-rental-payments.ts`

1. Write failing pure tests for underpaid, fully paid, overpaid, draft, cancelled, refunded, and repeat/idempotent cases.
2. Implement a pure planner that includes only `CONFIRMED`, `ACTIVE`, and `COMPLETED` contracts with positive totals and calculates the missing net RENT balance.
3. Use a deterministic per-rental idempotency key. Never update or delete an existing payment.
4. Implement a script that is dry-run by default and applies only with `--apply`. Resolve an active superadministrator as actor, create confirmed `OTHER` payments in one transaction, print only contract-safe totals, and abort on any error.
5. Run the planner tests and a local dry-run where environment access permits.

## Task 5: Verify the full application and UI quality

**Files:**
- Verify only

1. Run rental-focused tests.
2. Run `npm run lint`.
3. Run `npm run typecheck`.
4. Run `npm run test:unit`.
5. Run `npm run build`.
6. Run the Impeccable detector once on the changed UI files and correct material issues without broad redesign.
7. Inspect the worktree diff and confirm unrelated changes remain untouched.

## Task 6: Back up production, deploy atomically, reconcile, and prove the result

**Files:**
- Deploy changed application files and reconciliation script to a new timestamped release.

1. Inspect the current production service, release target, disk space, and existing backup convention.
2. Create and verify a fresh PostgreSQL backup before any data mutation.
3. Copy the current release to a new release directory, overlay only changed files, install/build using the service environment, switch the `current` symlink atomically, and restart the service while retaining the previous release.
4. Run the reconciliation script without `--apply`; review the count and total missing amount.
5. Run it with `--apply`, then rerun dry-run and require zero planned adjustments.
6. Verify service health and inspect recent logs for new errors.
7. Using the authenticated browser, verify desktop and mobile menus, all eleven actions, disabled document states, payment/deposit deep links, clipboard toasts, and payable rentals showing 100%.
8. Report deployed release, backup location, reconciliation counts, verification commands, and any remaining limitation.
