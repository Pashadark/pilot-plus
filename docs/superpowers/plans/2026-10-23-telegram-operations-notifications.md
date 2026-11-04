# Telegram Operations Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized Supa Pro Telegram digest with three bounded messages and add real, data-backed action buttons to operational notifications.

**Architecture:** TypeScript remains the source of truth for database reads, authorization, formatting, and action descriptors. The Python aiogram bot delivers the prepared message parts and renders only allow-listed buttons; callbacks that mutate state call authenticated Supa Pro API endpoints. The daily digest is delivered as three independent idempotent notification jobs so retrying one part cannot duplicate the other parts.

**Tech Stack:** Next.js 16 server routes, TypeScript, Prisma/PostgreSQL, Vitest, Python 3, aiogram 3, pytest.

## Global Constraints

- Product copy uses only **Supa Pro** or **СУПА ПРО**.
- Telegram HTML is escaped and each message stays below 3900 UTF-16 code units.
- Critical content is delivered first; tracker and totals sections follow.
- Problem lists stop at 20 items, return lists at 10, with `…и ещё N`.
- Telegram callback data contains no phone number, secret, or personal data.
- Mutating actions are authorized and idempotent on the Supa Pro server.
- Vehicle blocking remains hidden until a real telematics blocking command exists.

---

### Task 1: Three bounded digest formatters

**Files:**
- Modify: `src/modules/bot-api/operations-digest.ts`
- Modify: `src/modules/bot-api/operations-digest.test.ts`

**Interfaces:**
- Produces: `formatOperationsDigestParts(input): readonly [DigestMessagePart, DigestMessagePart, DigestMessagePart]`
- Produces: `DigestMessagePart = { key: 'critical' | 'trackers' | 'totals'; message: string }`

- [ ] **Step 1: Write failing tests** for three ordered parts, explicit empty states, HTML escaping, tree formatting, phone/money formats, 20/10 truncation, and the 3900-unit ceiling.

```ts
const parts = formatOperationsDigestParts(fixture());
expect(parts.map((part) => part.key)).toEqual(['critical', 'trackers', 'totals']);
expect(parts[0].message).toContain('✅ <b>Критических проблем нет</b>');
expect(parts[1].message).toContain('✅ <b>Все автомобили на связи</b>');
expect(parts[2].message).toContain('✅ <b>Возвратов на сегодня нет</b>');
expect(parts.every((part) => utf16Length(part.message) <= 3900)).toBe(true);
```

- [ ] **Step 2: Run the focused test and verify RED.**

Run: `npx vitest run src/modules/bot-api/operations-digest.test.ts`

- [ ] **Step 3: Implement the three focused formatters** using shared `tree`, `limitRows`, `formatPhone`, `money`, `escapeHtml`, and Moscow-time helpers.

- [ ] **Step 4: Run the focused test and verify GREEN.**

- [ ] **Step 5: Commit only the formatter and test files.**

---

### Task 2: Idempotent three-part notification jobs

**Files:**
- Modify: `src/modules/bot-api/notifications.ts`
- Modify: `src/modules/bot-api/notifications.test.ts`

**Interfaces:**
- Consumes: `formatOperationsDigestParts(input)` from Task 1.
- Produces: three jobs with event keys ending in `:critical`, `:trackers`, and `:totals`.
- Produces payload: `{ message, parseMode: 'HTML', actions: NotificationAction[] }`.

- [ ] **Step 1: Write failing tests** proving that one daily run creates three ordered, uniquely keyed jobs per destination and that each hydrated part contains exactly one navigation action.

```ts
expect(rows.map((row) => row.eventKey)).toEqual([
  `daily-operations:${companyId}:${date}:group:critical`,
  `daily-operations:${companyId}:${date}:group:trackers`,
  `daily-operations:${companyId}:${date}:group:totals`,
]);
```

- [ ] **Step 2: Run the focused notification test and verify RED.**

- [ ] **Step 3: Add the `part` field to the existing JSON payload**, keep the existing template name, hydrate only the requested part, and attach `summary_section` or `summary_refresh` actions.

- [ ] **Step 4: Run notification and routing tests and verify GREEN.**

- [ ] **Step 5: Commit the notification job change.**

---

### Task 3: Safe Telegram action keyboard

**Files:**
- Create: `bot/keyboards/notifications.py`
- Modify: `bot/tests/test_keyboards.py`
- Modify: `bot/tests/test_notifications.py`

**Interfaces:**
- Produces: `notification_actions(actions: list[dict]) -> InlineKeyboardMarkup | None`.
- Allow-list: `summary_section`, `summary_refresh`, `phone_url`, `map_url`, `contract_url`, `decree_url`, `payment_url`, `remind`, `vehicle_block_confirm`.

