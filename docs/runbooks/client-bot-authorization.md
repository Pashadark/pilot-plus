# Customer Telegram authorization and notification rollout

## Implemented and deployed

- Private-chat onboarding with Telegram's own-contact button; contact user id must equal sender id.
- Personal invitation requires matching phone index and remains unconsumed on failure.
- Without invitation, exactly one non-blocked, non-archived client with matching phone and ACTIVE/CONFIRMED rental may link. Ambiguity requires manager review. An existing disabled/conflicting identity is never overwritten.
- Contact confirmation window is ten minutes in the existing Redis FSM.
- Existing personal rental listing, document access and extension request flows are reused.
- Return reminders have 24h, 3h and 30min stages and idempotent keys including the return date. Only the current stage is selected; no catch-up burst.
- Dispatch rechecks client ownership and rental state. Superseded customer reminders transition to CANCELLED, not SENT.
- Handover, committed extension and return enqueue a separate customer notification in the existing operation transaction. No historical catch-up is performed.

## Deployment gates

### Security verification on 2026-09-29

- Queue claim now denies unknown templates, personal recipients for internal templates, mismatched company groups and disabled/wrong-company customer identities before hydration. Legacy `staff:<companyId>` is resolved only through that company's current binding.
- Identity resolution rejects multiple active matches; staff access rechecks current company membership (or active SUPER_ADMIN).
- Invitations and contact linking reject cross-company and multiple identity matches. Signed document links include the identity id and recheck active identity/client/rental ownership on every download.
- New internal queue rows are group-only; historical personal rows fail closed at claim. The worker no longer falls back to a global group for legacy destinations.
- Verification: 136 focused application tests, 32 related build-regression tests and 37 Python bot tests passed. Typecheck, scoped ESLint and local/production builds passed (existing NFT trace warning remains).
- Production checks passed: unlinked profile denied, missing contact denied, foreign contact denied. Configured bot username is `lemonme_support_bot`; its group matches the database binding. No active duplicate identities and no client identities existed at rollout.
- First successful real-customer contact onboarding must still be exercised by the customer. No real account was impersonated or linked for testing.

### Release and rollback

- App: `/opt/pilot-plus/releases/20260929-client-bot-auth`; previous: `/opt/pilot-plus/releases/20260928-workday-priorities-final`.
- Database backup: `/opt/pilot-plus/backups/20260929-bot-auth.dump` (PostgreSQL 17 custom format). Environment backup: `/opt/pilot-plus/backups/20260929-bot-auth.env` (private).
- Bot backup: `/opt/pilot-plus-backups/bot-before-auth-20260929.tar.gz`; previous image: `pilot-bot-before-auth:20260929`.
- Additive CANCELLED enum migration applied and recorded. Rollback code and image together; do not drop the enum or restore the database over live business changes.
- Twenty historical terminal ERROR queue rows remain unchanged; this rollout does not replay or erase them.

1. Design export `output/` is excluded from TypeScript; source/test compilation remains enabled.
2. Finish the unchecked lifecycle features in `docs/superpowers/plans/2026-09-28-client-bot-communication.md` before advertising the complete customer system.
3. Back up database and save both app and bot release references.
4. Apply `20260928210000_cancel_superseded_bot_notifications`, generate Prisma client, deploy app and bot together. No secrets in logs. Existing `CLIENT_SEARCH_KEY` must match the one used to index client phones.
5. Test with an authorized test rental/account: own contact, foreign contact, ambiguous phone, disabled identity, correct rental scope, extended rental cancels old reminder, returned rental cancels reminder, worker retry and actual customer buttons.
6. Confirm no old client notifications are replayed in a burst. Check outbox statuses and error counters.

## Limits

Telegram send success is not proof of reading. Document URLs are bearer links valid for at most five minutes and must not be shared; revoked identities cannot use them. No automatic vehicle immobilization or monetary penalties. No new SMS/WhatsApp/MAX outbound channel is connected. Wash/fuel self-reports, late-return requests, financial/fine/toll notifications, safety episodes and manager communication panel remain separate unfinished tasks, not part of completed authorization.
