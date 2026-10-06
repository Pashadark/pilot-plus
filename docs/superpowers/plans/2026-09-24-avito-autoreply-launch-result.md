# Avito auto-reply launch — 2026-09-24

- Worker deployed to the current production release, `20260924-avito-assistant-preview`; web app not rebuilt/restarted for this worker-only change.
- Backup: `/opt/pilot-plus/backups/avito-autoreply-20260924/` (source archive and protected env copy).
- `AVITO_SEND_ENABLED=true`; fresh `AVITO_SEND_ENABLED_AT` set at launch. Both outgoing creation time and incoming customer timestamp checked against cutoff; old jobs expire/cancel.
- One explicitly controlled owner-test reply sent; returned provider message ID verified against message history with matching text. No historical bulk replay.
- Only the owner test dialogue manually resumed. Other human-managed dialogues remain paused. Resume timestamp protects against delayed old human webhooks.
- New rental enquiries use live fleet, ACTIVE/CONFIRMED rentals, maintenance, Moscow today/tomorrow. Expected returns remain conditional; overdue ACTIVE rentals excluded. Late expected returns checked against the full shifted rental duration.
- Missing model/date-time/total mileage/phone requested. Fully populated requests also receive availability acknowledgement. No auto-booking or payment.
- Approved active rental-ad allowlist remains in force; sales excluded. Unknown delivery result never retries automatically. One serial API worker, rate limiting preserved.
- Verification: 96 tests passed across 21 files; scoped TypeScript check passed. Production service active; API send verified in owner test chat. A fresh customer-message round trip after general enable still requires an incoming customer message; none fabricated.

Rollback: stop `pilot-plus-avito`, restore the scoped source archive and protected Avito env from the backup, then start the service. Do not change encryption keys or restore unrelated web/database state.
