# Avito profile switch

Approved: owner-only switch controls outgoing automatic replies, not intake. Default off; fresh enable cutoff; cancel pending replies on every state change. Existing chats never restart. No systemd or shell execution from web requests.

Persistence: append-only SYSTEM audit events scoped by company and entityId `avito-autoreply:<companyId>`. Latest event is the configuration; absent/malformed configuration fails closed. PostgreSQL advisory lock serializes changes. Authorize using active SUPER_ADMIN plus bound company group owner and membership. No secrets sent to the browser.

UI: existing Card, semantic surface/primary tokens, compact label, 44px touch target with pill track and inner shadow, pending/error/status text. Place directly in Profile below existing workspace. Accessible switch and explicit update time.

Owner design revision: move the card inside the owner-only «Автоматизация» profile tab. The visible switch track is 44×24px within a 44×44px button. Header shows Avito's four-colour mark and name; body explains rental enquiries, dates/mileage/phone collection, fleet matching and manager handoff. Preserve the child state across tab changes; no control appears below the profile anymore. Eight profile tests pass, including hidden-by-default tab content and server-confirmed switch state. Existing backend behaviour is unchanged.

- [x] Test default-off, strict parsing, authorization, queue cancellation and cutoff.
- [x] Add control repository, server actions and profile component.
- [x] Worker reads control each cycle and immediately before send; disabled intake still creates leads. On enable reject chats with older dialogue creation/first message.
- [x] Run focused tests, lint, typecheck; build release overlay from current production.
- [x] Deploy with rollback, restart intake with default off, check persisted state and outgoing counts.

In-flight provider requests cannot be recalled; UI explains this without claiming Telegram or Avito messages can be unsent.

Verified: 123 tests / 16 files passed, scoped TypeScript and ESLint passed, production Next build passed (pre-existing tracing warning in document OCR). Live release `/opt/pilot-plus/releases/20260924-avito-profile-control`; prior release retained. Web and intake services active, ownerAllowed=true, enabled=false. SENT count remained 4 across activation. Intake may queue pending candidates while disabled, but dispatch is gated and every control change cancels all pending candidates before recording the fresh cutoff. No real outgoing message was sent for testing. Public /profile returns expected authentication redirect (307).
