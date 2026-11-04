# Deposit Ledger and Client Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an append-only per-rental deposit ledger, idempotent fine reservations, and a separately deployable Supa Pro client Telegram bot that links an existing client by verified phone contact.

**Architecture:** PostgreSQL remains the source of truth. Existing `RentalPayment`, `RentalOperation`, `Fine`, `TelegramIdentity`, and `BotNotificationJob` models are extended rather than replaced. The staff and client bots use separate Telegram tokens/processes but share the existing authenticated Supa Pro bot API and never store independent financial or rental data.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript strict, Prisma 6.16/PostgreSQL, aiogram 3, Redis FSM storage, Vitest, pytest.

## Global Constraints

- Product name: **Supa Pro**; descriptor: **система управления парком автомобилей**.
- Never store Telegram tokens in tracked files, test snapshots, logs, or database rows.
- Money is stored as signed integer kopecks; balances never use floating point.
- Deposit operations are immutable; corrections are compensating entries.
- Rental payments and deposit balances remain separate.
- Historical fines are not automatically reserved during migration.
- Production financial records are never created by tests.
- Preserve the existing Fines and Events pages and the existing Supa Pro design system.

---

### Task 1: Deposit ledger schema and balance projection

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20261021100000_add_deposit_ledger/migration.sql`
- Create: `src/modules/deposits/domain/balance.ts`
- Test: `src/modules/deposits/domain/balance.test.ts`

**Interfaces:**
- Produces: `projectDepositBalance(entries): DepositBalance`.
- Produces Prisma model `DepositLedgerEntry` with signed `cashDeltaMinor`, `reservedDeltaMinor`, `withheldDeltaMinor`, and `debtDeltaMinor`.

- [ ] **Step 1: Write the failing balance tests**

```ts
expect(projectDepositBalance([
  entry({ cashDeltaMinor: 2_000_000n }),
  entry({ reservedDeltaMinor: 431_250n }),
])).toMatchObject({ availableMinor: 1_568_750n, reservedMinor: 431_250n });

expect(projectDepositBalance([
  entry({ cashDeltaMinor: 100_000n }),
  entry({ reservedDeltaMinor: 100_000n, debtDeltaMinor: 331_250n }),
])).toMatchObject({ availableMinor: 0n, debtMinor: 331_250n });
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/modules/deposits/domain/balance.test.ts`

Expected: FAIL because `projectDepositBalance` does not exist.

- [ ] **Step 3: Implement the projection and Prisma schema**

```ts
export function projectDepositBalance(entries: readonly DepositLedgerDelta[]): DepositBalance {
  const totals = entries.reduce(sumDeltas, zeroBalance);
  const availableMinor = totals.cashMinor - totals.reservedMinor - totals.withheldMinor;
  if (totals.cashMinor < 0n || totals.reservedMinor < 0n || totals.withheldMinor < 0n || availableMinor < 0n) {
    throw new Error('INVALID_DEPOSIT_LEDGER');
  }
  return { ...totals, availableMinor };
}
```

The migration creates enums, relations, company-scoped unique idempotency keys, indexes, and check constraints requiring at least one non-zero delta. It backfills only confirmed deposit payments and committed deposit-return operations; it does not reserve historical fines.

- [ ] **Step 4: Verify GREEN and schema validity**

Run: `npx vitest run src/modules/deposits/domain/balance.test.ts`

Run: `npx prisma validate`

Expected: all pass.

### Task 2: Transactional ledger service and manual operations

**Files:**
- Create: `src/modules/deposits/server/ledger.ts`
- Test: `src/modules/deposits/server/ledger.test.ts`
- Modify: `src/modules/rentals/operations/server/handover-rental.ts`
- Modify: `src/modules/rentals/settlement/server/actions.ts`

**Interfaces:**
- Produces: `appendDepositEntry(tx, input)` and `getRentalDepositBalance(tx, companyId, rentalId)`.
- Consumes existing confirmed deposit payments and committed deposit-return operations.

- [ ] **Step 1: Write failing tests for idempotency and invalid negative balances**

```ts
await appendDepositEntry(tx, { ...input, idempotencyKey: 'deposit-payment:p1' });
await appendDepositEntry(tx, { ...input, idempotencyKey: 'deposit-payment:p1' });
expect(tx.depositLedgerEntry.create).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/modules/deposits/server/ledger.test.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement transaction-scoped locking, validation, and append-only writes**

Use a PostgreSQL transaction-scoped advisory lock derived from company and rental IDs before reading the ledger and inserting an entry. Reject a projected negative cash, reserve, withholding, or available balance. Return the existing entry on an identical idempotency key.

- [ ] **Step 4: Wire deposit collection and return**

After the existing payment/operation write succeeds, append the matching ledger entry in the same Prisma transaction. A partial return records `cashDeltaMinor = -(deposit - withheld)` and `withheldDeltaMinor = withheld`.

