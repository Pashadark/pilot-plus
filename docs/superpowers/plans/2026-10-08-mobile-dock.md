# Mobile navigation implementation

## Global constraints
Preserve all existing user changes, business behavior and desktop navigation. No commits, merges, schema changes or data writes. Work in the current approved project checkout. Mobile only below 768px. Graphite theme uses #101014 canvas, #252529 surface, #0067ff accent; light theme remains usable. Respect existing permissions. Profile/settings stay in the header.

## Task 1: Implement approved mobile dock
Create fixed rounded bottom navigation with five equal items: Главная (/), Аренды (/rentals), Карта (/map), Автопарк (/vehicles), Ещё. Icons above readable labels. Active primary route uses blue; nested routes match their parent. Ещё opens accessible bottom sheet titled Все разделы containing remaining authorized navigation routes (clients, fines, maintenance, wash, leads, devices, events, system, admin/UI kit according to existing policy). Close button, backdrop, Escape, route selection close immediately, focus restoration/trapping and reduced motion. No duplicate profile/settings in sheet. Remove redundant mobile hamburger in favor of compact brand. Dock reserves safe-area space and does not obscure map controls, page actions, cookie banner or scroll-to-top. Desktop unchanged. Reuse existing overlay/access patterns. Add focused regression tests before implementation; run shell/navigation tests and typecheck. Record exact changed file list and results in .codex-tmp/mobile-dock-report.md.

## Task 2: Review and deploy
Review scoped diff and tests; verify at mobile/desktop sizes. Inspect server disk and current release. Prepare new release from current with only scoped overlay, build, atomically activate with health checks and rollback. Verify live mobile navigation and map. Report only verified completion.
