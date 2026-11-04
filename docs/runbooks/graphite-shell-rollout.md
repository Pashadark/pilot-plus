# Graphite shell rollout — 2026-10-08

## Scope

Graphite appearance uses the neutral palette supplied by the owner. Existing classic,
Obsidian and Material appearances remain available in the header profile menu. The
first visit after rollout selects Graphite dark and stores the former appearance in
`pilot-previous-interface` / `pilot-previous-theme`. Later choices are respected.

No database migrations, seeding, contract changes, payment changes or document moves.

Cookie preference is stored under `pilot-cookie-choice-v1`. Both choices dismiss the
banner persistently. No analytics tracker is installed by this change; essential
authentication cookies continue to function. Any future optional analytics must
explicitly check consent before loading (not merely inspect banner visibility).

## Deployment locations

- Host: existing production host serving supapro.ru.
- Previous release: `/opt/pilot-plus/releases/20261007-rental-booking-polish-3b13e24`
- New release: `/opt/pilot-plus/releases/20261008-graphite-shell`
- Archive: `/opt/pilot-plus/backups/20261008-before-graphite.tar.gz`
- Checksum: archive path plus `.sha256`.

The archive includes the previous application source and compiled output, excluding
`node_modules`, `.next/cache` and `.git`. Dependencies can be restored using the saved
lockfile. This is an application rollback archive, not a database backup. The previous
release is also retained for immediate rollback.

## Rollback

Verify the previous release exists and contains its dependencies before switching.
Create a new temporary symlink to that exact previous release, atomically replace
`/opt/pilot-plus/current`, restart `pilot-plus`, then check `/login` and an authenticated
page. Do not restore or alter the database for this appearance-only rollback.

## Deployment validation

Run shell, theme, cookie and dashboard tests before building. The previous production
release contained an outdated `CommandCenterDashboard.test.tsx`; its WorkdayBoard and
KPI implementation hashes matched the local checkout. Deploy the current dashboard
test along with the cosmetic change so tests reflect the already-running flow.

Check desktop and mobile layout, menu disclosure, profile menu, theme restoration,
cookie rejection persistence and browser errors after switching.

Verified on deployment: all 44 targeted tests passed locally and on the server;
local typecheck and changed-file ESLint passed; production build completed. Browser
checks at 390px and 1440px found no horizontal overflow. Mobile menu disclosure and
closing worked, cookie rejection survived reload, previous appearance could be
selected and Graphite restored, and the online map rendered in the new theme.
No browser console errors were observed in the checked dashboard session.
Build emitted an existing-style broad file-tracing warning from the document OCR
route importing `next.config.ts`; it did not prevent compilation or deployment.
