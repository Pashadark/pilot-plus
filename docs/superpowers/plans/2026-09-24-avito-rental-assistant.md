# Avito rental assistant implementation plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task, with test-driven-development. Preserve unrelated dirty files.

**Goal:** Collect rental enquiries only for approved rental ads, match actual fleet availability and notify staff after 15 minutes without a human reply.

**Architecture:** Extend the existing verified webhook inbox worker. Pure parsing and decision functions feed encrypted persistent dialogue state and a durable outgoing outbox. Revalidate chat and ad before sending; uncertain sends never retry blindly.

**Tech Stack:** TypeScript, Prisma/PostgreSQL, existing Avito client and Telegram notification jobs, Vitest.

## Global constraints

- No “Я помощник TG CAR” introduction; use the approved greeting.
- Only new events after assistant activation. No sales or unknown ads, no historical outreach.
- No invented dates, mileage, phone, availability or prices. Never confirm booking.
- Human outgoing messages pause automation. Bot messages and viewing a lead do not satisfy the human-response SLA.
- Secrets remain in protected server env; no message bodies or phone numbers in logs.
- Deploy only touched files over the previous production release; retain rollback release and database backup.

## 1. Question policy and extraction

Files: `src/modules/leads/avito/rental-request.ts`, `rental-request.test.ts`.

- [ ] Write failing tests for the exact greeting, only-missing questions, Russian model aliases, ambiguous phone/model/date rejection, explicit date/time parsing in Moscow, total mileage vs daily mileage.
- [ ] Run `npx vitest run src/modules/leads/avito/rental-request.test.ts`; require failure before implementation.
- [ ] Implement `extractRentalRequest(text, now): RentalRequest`, `rentalQuestions(request): string`, `eligibleRentalAd(chat, account, activeIds): boolean` as pure functions.
- [ ] Run tests and scoped ESLint. Keep uncertain values missing rather than guessing.

## 2. Persistent dialogue, outbox and manager waiting state

Files: `src/database/prisma/schema.prisma`, additive migration, `src/modules/leads/avito/dialogue.ts` and tests.

- [ ] Define per-company/account/chat dialogue keyed by existing `avitoId`, encrypted request fields, latest customer time, last human reply, paused state and unique reminder episode.
- [ ] Test customer input starts waiting, another customer input does not postpone waiting, human reply clears it, assistant reply does not clear it.
- [ ] Add durable outgoing state: PENDING → SENDING → SENT or UNKNOWN. A SENDING row surviving restart becomes UNKNOWN, not PENDING.
- [ ] Tests must cover duplicate webhook and late/out-of-order messages without losing a human reply.

## 3. Verified provider delivery

Files: `src/modules/leads/avito/client.ts`, `verify.ts`, delivery module and tests, `scripts/run-avito-worker.ts`.

- [ ] Verify official outgoing API contract before adding a live write.
- [ ] Extend authoritative chat context with item ID and owner. Refresh active rental inventory; whitelist IDs from the approved spec only.
- [ ] Before send: re-read chat/history, stop on human reply or unknown outbound, check activation cutoff, valid rental ad and event age.
- [ ] Enforce one outgoing per incoming and no identical repeated question. Preserve Retry-After and access stop behavior.
- [ ] Reconcile uncertain sends by exact text, author and bounded timestamp, otherwise pause for manager.

## 4. Lead enrichment and fleet matching

Files: existing intake, new matching module and tests.

- [ ] Persist parsed fields into same lead; do not overwrite manually edited identity/phone.
- [ ] Read tenant-scoped non-archived vehicles, CONFIRMED/ACTIVE overlap and maintenance unavailability for requested interval.
- [ ] Append matching summary and links to encrypted lead comment. Unknown dates yield “нужно уточнить”, not “свободна”.

## 5. Reminder and rollout

Files: reminder module/tests, bot notification hydration, runbook and deployment script.

- [ ] Enqueue one reminder at 15 minutes; verify latest authoritative human activity first. API uncertainty defers, never invents a reply.
- [ ] Validate group delivery contract, prevent duplicated Telegram jobs by episode key.
- [ ] Run Avito/leads/bot tests, lint, Prisma validate, production build in staged release.
- [ ] Back up database, apply additive migration, deploy with assistant disabled and verify incoming still healthy.
- [ ] Conduct owner-controlled new rental chat; verify outgoing question, enriched lead, human handover, reminder. Then activate only the 11 approved rental IDs. No test messages to existing customers.

## Evidence

24.09.2026: 79 tests across leads, Avito and lead notifications passed. Scoped TypeScript and ESLint passed. Prisma schema validation passed; the local Windows engine remained DLL-locked, but production generation and the full production Next build passed.

Deployed `/opt/pilot-plus/releases/20260924-avito-assistant-preview`; previous release retained. Database backup `pre-avito-assistant-20260924.dump`, additive migration applied. Final empty-phone enrichment was uploaded and the worker restarted after its additional regression test passed.

Observation/collection activated for new events. Read-only live check returned 11 active rental ads, no pending/failed inbox jobs, configured staff group, zero dialogues/outgoing at activation. `AVITO_SEND_ENABLED=false`. No automatic customer messages have been sent by this extension.

Still outstanding: controlled new owner chat; verify authoritative outgoing contract and actual delivery; complete-request staff notification beyond the existing new-lead notification; uncertain-outcome reconciliation is manual fail-closed, not automatic. Assistant timer is currently serviced between inbox batches (when inbox is empty), so a sustained backlog can delay reminders. Do not claim general rollout is complete until these acceptance gaps are closed.
