# Task 3 — exact attribution and review candidates

## RED evidence

- `npx vitest run src/modules/fines/sync/attribute-fine.test.ts` — 3 expected failures out of 5 tests: unmatched results did not expose ranked candidates, the 72-hour/5-candidate bounds were absent, and before/after hints were not returned.
- `npx vitest run src/modules/fines/sync/sync-company-fines.server.test.ts` — 3 expected failures out of 4 tests: later sync overwrote `MANUAL`, ambiguous attribution cleared an existing assignment, and no atomic `AUTO_EXACT` history was written.
- `npx vitest run src/modules/fines/server/assignment-actions.test.ts` — expected missing-module failure before `assignment-actions.ts` existed.
- `npx vitest run src/modules/fines/server/queries.test.ts` — 2 expected failures out of 3 tests: assignment source/candidate DTOs were absent and system reads used an unbounded company condition.
- A second query RED cycle failed 1 of 3 tests until the rental fetch used a separate 72-hour condition for every fine instead of one broad global time range.

## Changed files

- `src/modules/fines/sync/attribute-fine.ts`
- `src/modules/fines/sync/attribute-fine.test.ts`
- `src/modules/fines/sync/sync-company-fines.server.ts`
- `src/modules/fines/sync/sync-company-fines.server.test.ts`
- `src/modules/fines/server/assignment-actions.ts`
- `src/modules/fines/server/assignment-actions.test.ts`
- `src/modules/fines/server/queries.ts`
- `src/modules/fines/server/queries.test.ts`
- `.superpowers/sdd/fine-payments-task-3-report.md`

## Implementation

- `selectFineAttribution()` keeps half-open exact matching, distinguishes `MATCHED`, `AMBIGUOUS`, and `UNMATCHED`, and returns deterministic review candidates with exact `distanceMs` plus `BEFORE`, `DURING`, or `AFTER`. Candidates are restricted to 72 hours and five results.
- Synchronization performs the fine upsert and history append atomically in a Serializable transaction. It writes `AUTO_EXACT` history only for a new or changed exact assignment, preserves legacy/current automatic assignments on ambiguous or unmatched input, and never overwrites `MANUAL`.
- `assignFineAction` re-authorizes every request through the existing fines RBAC boundary. It validates fine, company, vehicle, and rental ownership inside a Serializable transaction; assignment/clear, `MANUAL` history, and a client-PII-free audit record commit together.
- The fines DTO exposes `assignedRentalId`, `assignmentSource`, and safe `assignmentCandidates` containing only rental ID, contract number, client display name, ISO dates, exact numeric distance, a display label, and relative direction. Database reads use explicit tenant whitelists and select no encrypted client fields.

## Verification

- `npx vitest run src/modules/fines/sync/attribute-fine.test.ts src/modules/fines/sync/sync-company-fines.server.test.ts src/modules/fines/server/assignment-actions.test.ts src/modules/fines/server/queries.test.ts` — passed, 4 files and 17 tests.
- `npm run typecheck` — passed.
- `npx prettier --check` scoped to the eight changed TypeScript files — passed.
- `git diff --check` — passed before the final commit.

No migration, seed, live provider request, or full test suite was run.

## Self-review

- Exact matching remains `[startsAt, endsAt)`, including the `endsAt` boundary as a zero-distance `BEFORE` suggestion rather than a match.
- Nearby candidates remain suggestions only and cannot mutate an assignment.
- The action accepts only `SUPER_ADMIN`, `COMPANY_ADMIN`, and `DISPATCHER` through the existing access layer; `DRIVER` and `VIEWER` remain denied even with additional permissions.
- Foreign-company and wrong-vehicle rental IDs resolve to the same safe unavailable result before any write.
- Audit changes contain only assignment state/source, never contract/client details, provider tokens, payment URLs, or encrypted values.
- Existing `AUTOMATIC` assignments are preserved for compatibility; no backfill or schema change is part of this task.

## Concerns

- Candidate display labels round to whole minutes while `distanceMs` remains exact for ordering and programmatic use.
