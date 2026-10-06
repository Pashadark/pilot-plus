# Service history workspace — variant 2

**Goal:** Approved master/detail maintenance history, without wash history, with dated visits, line-item tables and explicit private downloads.

**Architecture:** Extract a client component from VehicleDetailPage. Reuse existing DTO and semantic tokens; no database mutation or dependency changes. Explicit imported item prefixes identify work/material; unclassified legacy items remain a separate table, never guessed. Dates prefer completion then start/planned/damage dates. No invented quantities, repair location, mileage or payment status.

**Tasks (inline execution):**
- [ ] Add failing component tests for selection, completed dates, work/material tables, unknown values, download links, empty state and absence of washes.
- [ ] Implement VehicleMaintenanceWorkspace and replace only maintenance tab content. Desktop 280px list + flexible detail; mobile stacked with bounded visit list. Keep client/rental links, description in disclosure, photos as separate attachments.
- [ ] Make authenticated attachment route accept download=1 without weakening tenant checks. Test forced attachment and ordinary preview behavior.
- [ ] Run targeted unit tests, ESLint, typecheck and production build. Inspect desktop and mobile rendering.
- [ ] Publish task-only overlay with rollback release; verify live date/tables/download headers. Do not restart or enable Avito.
