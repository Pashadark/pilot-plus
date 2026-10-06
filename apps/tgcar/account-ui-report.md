# TG CAR account UI report

Implemented local-only client and reviewer interfaces for the synthetic application workflow.

- `/account`: explicit test-client access, unavailable real-phone flow, application status/history, document upload and synthetic metadata controls, submit action, and honest empty rental/fine/payment/Telegram states.
- `/review`: explicit test-manager access, 15-second polling, document state visibility, approve/change/reject controls, reason enforcement, and a local outbox clearly marked as undelivered.
- Shared behavior: loading skeleton, fetch errors, pending-action disabling, logout, toast feedback, responsive mobile layout, Manrope/white/blue visual language, and prominent local-demo disclaimers.

Integration concern: the multipart UI expects `POST /api/applications/{id}/documents` with `kind` and `file`, as specified. This route was outside this task's file ownership and must exist for real quarantine uploads. Synthetic metadata documents work through the existing application action.

No production data was read or mutated, and no SMS, Telegram message, payment, or phone verification is represented as connected.
