# Dashboard Deposit Returns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the command center reliably show deposits due today, soon, and overdue, including imported rentals whose deposit is proven by confirmed payments rather than a `COLLECTED` operation.

**Architecture:** Add one shared pure resolver for rental deposit state, load confirmed deposit payments in the dashboard query, and compare deadlines by Moscow calendar date. Keep the existing workday DTO and UI contract so this correction can ship without a schema migration.

**Tech Stack:** TypeScript, Next.js App Router, React, Prisma, Vitest, Testing Library.

## Global Constraints

- Preserve the current Pilot+ theme and existing dashboard component contracts.
- Do not mutate rental, payment, operation, or deposit records while building the dashboard.
- Never invent a phone number; render the existing `Нет телефона` fallback.
- Deposit deadline is 21 business days after the committed return or actual completion.
- Calendar classification uses `Europe/Moscow`; a deadline today is not overdue until the next Moscow day.
- Use confirmed `DEPOSIT` payments only.
- No database migration is expected for this plan.

---

### Task 1: Shared Deposit State Resolver

**Files:**
- Create: `src/modules/rentals/deposit-state.ts`
- Create: `src/modules/rentals/deposit-state.test.ts`

**Interfaces:**
- Produces: `resolveRentalDepositState(input: RentalDepositStateInput): RentalDepositState`
- `RentalDepositState` is `NOT_COLLECTED | COLLECTED | RETURNED | PARTIALLY_WITHHELD | WITHHELD | null`.
- Later dashboard tasks consume this resolver with committed operations and confirmed deposit payments.

- [ ] **Step 1: Write the failing resolver tests**

```ts
import { describe, expect, it } from 'vitest';

import { resolveRentalDepositState } from './deposit-state';

describe('resolveRentalDepositState', () => {
  it('uses a terminal committed operation ahead of payments', () => {
    expect(
      resolveRentalDepositState({
        expectedMinor: 20_000_00n,
        operations: [
          {
            id: 'return-1',
            status: 'COMMITTED',
            occurredAt: new Date('2026-09-01T09:00:00Z'),
            depositStatus: 'RETURNED',
          },
        ],
        payments: [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: 20_000_00n }],
      }),
    ).toBe('RETURNED');
  });

  it('treats a fully covered confirmed deposit payment as collected', () => {
    expect(
      resolveRentalDepositState({
        expectedMinor: 20_000_00n,
        operations: [],
        payments: [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: 20_000_00n }],
      }),
    ).toBe('COLLECTED');
  });

  it('ignores cancelled and non-deposit payments', () => {
    expect(
      resolveRentalDepositState({
        expectedMinor: 20_000_00n,
        operations: [],
        payments: [
          { kind: 'DEPOSIT', status: 'CANCELLED', amountMinor: 20_000_00n },
          { kind: 'RENT', status: 'CONFIRMED', amountMinor: 20_000_00n },
        ],
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `npx vitest run src/modules/rentals/deposit-state.test.ts`

Expected: FAIL because `./deposit-state` does not exist.

- [ ] **Step 3: Implement the pure resolver**

```ts
export type RentalDepositState =
  | 'NOT_COLLECTED'
  | 'COLLECTED'
  | 'RETURNED'
  | 'PARTIALLY_WITHHELD'
  | 'WITHHELD'
  | null;

type DepositOperation = {
  id: string;
  status: 'DRAFT' | 'COMMITTED' | 'ERROR';
  occurredAt: Date;
  depositStatus: Exclude<RentalDepositState, null> | null;
};

type DepositPayment = {
  kind: string;
  status: string;
  amountMinor: bigint;
};

export type RentalDepositStateInput = {
  expectedMinor: bigint | null;
  operations: readonly DepositOperation[];
  payments: readonly DepositPayment[];
};

