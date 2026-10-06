# Toll debt cards implementation plan

**Goal:** Show actual unpaid road passages in the existing fine-card grid, with road, Moscow passage time and rental attribution. User approved the same-card design, without a separate section.

**Architecture:** Read the existing provider's `/v1.0/ckad-cars/debt-trips` on the server using the tenant's encrypted key. Validate and paginate a bounded response. Merge with fines before pagination and include debts in totals. No synthetic Fine database records, no fake decree numbers, no inferred payment confirmations. An API failure leaves fines available and displays a warning.

**Constraints:** Match vehicle inside the same company by normalized plate. Attribute only one overlapping active/completed rental; ambiguity remains unassigned. API naive timestamps are Moscow local time, consistent with the provider UI. Debt disappearing from the outstanding endpoint is not a paid-history record. No road-payment initiation in this increment.

- [ ] Test provider schema, endpoint and invalid response handling; implement validated client method.
- [ ] Test Moscow date parsing, exact vehicle/tenant matching, overlap ambiguity and filters; implement pure mapping plus server loader.
- [ ] Merge road entries with fine priorities before the existing 24-entry pagination. Preserve all existing fine controls; forbid fine payment and manual fine-assignment controls on road debts.
- [ ] Test the actual FinesPage markup for road badge, passage time, renter, contract link and absent fine-payment controls.
- [ ] Run focused tests, ESLint, typecheck/build; compare scoped production sources before deployment. Verify live entry count and authenticated HTML.

Provider evidence: public first-party application bundle `main.3911b67cceaf6c0a.js` calls `/v1.0/ckad-cars/debt-trips`; authenticated diagnostic returned HTTP 200 and 20 entries on 2026-09-23. API fields: id, road, place, amount, travelDate, lastCheckDate, carId, carTitle, carRegnum, uin. Secrets never included in logs or browser props.

## Completion evidence

Published `/opt/pilot-plus/releases/20260923-toll-cards`; previous `20260923-search-left` retained for rollback. All 115 fines-module tests passed; scoped ESLint passed. Production Next build and TypeScript passed. Local whole-workspace typecheck also traverses the partial design-export folder and unrelated existing tests and is not clean; those artifacts were not deployed.

Authenticated production request with `query=ЦКАД&status=UNPAID` returned HTTP 200, 18 toll cards, 15 rental links, no incomplete-data warning, and the existing three-column grid. Unmatched/ambiguous rentals are visibly unassigned, not guessed. Read-only API loading on page request; no database migration or payment initiation.