- [ ] **Step 1: Write failing Python tests** for URL buttons, callback buttons, hidden invalid actions, callback length, and absence of phone/PII in callback data.

```py
markup = notification_actions([{"type": "phone_url", "label": "📞 Позвонить", "url": "tel:+79991234567"}])
assert markup.inline_keyboard[0][0].url == "tel:+79991234567"
```

- [ ] **Step 2: Run `pytest bot/tests/test_keyboards.py bot/tests/test_notifications.py -q` and verify RED.**

- [ ] **Step 3: Implement the allow-listed keyboard factory** and reject unknown schemes, oversized callback data, and incomplete actions.

- [ ] **Step 4: Verify GREEN and commit.**

---

### Task 4: Deliver digest parts and individual notification buttons

**Files:**
- Modify: `bot/services/notifications.py`
- Modify: `bot/tests/test_notifications.py`
- Modify: `src/modules/bot-api/operational-alerts.ts`
- Modify: `src/modules/bot-api/operational-alerts.test.ts`
- Modify: `src/modules/bot-api/rental-lifecycle-notifications.ts`
- Modify: `src/modules/bot-api/rental-lifecycle-notifications.test.ts`

**Interfaces:**
- Consumes: payload `actions` from Task 2 and keyboard factory from Task 3.
- Produces formatted fine, GPS, extension, return deadline, completed rental, next-day return, and border alerts with data-backed actions.

- [ ] **Step 1: Add failing formatter tests** for the approved tree layout, Moscow time, decimal comma, optional phone, and hidden vehicle-block action without integration capability.

- [ ] **Step 2: Add failing Python delivery tests** asserting `reply_markup` is attached to HTML notifications and the job is acknowledged only after Telegram accepts it.

- [ ] **Step 3: Implement the approved text templates and action descriptors** using entity IDs and validated Supa Pro URLs.

- [ ] **Step 4: Update `send_notification` to pass `notification_actions(payload.actions)`** while preserving the existing client menu behavior.

- [ ] **Step 5: Run focused TypeScript and Python suites and verify GREEN.**

- [ ] **Step 6: Commit the templates and delivery integration.**

---

### Task 5: Authorized reminder and blocking callbacks

**Files:**
- Create: `bot/handlers/notification_actions.py`
- Modify: `bot/main.py`
- Modify: `bot/services/pilot_api.py`
- Create: `bot/tests/test_notification_actions.py`
- Create: `src/app/api/bot/v1/notification-actions/route.ts`
- Create: `src/app/api/bot/v1/notification-actions/route.test.ts`
- Create: `src/modules/bot-api/notification-actions.ts`
- Create: `src/modules/bot-api/notification-actions.test.ts`

**Interfaces:**
- Produces API command `{ actionId: string; action: 'REMIND' | 'BLOCK_VEHICLE'; confirmationToken?: string }`.
- Produces audit-safe response `{ ok: boolean; status: 'DONE' | 'CONFIRM_REQUIRED' | 'UNAVAILABLE' }`.

- [ ] **Step 1: Write failing server tests** for company/role checks, idempotency, confirmation, audit logging, and `UNAVAILABLE` when no blocking adapter exists.

- [ ] **Step 2: Write failing bot handler tests** for confirmation flow and user-facing alerts.

- [ ] **Step 3: Implement the authenticated server command and API client method.**

- [ ] **Step 4: Implement and register the aiogram callbacks.**

- [ ] **Step 5: Run all focused tests and verify GREEN.**

- [ ] **Step 6: Commit the action flow.**

---

### Task 6: Regression verification and production rollout

**Files:**
- Modify only if verification exposes a defect in the files above.

- [ ] **Step 1: Run TypeScript tests.**

Run: `npx vitest run src/modules/bot-api/operations-digest.test.ts src/modules/bot-api/notifications.test.ts src/modules/bot-api/operational-alerts.test.ts src/modules/bot-api/rental-lifecycle-notifications.test.ts src/modules/bot-api/notification-actions.test.ts`

- [ ] **Step 2: Run Python bot tests.**

Run: `python -m pytest bot/tests/test_keyboards.py bot/tests/test_notifications.py bot/tests/test_notification_actions.py -q`

- [ ] **Step 3: Run static verification.**

Run: `npm run typecheck && npm run build`

- [ ] **Step 4: Deploy through the blue/green script**, verify `/login`, claim one test digest in a non-production chat, and inspect service logs for delivery errors.

- [ ] **Step 5: Verify the production canary** for HTTP status, response time, service memory, and absence of new errors before declaring completion.
