# Avito single reply and flexible input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Recognize customer shorthand and send at most one introductory rental reply; hand completed enquiries to staff without further customer automation.

**Architecture:** Keep encrypted dialogue drafts and the durable outbox. Normalize calendar language before the existing validated calendar parser. Use outgoing SENT/SENDING/UNKNOWN records as the durable one-response gate; retain the manager reminder independently. Defer new Lead creation until the structured request is complete, then save accumulated messages and notify staff transactionally.

**Tech Stack:** TypeScript, Prisma, PostgreSQL, Vitest, existing Avito API worker.

## Execution result

Implemented and deployed to the current production worker on 2026-09-24. 131 tests passed (21 files), scoped TypeScript and ESLint passed. Production smoke checks passed for named/omitted months, bare duration and punctuated phone; send flag and original cutoff retained. Previous sources archived at `/opt/pilot-plus/backups/avito-before-single-reply-20260924.tar.gz`. No customer messages or test leads were fabricated for verification. Both web and Avito services active after rollout. Document processing remains deferred to its own stage.

## Global Constraints
- Moscow dates. Future day-only ranges use the current month; past/invalid dates remain unresolved. Named months override the current month. No invented hours.
- Normalize voluntarily supplied phone punctuation; never send evasion instructions or disguised numbers.
- Only approved active rental ads and new inbound events. Human handover and uncertain-send fail-closed rules preserved.
- Existing leads and manual values preserved. Documents are a separate, later stage.

### Task 1: Parsing
- [ ] Add regression tests for named Russian months, current-month day-only ranges, single named start, bare durations, punctuated phone, invalid lengths/calendar dates.
- [ ] Run `npx vitest run src/modules/leads/avito/rental-request.test.ts src/modules/leads/avito/message.test.ts` and observe missing-feature failures.
- [ ] Add isolated `date-language.ts` normalization; feed it into the existing validated calendar parser. Anchor month/year to the customer message; duration without start stays partial. Match phones as complete 11-digit punctuation-separated candidates, never a substring of a longer number.
- [ ] Run parser tests and scoped TypeScript check.

### Task 2: One response and completed lead handoff
- [ ] Tests: SENT/SENDING/UNKNOWN means no second job; complete first message creates no question job; worker cancels pre-existing follow-up jobs. Incomplete request makes no new Lead; completed request creates lead with accumulated history and normalized phone.
- [ ] Gate store and delivery with persisted outgoing history. Cancel stale pending jobs rather than replaying them. Remove dependency on Lead existence for a first question, since the draft is authoritative.
- [ ] In intake, leave incomplete new enquiries in AvitoDialogue, mark inbox processed. Ready enquiries create Lead plus existing staff notification in one transaction; legacy leads retain normal updates.
- [ ] Run all lead/notification tests, scoped TypeScript and ESLint.

### Task 3: Deployment and verification
- [ ] Archive only changed Avito sources on production; deploy worker-only code, restart only Avito service. Preserve launch cutoffs and credentials.
- [ ] Read production flags/service state; run representative parser and one-response checks without sending messages or fabricating incoming events.
- [ ] Report actual verification and preserve rollback archive. Do not claim an unseen customer round trip.