export function resolveRentalDepositState(input: RentalDepositStateInput): RentalDepositState {
  if (!input.expectedMinor || input.expectedMinor <= 0n) return null;

  const latest = [...input.operations]
    .filter((item) => item.status === 'COMMITTED' && item.depositStatus !== null)
    .sort(
      (left, right) =>
        right.occurredAt.getTime() - left.occurredAt.getTime() || right.id.localeCompare(left.id),
    )[0];

  if (latest?.depositStatus) return latest.depositStatus;

  const paidMinor = input.payments
    .filter((item) => item.kind === 'DEPOSIT' && item.status === 'CONFIRMED')
    .reduce((sum, item) => sum + item.amountMinor, 0n);

  return paidMinor >= input.expectedMinor ? 'COLLECTED' : null;
}
```

- [ ] **Step 4: Run the resolver tests**

Run: `npx vitest run src/modules/rentals/deposit-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the resolver**

```bash
git add src/modules/rentals/deposit-state.ts src/modules/rentals/deposit-state.test.ts
git commit -m "fix: centralize rental deposit state"
```

### Task 2: Load Payment Evidence in the Dashboard Query

**Files:**
- Modify: `src/modules/dashboard/server/queries.ts`
- Modify: `src/modules/dashboard/server/queries.test.ts`

**Interfaces:**
- Consumes: Prisma `RentalPayment` fields already present in the schema.
- Produces: `RawRental.payments: Array<{ kind; status; amountMinor }>` for the dashboard normalizer.

- [ ] **Step 1: Add failing query assertions**

Extend the existing completed-rental query test with these assertions:

```ts
const rentalArgs = rentalFindMany.mock.calls[0]?.[0];

expect(rentalArgs.where.OR[1]).toEqual({
  status: 'COMPLETED',
  depositMinor: { gt: 0 },
});
expect(rentalArgs.select.payments).toEqual({
  where: { kind: 'DEPOSIT', status: 'CONFIRMED' },
  select: { kind: true, status: true, amountMinor: true },
});
```

- [ ] **Step 2: Run the query test and verify it fails**

Run: `npx vitest run src/modules/dashboard/server/queries.test.ts`

Expected: FAIL because the query still filters completed rentals by `operations.some` and does not select `payments`.

- [ ] **Step 3: Add payments to the rental projection and remove the operation-only filter**

Add this property to `RawRental`:

```ts
payments: Array<{
  kind: 'RENT' | 'DEPOSIT';
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  amountMinor: bigint;
}>;
```

Add this selection inside `rentalSelect`:

```ts
payments: {
  where: { kind: 'DEPOSIT', status: 'CONFIRMED' },
  select: { kind: true, status: true, amountMinor: true },
},
```

Replace the completed-rental branch with:

```ts
{
  status: 'COMPLETED',
  depositMinor: { gt: 0 },
},
```

- [ ] **Step 4: Run dashboard query tests**

Run: `npx vitest run src/modules/dashboard/server/queries.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the query correction**

```bash
git add src/modules/dashboard/server/queries.ts src/modules/dashboard/server/queries.test.ts
git commit -m "fix: load dashboard deposit payments"
```

### Task 3: Classify Deposit Deadlines by Moscow Calendar Day

**Files:**
- Modify: `src/shared/business-time.ts`
- Modify: `src/shared/business-time.test.ts`
- Modify: `src/modules/dashboard/normalizers.ts`
- Modify: `src/modules/dashboard/normalizers.test.ts`

**Interfaces:**
- Consumes: `resolveRentalDepositState` from Task 1.
- Produces: `comparePilotBusinessDate(left: Date, right: Date): -1 | 0 | 1`.
- Preserves: `DashboardWorkItemDto` shape.

- [ ] **Step 1: Write failing Moscow-date comparison tests**

```ts
import { comparePilotBusinessDate } from './business-time';

it('treats two instants on the same Moscow date as equal', () => {
  expect(
    comparePilotBusinessDate(
      new Date('2026-09-14T21:00:00Z'),
      new Date('2026-09-15T17:30:00Z'),
    ),
  ).toBe(0);
});

