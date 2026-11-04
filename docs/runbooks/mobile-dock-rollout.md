# Mobile dock rollout — 2026-10-08

Released to `/opt/pilot-plus/releases/20261008-mobile-dock`; previous release retained at `/opt/pilot-plus/releases/20261008-brand-blue`.

Mobile navigation: Главная, Аренды, Карта, Автопарк, Ещё. Shared existing permission policy; More uses the accessible modal boundary styled as a bottom sheet. Desktop navigation preserved. No database changes.

Validation: 60 focused unit tests passed, typecheck and scoped ESLint passed. Final server build exited 0. Atomic activation returned MOBILE_DOCK_DEPLOY_OK after login health check.

Live checks at 390px: five dock targets approximately69×54px; active graphite blue rgb(0,103,255) with white label; no horizontal overflow. More opens and closes with Escape and close button. Map bottom756px, dock top768px. Light theme uses white dock surface. At1280px dock hidden and desktop sidebar visible.

Screenshots stored locally at `.codex-tmp/mobile-dock-home.png` and `.codex-tmp/mobile-dock-live.png`; not publicly uploaded because they contain live operational data.

Rollback: atomically repoint `/opt/pilot-plus/current` to the retained previous release, restart `pilot-plus`, verify `/login` health. No backups deleted.
