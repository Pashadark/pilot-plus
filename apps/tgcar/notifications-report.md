# Notification domain verification

Scope was limited to the local TG CAR reminder domain and its disabled-by-default
Telegram adapter. No production service, credentials, database, or real customer
messages were accessed.

## Implemented behavior

- `buildReminderEvents(rental, now)` emits deterministic 24-hour and 3-hour
  reminders only for active, not-yet-ended rentals.
- Reminder dedupe keys include rental ID, revision, normalized end time, and
  milestone. `isReminderCurrent(event, rental)` rejects reminders made obsolete
  by status, revision, end-time, rental, client, or key changes.
- `telegramDelivery(event, config, fetchImpl)` makes no request unless explicitly
  enabled with both a token and chat ID. It sends plain text with a bounded
  timeout, reports successful Telegram `ok: true` responses, retries 429/5xx and
  network or response-body transport failures, and classifies 403 as permanent.
  Provider errors and thrown network details are not exposed, so tokens cannot
  leak through results.

## TDD evidence

- RED: `node --test notifications.test.mjs` failed with
  `ERR_MODULE_NOT_FOUND` before `notifications.mjs` was created.
- GREEN: the same focused command passed 7/7 tests after the minimal
  implementation was added.

The focused regressions also confirm that a rejected HTTP response-body read is
retryable and that a stalled request is aborted at the configured timeout. User
timeouts are clamped to the bounded range of 1–10,000 milliseconds, with a
5,000-millisecond default.

The adapter tests use injected mock fetch implementations only. There were no
live Telegram sends.
