# Task 5 report: vehicle management UI

## Scope

- Added `VehicleForm`, `FleetImportDialog`, the protected `/vehicles/new` route and matching skeleton.
- Added server-authorized management entry points to the existing fleet page. The page derives the company only after `getVehicleManagementAccess`; each mutation/action reauthorizes server-side.
- Did not edit `VehicleDetailPage`, `VehicleOverview`, Prisma schema/migrations, or Task 4 import implementation.

## TDD

- RED: focused UI tests initially failed because the two component modules were absent.
- GREEN: `npx vitest run src/modules/vehicles/manage/components/VehicleForm.test.tsx src/modules/vehicles/manage/components/FleetImportDialog.test.tsx` passed: 2 files, 2/2 tests.

## UI decisions

- Reused Pilot+ `Input`, `Select`, `Switch`, `Button`, `Modal`, semantic token colours and `useToast`.
- Inputs expose inline server field errors, native required/min constraints, and visible focus styles inherited from shared controls.
- Actions meet the existing 44px target policy; layouts are min-width safe and use a single/two-column responsive grid for 390px.
- The modal owns keyboard focus and returns it to its trigger through the shared `Modal` primitive.

## Verification

- PASS: focused Vitest, 2/2.
- PASS: `npm run typecheck`.
- PASS: targeted Prettier check and `git diff --check` before commit.

## Concern

The first system-scope company is selected only to expose an initial management entry point. The new page and every mutation repeat server authorization against the submitted company, so this presentation choice does not widen tenant access. A future company-switcher UI should make the system-admin selection explicit.
