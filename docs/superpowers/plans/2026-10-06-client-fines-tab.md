# Client Fines Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure fines tab to each client detail page with decree, offense, vehicle, and rental-period evidence.

**Architecture:** A server-only query returns a serializable client-fine workspace scoped by company and client. The client route loads it in parallel with existing workspaces and passes it to a focused presentation component rendered inside the existing client tab controller.

**Tech Stack:** Next.js App Router Server Components, React client tabs, Prisma, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Show only fines whose confirmed `clientId` equals the open client.
- Scope every query by both `companyId` and `clientId`.
- Do not infer or display unconfirmed candidate assignments.
- Preserve existing Pilot+ design tokens and mobile behavior.

---

### Task 1: Secure client fine workspace query

**Files:**
- Create: `src/modules/clients/server/client-fines.ts`
- Create: `src/modules/clients/server/client-fines.test.ts`
- Modify: `src/modules/clients/types.ts`

**Interfaces:**
- Produces: `getClientFineWorkspace(access: ClientAccess, companyId: string, clientId: string): Promise<ClientFineWorkspaceDto>`.
- Produces: `ClientFineWorkspaceDto` with `summary` and serializable `fines`.

- [ ] **Step 1: Write the failing query test**

Assert that the repository receives `where: { companyId, clientId, status: { not: 'CANCELLED' } }`, ordered newest first, and that the DTO includes decree, offense, vehicle and assigned rental period.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/clients/server/client-fines.test.ts`

Expected: FAIL because `client-fines.ts` does not exist.

- [ ] **Step 3: Implement the minimal server query**

Use a dependency-injected repository for unit tests and the Prisma client by default. Return ISO dates and minor-unit amounts as strings so the result is serializable across the Server-to-Client boundary.

- [ ] **Step 4: Run the query tests**

Run: `npx vitest run src/modules/clients/server/client-fines.test.ts`

Expected: PASS.

### Task 2: Client fines presentation and tab

**Files:**
- Create: `src/modules/clients/components/ClientFineWorkspace.tsx`
- Create: `src/modules/clients/components/ClientFineWorkspace.test.tsx`
- Modify: `src/modules/clients/components/ClientWorkspaceTabs.tsx`
- Modify: `src/modules/clients/components/ClientWorkspaceTabs.test.tsx`
- Modify: `src/modules/clients/components/ClientDetailPage.tsx`
- Modify: `src/modules/clients/components/ClientDetailPage.test.tsx`

**Interfaces:**
- Consumes: `ClientFineWorkspaceDto`.
- Produces: a responsive `ClientFineWorkspace` React component and a `fines` slot in `ClientWorkspaceTabs`.

- [ ] **Step 1: Write failing component tests**

Assert that `Штрафы 2` opens the panel and that a fine renders status, amount, complete description, decree number, decree date, offense date/time, vehicle, contract, issue/return period and confirmed-assignment copy. Assert the empty state for zero fines.

- [ ] **Step 2: Run component tests to verify they fail**

Run: `npx vitest run src/modules/clients/components/ClientFineWorkspace.test.tsx src/modules/clients/components/ClientWorkspaceTabs.test.tsx src/modules/clients/components/ClientDetailPage.test.tsx`

Expected: FAIL because the slot and component are missing.

- [ ] **Step 3: Implement the presentation**

Follow the approved mockup: status-colored header, compact vehicle row, decree/date/place facts, elevated rental evidence block, and a link to `/fines?clientId=<id>&query=<decreeNumber>`. Use existing CSS variables and Lucide icons.

- [ ] **Step 4: Run component tests**

Run the same Vitest command.

Expected: PASS.

### Task 3: Route integration and verification

**Files:**
- Modify: `src/app/(protected)/clients/[id]/page.tsx`
- Test: `src/modules/clients/server/client-fines.test.ts`
- Test: `src/modules/clients/components/ClientFineWorkspace.test.tsx`

**Interfaces:**
- Consumes: `getClientFineWorkspace` and passes the result to `ClientDetailPage`.

- [ ] **Step 1: Load fines in the existing parallel route query**

Add `getClientFineWorkspace(access, client.companyId, client.id)` to the existing `Promise.all` after the tenant-scoped client is loaded.

- [ ] **Step 2: Run targeted tests and typecheck**

Run: `npx vitest run src/modules/clients/server/client-fines.test.ts src/modules/clients/components/ClientFineWorkspace.test.tsx src/modules/clients/components/ClientWorkspaceTabs.test.tsx src/modules/clients/components/ClientDetailPage.test.tsx`

Run: `npm run typecheck`

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 3: Verify responsive UI**

Open the target client page at desktop and mobile widths. Confirm tab overflow, card wrapping, readable dates, visible empty state and no horizontal overflow.
