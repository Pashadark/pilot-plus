# Telegram HTML Operations Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the existing nightly SУПА ПРО operations digest as safe, readable Telegram HTML to both the bound work group and the binding staff member, and provide a square production bot avatar.

**Architecture:** The Next.js server hydrates notification jobs from canonical rental, operation, service and telematics data and produces escaped HTML. The Python aiogram worker only selects the destination, sends the declared parse mode, and preserves retry/migration behavior. Delivery to the group and personal staff identity uses separate idempotent jobs.

**Tech Stack:** Next.js 16, TypeScript, Prisma/PostgreSQL, Vitest, Python 3.12, aiogram 3, pytest, OpenAI image generation.

## Global Constraints

- Keep the current nightly Moscow schedule unchanged.
- Deliver the same digest to the bound work group and the active `STAFF` identity of `TelegramGroupBinding.boundByUserId`.
- Use Telegram `parse_mode="HTML"`; never emit Markdown `**` markup.
- Escape every dynamic database value before inserting it into HTML.
- Include only active, non-archived, non-demo company vehicles.
- Use the shared GPS freshness threshold `OFFLINE_AFTER_MS`.
- Hide empty sections and use emojis sparingly.
- Preserve notification leases, idempotency, retries and supergroup migration handling.

---

### Task 1: Build the canonical HTML operations digest

**Files:**
- Create: `src/modules/bot-api/operations-digest.ts`
- Create: `src/modules/bot-api/operations-digest.test.ts`
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`

**Interfaces:**
- Produces: `formatOperationsDigest(input: OperationsDigestInput): string`
- Produces: hydrated `payload: { message: string; parseMode: 'HTML' }`
- Consumes: `OFFLINE_AFTER_MS` from `src/modules/vehicles/gps-status.ts`

- [ ] **Step 1: Write failing formatter tests**

Cover one return card with `<code>20:30</code>`, `<b>Принять возврат автомобиля</b>`, contract, vehicle, client and phone; separate deposit, wash, maintenance and GPS sections; chronological sorting; hidden empty sections; and escaping of `<`, `>`, `&`.

```ts
expect(formatOperationsDigest(fixture)).toContain(
  '<code>20:30</code>  <b>Принять возврат автомобиля</b>',
);
expect(formatOperationsDigest(fixture)).toContain('<code>ME-2026-0020-KS</code>');
expect(formatOperationsDigest(fixture)).toContain('📡 <b>Нет GPS-связи</b>');
expect(formatOperationsDigest(unsafeFixture)).not.toContain('<script>');
```

- [ ] **Step 2: Run the formatter tests and verify RED**

Run: `npx vitest run src/modules/bot-api/operations-digest.test.ts`

Expected: FAIL because `operations-digest.ts` does not exist.

- [ ] **Step 3: Implement the focused formatter**

Define typed digest items, a local HTML escape helper, Moscow date/time formatters, section builders and one top-level formatter. Use `<b>`, `<i>` and `<code>` exactly as specified; omit absent phone and empty sections.

- [ ] **Step 4: Write failing hydration tests**

Extend the existing notification transaction fixture so the daily job loads rentals, committed deposit operations, wash records, maintenance records and latest GLONASSSOFT positions. Assert `payload.parseMode === 'HTML'`, real vehicles only, and the shared stale GPS boundary.

- [ ] **Step 5: Run hydration tests and verify RED**

Run: `npx vitest run src/modules/bot-api/notifications.test.ts`

Expected: FAIL because the current hydrator returns plain text and does not query service/GPS data.

- [ ] **Step 6: Hydrate all operational sections**

Replace `formatDailyOperationsDigest` with the focused formatter. Extend `hydrateJob` selects without storing PII in queued JSON. Decrypt phones only while claiming a job; if the encryption key is absent or decryption fails, omit the phone line.

- [ ] **Step 7: Run TypeScript tests and typecheck**

Run: `npx vitest run src/modules/bot-api/operations-digest.test.ts src/modules/bot-api/notifications.test.ts src/modules/bot-api/daily-operations.test.ts`

Run: `npm run typecheck`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 8: Commit Task 1**

```bash
git add src/modules/bot-api/operations-digest.ts src/modules/bot-api/operations-digest.test.ts src/modules/bot-api/notifications.ts src/modules/bot-api/notifications.test.ts
git commit -m "feat: format nightly bot operations digest"
```

### Task 2: Deliver HTML to the work group and personal staff chat

**Files:**
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`
- Modify: `bot/services/notifications.py`
- Modify: `bot/tests/test_notifications.py`

