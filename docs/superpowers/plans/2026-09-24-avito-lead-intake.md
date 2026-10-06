# Avito lead intake implementation plan

> Use executing-plans task-by-task. No unrelated changes or outbound customer messages.

**Goal:** New incoming Avito messages create/update one SUPA PRO lead per chat and enqueue one manager notification.

**Architecture:** Secret webhook queues identifiers only in PostgreSQL. Single worker fetches authoritative message and chat from Avito, checks account/direction/activation boundary, then transactionally saves encrypted lead text, audit, deduplication state and existing bot outbox. Credentials remain in protected server environment.

**Stack:** Existing Next 16 / Prisma 6 / PostgreSQL / TypeScript / Vitest. No new dependencies.

## Constraints
- Only provider message timestamps at or after AVITO_ENABLED_AT; never import historical messages.
- Never reply, mark chats read, book cars or mutate listings.
- Server configuration controls company/account/operator. Do not trust callback text.
- Preserve manager status/name/contact edits; append original messages, no synthetic phone.
- Respect Retry-After; stop on authentication/subscription failures; no browser scraping.
- Existing subscriptions inspected: zero on 24 September. Registration only after deployed receiver validation.

## Tasks
- [ ] Provider contract and safety client: `src/modules/leads/avito/client.ts` and `client.test.ts`. Tests cover token caching, read-only endpoint allowlist, no redirects, 429 cooldown and 401/403/402 stop. Verified API paths: token, core self, messenger v2 chat, messenger v3 messages. POST subscriptions is a read-only diagnostic, never worker work.
- [ ] Domain guards and extraction: `src/modules/leads/avito/message.ts` / `.test.ts`. Test new inbound, outgoing/old/system rejection, explicit duration/phone, no inferred dates, safe deterministic IDs per company/account/chat/message. Text is always preserved for manager review.
- [ ] Durable queue and intake: additive `AvitoInboxEvent` schema/migration; `queue.ts`, `intake.ts`, tests. Queue stores IDs only, bounded admission. Transaction checks operator/company, deduplicates event, appends encrypted original text without changing status, creates audit and calls `enqueueWebsiteNotifications` only on first lead.
- [ ] Receiver/worker: `src/app/api/integrations/avito/[secret]/route.ts`, `scripts/run-avito-worker.ts`. Limit streamed body to 16 KiB, compare secret constant time, return 503 on database failure. Worker takes one job, retries with backoff, API-verifies content before writing. Unknown callbacks ignored, not accepted as lead data.
- [ ] Missing-phone display: LeadsPage and bot formatter show “Телефон не указан” rather than blank tel link. Run relevant regression tests.
- [ ] Deployment: protect env file, preserve current release and database backup, apply additive migration, generate Prisma, build, start receiver, register single webhook and verify subscription. Start worker only after dry-run. Do not claim real delivery until an actual new message traverses lead + bot queue.

## Verification commands
`npx vitest run src/modules/leads src/modules/bot-api/lead-notifications.test.ts`
`npx prisma validate`
`npx eslint src/modules/leads/avito scripts/run-avito-worker.ts`
Production `npm run build`, health and authenticated lead page check. Previous release remains rollback; disable worker/webhook without deleting imported leads.

## Deployment evidence — 24 September
- Local scoped tests: 39 passed, 12 files. Scoped ESLint clean; Prisma validate passed.
- Local Prisma generate blocked by Windows DLL lock even outside sandbox; production generate succeeded.
- Production database backup created; only additive Avito migration applied (prior 57 migrations were current).
- Production build and TypeScript passed; known unrelated NFT tracing warning remains.
- Release `/opt/pilot-plus/releases/20260924-avito` published; `AVITO_DEPLOY_OK`, web service active.
- Real API dry-run verified chat/message; old message rejected; zero DB writes.
- Receiver health POST returned 200. Avito registration POST returned 200; subscription list verified exactly our one callback.
- `pilot-plus-avito.service` enabled; separate env permissions 0600. Telegram group exists; queue was empty and recent existing notifications were SENT.
- No customer message was sent. Real new-message → lead → Telegram end-to-end confirmation is still pending the first incoming customer message; do not describe it as already tested.
