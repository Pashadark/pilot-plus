# Client Phone And Deposit Return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the full authorized client phone number plus deposit return status and factual return date in the clients list.

**Architecture:** Extend the existing tenant-scoped client DTO with a display phone and the timestamp from the latest committed deposit operation. Keep presentation formatting in the clients module and render the date in desktop and mobile views without changing the database schema.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Prisma, Vitest, Tailwind CSS.

## Global Constraints

- Preserve unrelated dirty-worktree changes.
- Do not expose encrypted fields to the browser.
- Use `RentalOperation.occurredAt` as the factual deposit return/resolution date.
- Deploy only after tests, typecheck, and production build succeed.

---

### Task 1: Extend the client list data contract

**Files:**
- Modify: `src/modules/clients/types.ts`
- Modify: `src/modules/clients/server/queries.ts`
- Test: `src/modules/clients/server/queries.test.ts`

**Interfaces:**
- Produces: `ClientCardDto.phone: string`
- Produces: `ClientListRentalSummary.depositReturnedAt: string | null`

- [ ] **Step 1: Write the failing server query test**

Add `occurredAt` to operation fixtures and assert that the list item exposes `phone: '+7 999 123-45-67'` and the returned rental exposes `depositReturnedAt` while encrypted source fields remain absent.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/clients/server/queries.test.ts`
Expected: FAIL because `phone` and `depositReturnedAt` are not yet returned.

- [ ] **Step 3: Implement the minimal server mapping**

Select `occurredAt`, format the decrypted phone for display, and map `depositReturnedAt` only for terminal deposit statuses.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/clients/server/queries.test.ts`
Expected: PASS.

### Task 2: Render status and return date

**Files:**
- Modify: `src/modules/clients/components/client-deposit.ts`
- Modify: `src/modules/clients/components/ClientGrid.tsx`
- Modify: `src/modules/clients/components/ClientCard.tsx`
- Test: `src/modules/clients/components/ClientGrid.test.tsx`

**Interfaces:**
- Consumes: `ClientCardDto.phone`
- Consumes: `ClientListRentalSummary.depositReturnedAt`
- Produces: `presentClientDeposit(...).returnedAtLabel`

- [ ] **Step 1: Write the failing component test**

Assert that rendered markup contains the complete phone, the header «Дата возврата», the status «Возвращён», and a formatted factual return timestamp.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/clients/components/ClientGrid.test.tsx`
Expected: FAIL because the table has no return date column.

- [ ] **Step 3: Implement the minimal presentation**

Render full phone, add the new table column directly after deposit status, and show the same date in mobile cards. Use `—` when there is no factual return timestamp.

- [ ] **Step 4: Run all relevant verification**

Run: `npx vitest run src/modules/clients/server/queries.test.ts src/modules/clients/components/ClientGrid.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

### Task 3: Deploy and smoke-test production

**Files:**
- Deploy the verified workspace changes to `/opt/pilot-plus/current` on `201.24.51.103`.

**Interfaces:**
- Produces: updated `/clients` page on `https://201-24-51-103.nip.io`.

- [ ] **Step 1: Transfer the verified source changes**

Copy only the files required for this feature and preserve production environment files and uploads.

- [ ] **Step 2: Build and restart the service**

Run the production build on the VPS and restart `pilot-plus` only after it succeeds.

- [ ] **Step 3: Verify production health**

Check service state and the HTTPS response for `/clients`; expected service status is active and HTTP response is successful or an authentication redirect.
