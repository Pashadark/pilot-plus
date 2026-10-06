# Client menu implementation

Approved design: two rows of rental/extension and fines/documents, then manager contact; private chats only. Use native blue/green button styles. Staff menu remains staff-only.

- [x] Add scoped client fines query and API: exact company/client, manager confirmation required, explicit DTO, pagination. No staff links or other clients' invoices.
- [x] Add manager question API: authenticated CLIENT, bounded text, optional own confirmed fine, current company group only, idempotent queue record.
- [x] Implement Python menu, live remaining-time formatter, fines/documents handlers, question FSM and menu return; clear old reply keyboard for clients.
- [x] Test scope denial, formatting, callbacks and service auth, typecheck/build; deploy app and bot preserving rollback.

Payment currently requests a payment link from the manager: no verified production payment URL is stored in the current invoice module. Never send a sandbox or staff-only page to customers. No payment status is changed by clicking.

Verification: 42 bot tests and 94 API tests passed; typecheck, scoped lint and production build passed. App release: 20260929-client-menu; previous: 20260929-fine-notice-details. Bot rollback image: pilot-bot-before-menu:20260929. Live fines/support requests from an unlinked Telegram identity returned 401 IDENTITY_REQUIRED. Real-client interactive acceptance remains to be performed from an authorized client account.