**Interfaces:**
- Consumes: `payload.message` and `payload.parseMode` produced by Task 1.
- Produces: two idempotent `DAILY_OPERATIONS_DIGEST` jobs per binding when an active binding staff identity exists.
- Produces: `notification_message(job) -> tuple[str, str | None]` in the Python worker.

- [ ] **Step 1: Write failing dual-delivery tests**

Set up one group binding with `boundByUserId` and an active matching staff identity. Assert the created rows contain `:group` and `:staff:<identityId>` event keys; the group row contains `chatId`, and the personal row contains `identityId`.

- [ ] **Step 2: Run enqueue tests and verify RED**

Run: `npx vitest run src/modules/bot-api/notifications.test.ts`

Expected: FAIL because only the group job currently exists.

- [ ] **Step 3: Implement idempotent dual enqueue**

Select `boundByUserId`, load active staff identities in one query, and emit one independent row per available target. Do not hard-code Telegram user IDs.

- [ ] **Step 4: Write failing aiogram worker tests**

Assert HTML jobs call:

```py
bot.send_message.assert_awaited_once_with(
    -100777,
    '<b>Сводка СУПА ПРО</b>',
    parse_mode='HTML',
)
```

Also retain tests for personal identity destination, migrated supergroups, acknowledgment only after success, and plain fallback for old jobs.

- [ ] **Step 5: Run Python tests and verify RED**

Run: `python -m pytest bot/tests/test_notifications.py -q`

Expected: FAIL because the worker does not pass `parse_mode`.

- [ ] **Step 6: Implement safe parse-mode delivery**

Return the already-rendered HTML unchanged only when `payload.parseMode == 'HTML'`; otherwise escape legacy messages. Pass `parse_mode='HTML'` only for HTML jobs, including the migrated-supergroup retry.

- [ ] **Step 7: Run both bot test suites**

Run: `python -m pytest bot/tests -q`

Run: `npx vitest run src/modules/bot-api/notifications.test.ts`

Expected: all tests PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/modules/bot-api/notifications.ts src/modules/bot-api/notifications.test.ts bot/services/notifications.py bot/tests/test_notifications.py
git commit -m "feat: deliver bot digest to group and staff"
```

### Task 3: Create and verify the square СУПА ПРО bot avatar

**Files:**
- Create: `bot/assets/supapro-bot-avatar.png`
- Create: `bot/assets/supapro-bot-avatar-preview.png`

**Interfaces:**
- Produces: a 1024×1024 PNG ready for manual upload through BotFather.

- [ ] **Step 1: Read the image generation skill and generate the asset**

Use the image generation tool with this art direction: a strict premium fleet-management emblem, deep navy square background, bold white Cyrillic monogram “СП”, minimal silver-blue car silhouette and a subtle telematics signal accent; flat vector-like geometry, centered safe area for Telegram circular crop, no small text, no gradients that reduce small-size contrast.

- [ ] **Step 2: Inspect the generated image**

Verify exact dimensions, visual centering, legibility at 128×128 and safe circular cropping. Regenerate once if the monogram is malformed or details disappear.

- [ ] **Step 3: Create the preview**

Generate a 256×256 circular-crop preview with transparent outer corners for review while preserving the untouched 1024×1024 source PNG.

- [ ] **Step 4: Commit Task 3**

```bash
git add bot/assets/supapro-bot-avatar.png bot/assets/supapro-bot-avatar-preview.png
git commit -m "feat: add supapro telegram bot avatar"
```

### Task 4: Release verification

**Files:**
- Verify only; modify files only if a test exposes a defect.

**Interfaces:**
- Consumes all outputs from Tasks 1–3.

- [ ] **Step 1: Run targeted and full verification**

Run: `npx vitest run src/modules/bot-api/operations-digest.test.ts src/modules/bot-api/notifications.test.ts src/modules/bot-api/daily-operations.test.ts`

Run: `python -m pytest bot/tests -q`

Run: `npm run typecheck`

Run: `npm run build`

Expected: every command exits 0. The existing Turbopack NFT tracing warning may remain, but no new warning may originate from the changed files.

- [ ] **Step 2: Verify the deployment payload**

Build the bot deployment archive using the existing deployment script and inspect that `bot/services/notifications.py` and both avatar assets are present. Do not deploy until the user explicitly asks to update the VPS.

- [ ] **Step 3: Commit any verification-only correction**

If no correction was needed, do not create an empty commit. If a correction was required, stage only the files changed by this plan and commit with a focused message.
