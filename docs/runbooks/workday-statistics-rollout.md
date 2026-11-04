# Workday and statistics rollout — 2026-10-09

## Deployment

Active release: `/opt/pilot-plus/releases/20261009-workday-statistics`.
Previous release retained: `/opt/pilot-plus/releases/20261009-graphite-only`.
Service: `pilot-plus`; current symlink: `/opt/pilot-plus/current`.
Deployment script: `.codex-tmp/deploy-workday-improvements.sh`.
No database migration or test Telegram messages were performed.

Rollback: repoint the current symlink atomically to the retained previous release, restart `pilot-plus`, and verify health and an authenticated page. Do not remove either release before verification.

## Verification

- Production build and deployment health check passed.
- Focused regression suite: 141 tests in 19 files passed.
- Typecheck and scoped lint passed during implementation.
- Live navigation includes Statistics under Operations and system health under System.
- Selecting 10 October changes events and calendar without a full-page navigation.
- Search opening preserves heading position (x=260 before and after).
- Dark canvas is rgb(16,16,20), matching #101014.
- Mobile viewport: document width and scroll width both 380; heading remains within bounds. The screenshot provider did not produce a reliable mobile capture; desktop screenshot saved in `.codex-tmp/workday-statistics-live.png`.
- Live statistics shows real rental income, expenses, utilization and vehicle PNG.
- Only three current attention items existed during browser verification; rotation and pause behavior verified by unit tests, not a fabricated production alert.

## Data boundaries

- Fuel alerts use fresh readings below 25%, stable episode keys and recovery at 30%; unknown/stale data does not trigger a low-fuel alert.
- Rental income excludes deposits; expense coverage is completed maintenance, repairs and washes, not a complete profit calculation.
- Rental mileage requires handover/return readings; missing coverage remains explicit.
- Engine hours remain unavailable until ignition history is collected.
- Visit visualization covers recorded fuel-station visits only; general GPS visit/parking history is not yet connected.
