# Rental Actions And Payment Reconciliation Design

## Goal

Turn the active-rental overflow menu into a complete operational menu and reconcile every payable rental to 100% paid without deleting or rewriting financial history.

## Scope

The change covers the `/rentals` list, direct navigation into the existing rental detail workspace, and a one-time auditable production payment reconciliation.

Payable rentals are those in `CONFIRMED`, `ACTIVE`, or `COMPLETED` status. `DRAFT` and `CANCELLED` rentals are excluded. The reconciliation concerns rental payments (`RENT`) only; deposit payments and deposit-return statuses are not inferred or changed.

## Active Rental Menu

Every active or extended rental exposes these eleven actions in this order:

1. Open rental.
2. Edit terms.
3. Record or correct payment.
4. Manage deposit.
5. Open client.
6. Open vehicle.
7. View action history.
8. Download the latest PDF when available.
9. Download the latest DOCX when available.
10. Copy contract number.
11. Copy rental link.

The visible `Продлить` and `Завершить` buttons remain outside the overflow menu and are not duplicated in it.

Unavailable documents remain visible as disabled explanatory rows rather than dead links. Copy actions show success or failure through the existing Pilot+ toast system. Navigation remains link-based and clipboard operations remain buttons.

## Interaction Architecture

`RentalListPage` keeps responsibility for table layout and passes a small serializable row-action model into a dedicated client component. The client component owns open/close state, Escape handling, outside-click handling, focus return, clipboard writes, and toast feedback.

The menu uses existing Pilot+ semantic color, radius, focus, and surface tokens. It has clear groups for contract, related records, documents, and copying. Its trigger has at least a 40×40 px hit target. On mobile, the same actions remain reachable without horizontal overflow.

Direct links use the existing rental detail route:

- payment: `/rentals/:id?settlement=rent#rental-settlement`;
- deposit: `/rentals/:id?settlement=deposit#rental-settlement`;
- history: `/rentals/:id#rental-history`;
- terms: `/rentals/:id/edit`;
- client and vehicle: their existing detail routes.

`RentalSettlementCard` accepts a validated initial payment kind so the destination form opens with either `Аренда` or `Залог` selected. Invalid query values fall back to rental payment.

## Permissions

The menu may expose read-only navigation to every user who can view the rental. Mutating destinations continue to enforce existing server-side rental access checks. Edit links follow the existing edit-route authorization; the superadministrator retains system-wide access.

## Payment Reconciliation

A reusable dry-run-first script calculates the confirmed rental-payment balance for every payable contract:

`missing = totalPriceMinor - confirmed RENT payments`

When `missing > 0`, the script inserts one confirmed balancing payment with:

- method `OTHER`;
- an explicit owner-confirmed reconciliation comment;
- the acting superadministrator;
- a deterministic per-rental idempotency key.

Existing payments are never updated or deleted. Overpaid rentals receive no new payment. Running the script again creates no duplicates. The production run requires a fresh PostgreSQL backup, a reviewed dry-run summary, application, and a second dry-run proving zero remaining adjustments.

## Error Handling

- Clipboard failure produces a danger toast and leaves the menu usable.
- Missing PDF or DOCX produces a disabled menu item.
- Payment reconciliation aborts on database errors and runs inside a transaction.
- The script prints counts and monetary totals, but no client personal data.
- Production deployment keeps the previous release available for rollback.

## Testing And Verification

- Component tests assert all eleven active-rental actions, their order, destinations, document disabled states, and clipboard toast feedback.
- Settlement-card tests assert the requested payment kind is selected.
- Pure reconciliation-plan tests cover missing, fully paid, overpaid, draft, and cancelled rentals plus idempotency.
- Run focused tests first, then rental tests, typecheck, lint, the complete unit suite, and a production build.
- Verify the live desktop and mobile menu, production service health, and the post-apply payment report showing all payable contracts at 100%.

