# Superadmin system monitor implementation plan

Goal: implement approved visual option 3 in the existing system, without changing the shell or reporting unverified bot health.

Architecture: a protected JSON endpoint supplies a client dashboard every 30 seconds. Server-side probes combine OS metrics and existing infrastructure/queue checks. No credentials or raw errors reach the browser. Remote bot metrics remain unknown until an authenticated monitoring channel is configured.

## Tasks
- [ ] Add regression tests for SUPER_ADMIN-only access and resource calculations.
- [ ] Add server resource collector with bounded probes, unknown states and explicit timestamps.
- [ ] Add protected API and replace /system content with responsive card grid, filters, refresh and stale-data handling.
- [ ] Hide navigation and system summaries from other roles.
- [ ] Verify targeted tests, lint, types, production build and browser rendering.

Constraints: retain existing menu; no fake metrics, no SSH bypass, no automatic restart/cleanup, no enabling Avito replies. Preserve the previous release. History must be labelled according to its actual retention/source, not invented from examples.

## Live bot monitoring extension
- Dedicated SSH key generated on the application host; forced read-only command on the bot host. Pinned host key obtained over the existing verified SSH connection.
- Root-owned systemd timer collects bounded JSON every 15 seconds into an atomic local file; no keys exposed to the application or browser.
- Dashboard refresh every 15 seconds; remote readings older than 60 seconds become unknown.
- Container health and Telegram delivery queue are separate cards. SSH round-trip includes collector time and is labelled accordingly, not ICMP ping.
- Regression verification: 37 targeted tests, scoped TypeScript, scoped ESLint passed. Persistent event history is not part of this extension.
