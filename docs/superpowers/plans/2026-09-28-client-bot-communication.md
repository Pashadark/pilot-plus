# Client bot authorization and notifications implementation plan

> **For agentic workers:** Use executing-plans to implement sequentially. Preserve all pre-existing changes.

**Goal:** Connect customer identity verification, rental information and reliable customer notifications to the existing Telegram bot.

**Architecture:** Extend the existing authenticated bot API and PostgreSQL notification outbox. Telegram owns contact proof; the API verifies the phone against the encrypted client search index. No vehicle commands, automatic penalties or payment assumptions.

**Tech Stack:** Next.js 16.2 route handlers, Prisma 6, TypeScript, aiogram 3, pytest, Vitest.

## Global constraints

- Private chats only for customer authorization and private rental data.
- A forwarded contact or plain phone text is not identity proof.
- Single-use client invitations require the matching contact before consumption; staff invitations retain existing behavior.
- QR without a personal invitation must not disclose data; manager invitation remains fallback.
- Every query is company/client scoped. Disabled identities stay disabled.
- No production deployment or customer messages until verification.
- Sent does not mean read. Existing outbox retries and idempotency remain authoritative.

## Task 1 — verified contact authorization

Files: `bot/handlers/start.py`, `bot/states/authorization.py`, `bot/keyboards/client.py`, `bot/services/pilot_api.py`, `src/modules/bot-api/contracts.ts`, `src/modules/bot-api/invitations.ts`, associated tests.

- [x] Test no contact, wrong contact, matching normalized phone, disabled/conflicting identity, and group chat rejection.
- [x] Run tests and observe expected failures.
- [x] Add optional contact proof fields to link schema. For CLIENT require sender/contact ids equal and phone blind index matching client. Do not consume invite on rejection.
- [x] Keep pending invite in Redis FSM with a bounded lifetime; show native contact button, verify own contact in private chat, then link and clear FSM.
- [x] Run Python and Vitest regressions.
- [x] Support first visit without invitation using a unique phone-index match with an ACTIVE/CONFIRMED rental; otherwise require manager review. Existing identities cannot be silently overwritten or reactivated.

## Task 2 — timely return notifications

Files: `src/modules/bot-api/client-return-reminders.ts`, `src/modules/bot-api/notifications.ts`, `bot/services/notifications.py`, tests.

- [x] Test 24h/3h/30min stages, changed return dates, disabled identity and completed rental suppression.
- [x] Use stable stage keys and current rental state at dispatch. Suppress expired stages instead of sending three old reminders at once.
- [x] Attach existing client rental/extension menu to reminders. Dedicated late/wash/fuel replies remain below.
- [x] Verify queue regression and bot delivery tests.

## Remaining lifecycle integration

- [ ] Customer response records and manager tasks: late return, wash/fuel self-report, questions.
- [x] Handover/extension/return notifications enqueue transactionally for linked clients, independent of staff group presence.
- [ ] Booking confirmation and verified financial notifications.
- [ ] Confirmed-driver fine/toll notifications and dispute path.
- [ ] Safety notifications with episode deduplication and no immobilization.
- [ ] Manager communication panel, invite/revoke controls and delivery history.
- [ ] Production build, staged smoke test, backup and coordinated app/bot release.

## Verification

Run targeted `npx vitest run src/modules/bot-api/invitations.test.ts src/modules/bot-api/notifications.test.ts src/modules/bot-api/client-return-reminders.test.ts`, `python -m pytest bot/tests`, scoped ESLint and TypeScript checks. Do not mark remaining lifecycle functionality complete based only on authorization tests.

## Current verification / rollout status

2026-09-28: bot suite 35 passed; extended API/rental regression 101 passed before three additional identity-conflict cases, contact suite subsequently 7 passed. Scoped ESLint and Prisma validation pass. Production JS compilation succeeded, but overall build/typecheck is blocked by pre-existing incomplete exports under `output/supapro-design-pack` and unrelated existing test type errors. No production deployment or database migration performed. Migration adds CANCELLED to BotNotificationStatus and must precede the app update. Deploy app and Python bot together because client invitations now require contact proof.
