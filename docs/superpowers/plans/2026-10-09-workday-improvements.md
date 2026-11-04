# Workday improvements implementation plan

> Execute task-by-task using executing-plans / subagent-driven-development; preserve the dirty branch. No unrelated commits or deployment changes.

**Goal:** Implement the approved graphite workday improvements and real vehicle statistics.
**Architecture:** Reuse tenant-scoped queries and the payment ledger. Small client components own day selection and attention rotation. Existing notification delivery owns Telegram deduplication.
**Tech Stack:** Next.js 16, React 19, Prisma, semantic CSS tokens, Vitest.

## Global constraints
- Canvas/header/navigation #101014; accent #0067ff; support existing light mode.
- No invented metrics. Deposits never count as rental income. Missing telemetry is missing, not zero.
- Respect tenant permissions and existing dirty files. No test Telegram messages.
- Show three attention messages at a time, rotate every 5000ms, pause on focus/hover, manual controls, reduced-motion support.

## Task 1: Shell and workday
- [ ] Tests first: navigation contains statistics and system in correct groups; scroll lock preserves width; attention changes after 5000ms and pauses; dates update events without full overview reload.
- [ ] Move health link into System group in Sidebar.tsx, keep its accessible health status. Add RENTALS-gated /statistics navigation.
- [ ] Correct shared Overlays scroll locking with width compensation and restoration, including nested overlays.
- [ ] Add WorkdayAttention.tsx, replace inline attention list in WorkdayDashboard.tsx; scope animation CSS locally.
- [ ] Isolate Workday day events in a client workspace; use existing data for covered dates and scoped fetch for other dates, maintaining stale-request safety and error feedback.
- [ ] Run focused Vitest tests and typecheck; review diff.

## Task 2: Vehicle statistics
Read .codex-tmp/statistics-brief.md for the independent module contract.
- [ ] Write failing financial/usage aggregation tests.
- [ ] Build tenant-scoped /statistics page with car selector, period selector, PNG hero, income excluding deposits, expenses, utilization, rental days/frequency, mileage, engine hours and visit heatmap when reliable data exists.
- [ ] Reuse existing data and map abstractions; no new dependencies. Missing data explicitly explained.
- [ ] Validate unit tests, types, responsive layout and permissions.

## Task 3: Low fuel
- [ ] Inspect existing LOW_FUEL event and notification rules.
- [ ] Add regression cases for fresh fuel below25%, boundary25%, stale/null readings and duplicate deliveries.
- [ ] Reuse a common rule across dashboard/bell/Telegram; re-arm only after refuelling (30% recovery threshold), no repeat for continuing low readings.
- [ ] Verify tests without external sends.

## Completion
- [ ] Scoped lint/typecheck/tests and independent review.
- [ ] Production build and browser checks before any deployment claim.
- [ ] Report exactly which pieces are delivered and any data limitations.

## Execution outcome
Deployed `20261009-workday-statistics` with previous release retained. Tasks 1 and 3 implemented; statistics implemented within available data. Engine hours and general GPS heatmap remain unavailable, clearly labeled rather than invented. 141 regression tests passed; production build and live checks passed. Verification details and rollback context: `docs/runbooks/workday-statistics-rollout.md`. Checkboxes above retain the original plan; this outcome records actual delivery and limitations.
