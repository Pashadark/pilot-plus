# Production Operations Upgrade — Implementation Plan

1. Add failing dashboard route, month-period, and ruble-icon tests; implement the smallest fixes.
2. Reproduce contract creation and download failures with focused tests; repair access, lookup, and document-generation paths.
3. Vendor licensed weather assets; map all supported weather/time states and preserve reduced-motion behavior.
4. Add profile banner upload, team view, and session revocation end to end with authorization tests.
5. Remove vehicle image hover movement; add timestamp-based event attribution and fine-evidence presentation.
6. Add rental archive query/view and redesign the active rental table without changing legal records.
7. Redesign maintenance list/card views using the shared table/card system.
8. Migrate structured client identity fields; extend the wizard and document upload workflow.
9. Add local OCR adapter, review UI, and optional client-photo crop proposal.
10. Add company-scoped leads with status history and conversion to client.
11. Run focused tests after every vertical slice, then full lint, typecheck, unit, and production build.
12. Back up production database/private storage, deploy atomically, run migrations, restart services, and verify critical HTTPS workflows.
