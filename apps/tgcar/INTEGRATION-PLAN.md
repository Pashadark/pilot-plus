# Local live fleet integration

Approved scope: read the SUPA PRO fleet and connect availability, locally only. No production deployment or remote mutations.

1. Add tested public DTO and half-open Moscow-time interval availability. Ignore cancelled/completed/draft rentals. Block active overdue rentals, current repairs and conflicting confirmed/active rentals. Never expose clients, contracts, GPS, document or insurance data.
2. Add fixed read-only SSH/PostgreSQL adapter scoped to the verified company. Thirty-second cache and bounded subprocess timeout; no stale-success fallback. Production disabled until a dedicated least-privilege transport is provisioned. Private vehicle photographs served only when present in the scoped fleet query.
3. Replace three fixtures with API-loaded real cars. Add date/time selection, available-only filter, refresh/error/loading/empty states and real metadata. Missing tariffs/photos remain unknown. Retain preview-only client form and disable checkout when unavailable.
4. Verify automated cases, real read-only source counts, API redaction, build, and desktop/mobile interactions. Record remaining production limitations. Do not modify DNS, production database, service or files.