it('orders adjacent Moscow dates', () => {
  expect(
    comparePilotBusinessDate(
      new Date('2026-09-14T20:59:59Z'),
      new Date('2026-09-14T21:00:00Z'),
    ),
  ).toBe(-1);
});
```

Add normalizer fixtures for:

```ts
payments: [{ kind: 'DEPOSIT', status: 'CONFIRMED', amountMinor: 20_000_00n }]
```

Assert that a completed rental with no deposit operation is emitted, a due-today item has `overdue: false`, a due-yesterday item has `overdue: true`, and `RETURNED` remains excluded.

- [ ] **Step 2: Run the focused tests and verify failures**

Run: `npx vitest run src/shared/business-time.test.ts src/modules/dashboard/normalizers.test.ts`

Expected: FAIL because the comparison helper and payment fallback are absent.

- [ ] **Step 3: Implement the date comparison helper**

```ts
export function comparePilotBusinessDate(left: Date, right: Date): -1 | 0 | 1 {
  const leftParts = getPilotBusinessDateParts(left);
  const rightParts = getPilotBusinessDateParts(right);
  const leftKey = leftParts.year * 10_000 + leftParts.month * 100 + leftParts.day;
  const rightKey = rightParts.year * 10_000 + rightParts.month * 100 + rightParts.day;
  return leftKey === rightKey ? 0 : leftKey < rightKey ? -1 : 1;
}
```

- [ ] **Step 4: Use the shared resolver and calendar comparison in `rentalWorkItems`**

Add `payments` to `RentalSource`, call:

```ts
const depositStatus = resolveRentalDepositState({
  expectedMinor: rental.depositMinor,
  operations: rental.operations,
  payments: rental.payments,
});
const depositDateOrder = comparePilotBusinessDate(depositReturnDueAt, source.now);
const depositOverdue = depositDateOrder < 0;
```

Emit a deposit return only when `depositStatus === 'COLLECTED'`. For `depositDateOrder === 0`, set the title to `Вернуть депозит сегодня`; otherwise retain `Вернуть депозит`.

- [ ] **Step 5: Run focused dashboard tests**

Run: `npx vitest run src/shared/business-time.test.ts src/modules/rentals/deposit-state.test.ts src/modules/dashboard/normalizers.test.ts src/modules/dashboard/server/queries.test.ts src/modules/dashboard/CommandCenterDashboard.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the dashboard behavior**

```bash
git add src/shared/business-time.ts src/shared/business-time.test.ts src/modules/dashboard/normalizers.ts src/modules/dashboard/normalizers.test.ts
git commit -m "fix: show deposit returns on the correct day"
```

### Task 4: Verify the Workday Presentation and Regression Boundary

**Files:**
- Modify only if the existing DTO title is not already rendered: `src/modules/dashboard/WorkdayBoard.tsx`
- Modify: `src/modules/dashboard/CommandCenterDashboard.test.tsx`
- Modify: `tests/dashboard.spec.ts`

**Interfaces:**
- Consumes: existing `DashboardWorkItemDto` from Tasks 2–3.
- Produces no new data contract.

- [ ] **Step 1: Add a component assertion for complete deposit information**

Use a `DEPOSIT_RETURN` fixture and assert:

```ts
expect(screen.getByText('Вернуть депозит сегодня')).toBeTruthy();
expect(screen.getByText('20 000 ₽')).toBeTruthy();
expect(screen.getByText('Щапова Екатерина Николаевна')).toBeTruthy();
expect(screen.getByText('Нет телефона')).toBeTruthy();
expect(screen.getByText('ME-2026-0006-BK')).toBeTruthy();
```

- [ ] **Step 2: Run the component test**

Run: `npx vitest run src/modules/dashboard/CommandCenterDashboard.test.tsx`

Expected: PASS if the existing generic row already renders all DTO fields; otherwise FAIL at the missing field.

- [ ] **Step 3: Make the smallest presentation change required by the failing assertion**

Keep the existing row structure and action sizes. Render `item.phone ?? 'Нет телефона'` and do not add hardcoded customer data.

- [ ] **Step 4: Add browser acceptance for today's deposit**

Add a production-data-independent route interception or seeded fixture assertion that the workday orders `Просрочено` ahead of `Вернуть депозит сегодня`, and that today's item is not styled with the overdue tone.

- [ ] **Step 5: Run verification**

Run: `npx vitest run src/modules/dashboard src/modules/rentals/deposit-state.test.ts src/shared/business-time.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit the acceptance coverage**

```bash
git add src/modules/dashboard/WorkdayBoard.tsx src/modules/dashboard/CommandCenterDashboard.test.tsx tests/dashboard.spec.ts
git commit -m "test: cover command center deposit returns"
```
