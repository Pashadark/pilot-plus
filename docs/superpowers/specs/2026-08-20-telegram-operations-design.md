# Telegram operations bot design

## Goal

Turn the linked Pilot+ Telegram bot into an operational companion without moving rental-request decisions away from the desktop dashboard. The bot provides read-only daily awareness and guided wash/maintenance capture, while Pilot+ remains the authoritative database and authorization boundary.

## Delivery phases

The work is split into three independently deployable vertical slices:

1. Daily read-only operations: today's requests, fleet availability, group binding, and the 00:05 Moscow digest.
2. Vehicle wash workflow: vehicle selection, start, before photo, after photo, completion, and vehicle-card history.
3. Vehicle maintenance workflow: vehicle selection, start, before photo, work details, mileage, cost, after photo, completion, and rental blocking.

No slice introduces direct PostgreSQL access from the Python bot.

## Staff menu

The persistent staff keyboard contains:

- `Заявки`
- `Аренды`
- `Календарь`
- `Клиенты`
- `Автопарк`
- `Штрафы`
- `Мойка`
- `ТО`
- `Помощь`

`Заявки` is read-only and displays requests relevant to the current Moscow day. Request creation, approval, rejection, and editing remain desktop-only.

`Автопарк` displays vehicles grouped as free today, occupied, returning today, in maintenance, or otherwise unavailable. Availability is calculated by Pilot+ from rentals and maintenance, not inferred by the bot.

Inline buttons are used only for contextual actions such as selecting a vehicle or attaching the next required photo.

## Work-group binding

A `SUPER_ADMIN`, `COMPANY_ADMIN`, or `DISPATCHER` adds the bot to a Telegram group and runs `/pilot_setup`. Pilot+ re-resolves the actor's active Telegram identity and company membership, verifies the allowed role, and binds the exact Telegram group ID to that company.

One active group binding exists per company. Rebinding requires the same authorization and is audited. Private chats cannot be bound as work groups. A group bound to one company cannot be reused by another company.

## Daily digest

At 00:05 `Europe/Moscow`, the system creates one digest per bound company for the current Moscow calendar day. The digest contains:

- today's rental requests, read-only;
- office issues and deliveries, including delivery address when applicable;
- expected returns;
- vehicles free for the whole day;
- vehicles unavailable because of rental, wash, maintenance, or readiness state;
- scheduled and active maintenance.

The digest is durable and idempotent by company and Moscow date. If the bot, API, Redis, or VPS is unavailable at 00:05, recovery creates or sends the missing digest after service restoration. A successful digest is never sent twice for the same company/day.

The queue stores identifiers and operational state only. Client names, phone numbers, and delivery addresses are hydrated immediately before delivery to the already authorized bound group and are not written to logs.

## Wash workflow

Allowed roles: `SUPER_ADMIN`, `COMPANY_ADMIN`, and `DISPATCHER`.

1. Staff presses `Мойка`.
2. Pilot+ returns tenant-scoped, non-archived vehicles.
3. Staff selects a vehicle.
4. Pilot+ creates an in-progress wash record with server time and actor ID.
5. Bot requests one required `до` photo.
6. Telegram photo bytes are streamed through the protected Pilot+ upload endpoint, validated, malware-scanned, and stored privately. Telegram file identifiers alone are not treated as permanent evidence.
7. Bot requests one required `после` photo and an optional comment.
8. Pilot+ atomically completes the wash with server completion time and audit history.

The active process survives bot restarts because authoritative state is stored in Pilot+. FSM state is only a conversation cursor. Repeating a callback or upload is idempotent and cannot create duplicate active washes or duplicate evidence.

The vehicle card shows employee, timestamps, duration, before/after photos, comment, and status. An in-progress wash marks the vehicle operationally unavailable, but it does not rewrite historical rentals.

## Maintenance workflow

Allowed roles: `SUPER_ADMIN`, `COMPANY_ADMIN`, and `DISPATCHER`.

1. Staff presses `ТО` and selects a vehicle.
2. Pilot+ creates an in-progress maintenance record using server time and actor ID.
3. Bot requests one required `до` photo.
4. Bot requests the work type/description, current odometer, and cost in rubles.
5. Bot requests one required `после` photo and an optional comment.
6. Pilot+ atomically completes the record with normalized mileage, minor-unit cost, server completion time, evidence, and audit history.

Mileage must be a non-negative integer and may not be lower than the vehicle's last trusted odometer. Cost is parsed server-side into safe integer minor units. Maintenance fields and photo evidence appear in the vehicle card.

An active or scheduled maintenance interval blocks rental availability for the same half-open time range. Confirmation still performs a fresh server-side overlap and readiness check, so Telegram state can never bypass the rental guard.

## Authorization and tenant isolation

Every bot API call carries the service token and Telegram user ID. Pilot+ re-resolves:

- active Telegram identity;
- active user;
- company membership and role;
- exact company ownership of vehicle, wash, maintenance, request, and group binding.

The bot never trusts company IDs, roles, prices, mileage, timestamps, or storage keys supplied by Telegram callbacks. Callback payloads use opaque entity IDs and are bounded in length.

## Error handling and recovery

- Every callback is acknowledged.
- API failures produce a Russian retry message and preserve recoverable workflow state.
- Missing or invalid photos do not advance the workflow.
- A lost Telegram FSM session resumes from Pilot+'s active wash or maintenance record.
- A stale employee cannot finish a process after membership or role revocation.
- Storage promotion and database metadata use a durable lifecycle with bounded cleanup so crashes do not leave permanent orphaned PII files.
- Group-send failures remain retryable and do not duplicate successful digests.

## Verification

Each phase requires RED-to-GREEN tests for:

- role and company isolation;
- exact Moscow-day boundaries;
- full-day rental/maintenance availability;
- group binding and cross-company rejection;
- digest idempotency and missed-run recovery;
- wash and maintenance state transitions;
- before/after photo ordering and protected storage lifecycle;
- mileage/cost validation;
- revoked-role finalization denial;
- restart recovery and duplicate callback safety;
- persistent keyboard routing;
- real VPS container health after deployment.

Browser/dashboard tests verify that completed wash and maintenance records and their protected photos appear in the correct vehicle card. Telegram smoke verification covers group setup, digest delivery, and both guided workflows.

## Scope boundary

Rental requests remain desktop-only. This program does not add request approval/rejection to Telegram, direct bot database access, production fine payment, or unsafe public media URLs.
