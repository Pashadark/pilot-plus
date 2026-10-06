# TG CAR launch readiness — 2026-09-20

## Published 2026-09-20

- Live: https://tgcar.ru; HTTP and www redirect to canonical HTTPS.
- Public service: `tgcar`, loopback 3105, current directory `/opt/tgcar/releases/20260920-public-v2/tgcar`.
- Private integration: `tgcar-integration`, loopback 3106, `/opt/tgcar/integration-20260920`. Built from a copy of the existing production release plus only TG CAR integration routes. Original SUPA PRO service/release was not replaced or restarted.
- Environment: `/etc/tgcar.env`, `/etc/tgcar-integration.env`, mode 0600; integration also uses `/etc/pilot-plus.env`. Never print or commit these values.
- nginx: separate `/etc/nginx/sites-available/tgcar`. Certificate expires 2026-12-19; certbot timer enabled and deploy reload hook installed.
- 36 frontend tests pass; production build passes. Server smoke test passes HTTPS pages, 17-car catalogue, vehicle image, hidden demo routes, foreign-origin rejection, one persisted encrypted lead, and idempotent retry.
- One clearly labelled synthetic lead remains: `tgcar_5079fe1c7341f7ec04b777148bce3879f869d274`, name `ТЕСТ запуска TG CAR — не клиент`. No client, rental, payment or message was created by the test.
- Mobile card screenshot checked at 390px viewport (375px content width), no horizontal overflow. Native date control interaction crashes the Codex in-app browser; full browser form interaction is NOT verified. HTTP form pipeline is verified. Recheck date entry on actual mobile Safari/Chrome.
- Payment, phone authentication, document upload and Telegram delivery remain disabled/not connected publicly. Public account/review and demo APIs are blocked by nginx.
- Privacy/consent texts describe the active contact request only, use supplied proprietor/address, and keep marketing consent separate. Owner still needs legal review, operator-notification/registry and data-location confirmation; technical launch is not a legal compliance certification. Reference for separate consent: https://www.consultant.ru/document/cons_doc_LAW_61801/6c94959bc017ac80140621762d2ac59f6006b08c/

### Operational notes

The existing storage adapter chmods its root even on read, so integration requires `/opt/pilot-plus/shared/private` in systemd ReadWritePaths. Only the tenant-scoped selected vehicle image is exposed. No private storage directory is served by nginx.

Previous frontend release is `/opt/tgcar/releases/20260920-public/tgcar` (pre-final cookie wording). Roll back TG CAR alone by updating its WorkingDirectory and ReadWritePaths, daemon-reload, restart `tgcar`; do not change `pilot-plus`. A failed integration should return unavailable rather than stale availability or false success.

## Historical pre-launch checks (superseded)

Read-only infrastructure checks:
- tgcar.ru and www.tgcar.ru A records: 95.163.244.138, TTL 86400.
- Existing application host: 201.24.51.103; nginx and pilot-plus services active, 32GB free.
- Nginx currently has only pilot-plus site, bound to supapro.ru and its aliases.
- certbot is installed. HTTPS request to current tgcar.ru failed TLS handshake.

Do not overwrite the existing pilot-plus site config. TG CAR needs its own directory, service/port or static root, nginx server block, certificate and release rollback path.

Before public launch:
1. Owner chooses launch mode: informational catalogue versus real request submission. Do not publish demo rates as real prices.
2. Confirm actual public inventory, tariffs, vehicle photos/illustration policy and booking/contact channel.
3. For real requests: persistent server-side receipt, tenant-scoped integration, duplicate/rate protection, privacy documents and audit of explicit consent. Payment stays disabled until acquiring is configured.
4. Deploy isolated release and verify via host routing before DNS change.
5. Set domain A records to chosen host; verify no conflicting AAAA. Obtain TLS certificate after DNS verification.
6. Smoke-check HTTPS, mobile, forms and internal SUPA PRO health. Keep previous release available for rollback.

No server config, DNS, certificate or production data was changed during this check.
