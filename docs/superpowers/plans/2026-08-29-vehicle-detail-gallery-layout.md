# Vehicle detail gallery layout implementation plan

**Goal:** Match the approved vehicle-detail reference by making the gallery the dominant element in the three-column hero.

**Architecture:** Preserve the current server data and component structure. Adjust only responsive Tailwind layout contracts and cover the contract with the existing static-render component test.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Vitest.

### Task 1: Lock the wide-screen gallery contract

**Files:**
- Modify: `src/modules/vehicles/components/VehicleDetailPage.test.ts`
- Test: `src/modules/vehicles/components/VehicleDetailPage.test.ts`

1. Add an assertion for the wide-screen gallery-dominant grid and taller primary image.
2. Run the targeted test and confirm it fails because the current proportions are smaller.

### Task 2: Implement and verify the approved proportions

**Files:**
- Modify: `src/modules/vehicles/components/VehicleDetailPage.tsx`

1. Increase the gallery column share at wide breakpoints.
2. Increase the primary image height while preserving the stacked responsive layout.
3. Run the targeted unit test, typecheck, and visual browser verification against the supplied reference.