- [ ] **Step 5: Verify GREEN**

Run: `npx vitest run src/modules/deposits/server/ledger.test.ts src/modules/rentals/operations/server/handover-rental.test.ts src/modules/rentals/settlement/server/deposit-return-action.test.ts`

Expected: all pass.

### Task 3: Idempotent fine reservation

**Files:**
- Create: `src/modules/deposits/server/fine-reservation.ts`
- Test: `src/modules/deposits/server/fine-reservation.test.ts`
- Modify: `src/modules/fines/sync/sync-company-fines.server.ts`
- Modify: `src/modules/fines/sync/sync-company-fines.server.test.ts`

**Interfaces:**
- Produces: `reserveFineFromDeposit(tx, fineId)`.
- Commission calculation: `ceil(discountedAmountMinor * 1500 / 10000)` using integers.

- [ ] **Step 1: Write failing tests**

Cover 3,750 ₽ + 15% = 4,312.50 ₽, insufficient deposit, ambiguous assignment, duplicate provider events, changed fine amount, payment finalization without a second balance reduction, and cancellation via compensating entry.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/modules/deposits/server/fine-reservation.test.ts`

Expected: FAIL because reservation behavior is absent.

- [ ] **Step 3: Implement reservation after an unambiguous current sync assignment**

Reserve only new or changed fines that have a confirmed unique rental/client assignment. Store `commissionBasisPoints = 1500`, fine amount, commission amount, and total in entry metadata. Reserve `min(available, total)` and record the remainder as debt.

- [ ] **Step 4: Verify GREEN and sync regression tests**

Run: `npx vitest run src/modules/deposits/server/fine-reservation.test.ts src/modules/fines/sync/sync-company-fines.server.test.ts`

Expected: all pass and a repeated synchronization adds no duplicate financial entry.

### Task 4: Client bot split and verified account linking

**Files:**
- Create: `bot/client_main.py`
- Create: `bot/client_config.py`
- Modify: `bot/docker-compose.bot.yaml`
- Modify: `bot/.env.example`
- Modify: `bot/handlers/start.py`
- Modify: `bot/handlers/customer.py`
- Test: `bot/tests/test_client_authorization.py`
- Test: `bot/tests/test_customer_menu.py`

**Interfaces:**
- Client process consumes `CLIENT_TELEGRAM_BOT_TOKEN`, `PILOT_API_BASE_URL`, `PILOT_BOT_SERVICE_TOKEN`, and `REDIS_URL`.
- Account linking continues to call the existing `/api/bot/v1/link` endpoint and requires Telegram's own contact payload where `contact.user_id == from_user.id`.

- [ ] **Step 1: Add failing tests for client-only routing and secure contact linking**

```py
assert contact.user_id == message.from_user.id
api.link.assert_awaited_once_with(str(message.from_user.id), contact.phone_number)
```

Also verify staff commands are not registered in `client_main.py` and an unknown or ambiguous phone is escalated rather than creating a client.

- [ ] **Step 2: Verify RED**

Run: `bot/.venv/Scripts/python.exe -m pytest bot/tests/test_client_authorization.py bot/tests/test_customer_menu.py -q`

Expected: FAIL because the separate client entrypoint/configuration is absent.

- [ ] **Step 3: Implement separate process with the shared API**

Register only start, customer, and customer rental routers. Use the existing Redis FSM storage and API service authentication. Never put the real token in source or `.env.example`.

- [ ] **Step 4: Verify GREEN**

Run: `bot/.venv/Scripts/python.exe -m pytest bot/tests -q`

Expected: all bot tests pass.

### Task 5: Deployment secrets and smoke verification

**Files:**
- Modify: `bot/deploy/*` only if the current server deployment uses these files.
- Modify: deployment environment outside Git for `CLIENT_TELEGRAM_BOT_TOKEN`.

**Interfaces:**
- Consumes the user-provided token only through the server secret environment.

- [ ] **Step 1: Validate the new process without exposing the token**

Check configuration presence by boolean/result code only. Never print environment values.

- [ ] **Step 2: Deploy with zero-downtime safeguards**

Start the client-bot service separately, keep the existing staff bot running, then verify health and `/start` account-linking behavior.

- [ ] **Step 3: Run focused regressions**

Run: `npm run typecheck`

Run: `npx vitest run src/modules/deposits src/modules/fines/sync/sync-company-fines.server.test.ts`

Run: `bot/.venv/Scripts/python.exe -m pytest bot/tests -q`

Expected: all pass.

## Self-review

- Covers append-only balances, separation of rent/deposit, fine reservation, 15% commission, idempotency, insufficient deposit, separate client bot, and secure phone linking.
- Deliberately excludes historical fine reservation and bank acquiring.
- Telegram fine delivery/acknowledgement, client deposit UI, extension QR workflow, support cases, and Events integration remain subsequent vertical plans after this financial foundation is verified.
