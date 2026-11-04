# SUPA CAR First Android Slice Implementation Plan

> **For Codex:** Execute this plan in the current feature branch with the `executing-plans` skill. Use strict red-green-refactor for every behavior change. Do not touch the immutable Supa Pro logo; SUPA CAR uses only assets under `public/supa-car/brand/` and `apps/supa-car-android/`.

**Goal:** Produce a raw installable Android APK that signs in by phone, shows the authenticated owner only their assigned vehicles, opens a vehicle summary, and displays a finance summary backed by the real Supa Pro API.

**Architecture:** Supa Pro remains the server and administrator UI. A separate owner auth/session boundary and `/api/supa-car/v1` route group expose only owner-scoped DTOs. The Android client is a Kotlin/Jetpack Compose application in `apps/supa-car-android/`; it stores rotating credentials with Android Keystore, calls the versioned API, and renders explicit loading, empty, error, offline-cache, and authenticated states.

**Stack:** Next.js 16 route handlers and server actions, Prisma/PostgreSQL, Zod, Vitest, Kotlin 2.4.21, Android Gradle Plugin 9.4.0, Gradle 9.6.0, JDK 17, Jetpack Compose BOM 2026.09.00, minSdk 28, target/compileSdk 37, JUnit and Compose UI tests.

**Today’s boundary:** This plan includes the real identity/access spine, a minimal immutable financial ledger and summary, the superadmin management page, and the Android login/home/vehicle screens. Automatic daily accrual scheduling, map tracks, chat, notifications, payouts, maintenance history, and document downloads stay out of this first slice and receive separate vertical plans after the APK is proven on the phone.

---

## Task 1: Prepare Android tooling and prove the USB path

**Files:**

- Modify: `.gitignore`
- Create: `apps/supa-car-android/.gitignore`
- Create: `apps/supa-car-android/local.properties` locally only (ignored)

- [ ] Install Android Studio Quail 4, JDK 17, SDK Platform 37, Build Tools 36.0.0, platform-tools, and command-line tools.
- [ ] Add project-local SDK location to `apps/supa-car-android/local.properties`; do not commit machine paths.
- [ ] Run `adb devices -l` and wait for the phone to report `device`, not `unauthorized`.
- [ ] If the phone reports `unauthorized`, keep the command waiting only after Pavel accepts the RSA fingerprint on the phone.
- [ ] Record the detected model and Android API in `docs/supa-car-usb-smoke.md` without serial number or other device identifiers.

**Verification:**

```powershell
adb devices -l
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.model
```

Expected: exactly one authorized physical device and API level at least 28.

## Task 2: Add the owner/access/ledger schema

**Files:**

- Create: `src/database/prisma/supa-car-schema.test.ts`
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20261014120000_add_supa_car_owner_core/migration.sql`

- [ ] RED: add schema tests asserting `OwnerProfile`, `OwnerSession`, `OwnerVehicleAccess`, `OwnerRevenueRule`, and `OwnerLedgerEntry`, required unique keys, access validity dates, 4000-basis-point default, token hashes, and relations to `Company`, `Vehicle`, and `RentalPayment`.
- [ ] Run `npx vitest run src/database/prisma/supa-car-schema.test.ts` and confirm failure because the models do not exist.
- [ ] GREEN: add enums `OwnerProfileStatus` and `OwnerLedgerEntryKind`; add the five models and inverse relations. Store money as `BigInt`, timestamps as `Timestamptz(3)`, and phone as unique normalized E.164 text.
- [ ] Add SQL migration matching the Prisma schema, including composite indexes used by access and balance queries.
- [ ] Run Prisma format, validate, generate, and the focused test.

**Core schema contract:**

```prisma
model OwnerProfile {
  id           String             @id @default(cuid())
  companyId    String
  phoneE164    String             @unique
  displayName  String
  passwordHash String
  status       OwnerProfileStatus @default(ACTIVE)
  sessions     OwnerSession[]
  vehicleAccess OwnerVehicleAccess[]
  revenueRules OwnerRevenueRule[]
  ledgerEntries OwnerLedgerEntry[]
  createdAt    DateTime           @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime           @updatedAt @db.Timestamptz(3)
}
```

**Verification:**

```powershell
npx vitest run src/database/prisma/supa-car-schema.test.ts
npx prisma format
npx prisma validate
npx prisma generate
```

## Task 3: Implement owner authentication and strict access scope

**Files:**

- Create: `src/modules/supa-car/auth/contracts.test.ts`
- Create: `src/modules/supa-car/auth/contracts.ts`
- Create: `src/modules/supa-car/auth/phone.test.ts`
- Create: `src/modules/supa-car/auth/phone.ts`
- Create: `src/modules/supa-car/auth/session.test.ts`
- Create: `src/modules/supa-car/auth/session.ts`
- Create: `src/modules/supa-car/auth/service.test.ts`
- Create: `src/modules/supa-car/auth/service.ts`
- Create: `src/app/api/supa-car/v1/auth/login/route.ts`
- Create: `src/app/api/supa-car/v1/auth/refresh/route.ts`
- Create: `src/app/api/supa-car/v1/auth/logout/route.ts`
- Create: `src/app/api/supa-car/v1/me/route.ts`

- [ ] RED: test E.164 normalization for Russian `8`, `+7`, spaces, brackets, and invalid numbers.
- [ ] GREEN: implement a single canonical `normalizeOwnerPhone` function.
- [ ] RED: test generic login errors, inactive owners, access-token expiry, hashed refresh tokens, one-time refresh rotation, logout revocation, and owner lookup from the bearer token.
- [ ] GREEN: implement 15-minute signed access tokens and 30-day opaque rotating refresh tokens. Hash refresh tokens before persistence; never log raw credentials.
- [ ] RED: test that `/me` returns only owner-safe profile fields and `Cache-Control: private, no-store`.
- [ ] GREEN: implement route handlers with Zod body limits, consistent JSON errors, and no Supa Pro staff session reuse.

**API contract:**

```ts
type LoginResponse = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  owner: { id: string; displayName: string; phoneMasked: string };
};
```

**Verification:**

```powershell
npx vitest run src/modules/supa-car/auth src/app/api/supa-car/v1/auth src/app/api/supa-car/v1/me
```

## Task 4: Implement vehicle and finance read APIs

**Files:**

- Create: `src/modules/supa-car/vehicles/queries.test.ts`
- Create: `src/modules/supa-car/vehicles/queries.ts`
- Create: `src/modules/supa-car/finance/summary.test.ts`
- Create: `src/modules/supa-car/finance/summary.ts`
- Create: `src/app/api/supa-car/v1/vehicles/route.ts`
- Create: `src/app/api/supa-car/v1/vehicles/[id]/route.ts`
- Create: `src/app/api/supa-car/v1/finance/summary/route.ts`

- [ ] RED: test that the vehicle list includes only active assignments at request time, excludes archived cars, and never exposes company/internal/tenant identifiers not required by the client.
- [ ] RED: test that a request for an existing but unassigned vehicle receives the same `404` payload as an unknown vehicle.
- [ ] GREEN: return vehicle identity, promo-image URL, operational status, odometer, fuel, last GPS freshness, current rental summary, and nearest maintenance threshold.
- [ ] RED: test finance aggregation by Moscow calendar day/month and balance as the sum of immutable ledger entries; confirm deposits are absent by construction.
- [ ] GREEN: return `todayMinor`, `monthMinor`, `availableMinor`, `pendingMinor`, currency, and `updatedAt`.

**Vehicle DTO:**

```ts
type OwnerVehicleDto = {
  id: string;
  displayName: string;
  registrationNumber: string | null;
  promoImageUrl: string | null;
  status: string;
  odometerKm: number | null;
  fuelPercent: number | null;
  telemetryUpdatedAt: string | null;
  currentRental: null | {
    startsAt: string;
    endsAt: string;
    renterLabel: string; // first name + surname initial only
  };
};
```

**Verification:**

```powershell
npx vitest run src/modules/supa-car/vehicles src/modules/supa-car/finance src/app/api/supa-car/v1/vehicles src/app/api/supa-car/v1/finance
```

## Task 5: Add the Supa Pro superadmin owner manager

**Files:**

- Create: `src/modules/admin/supa-car/actions.test.ts`
- Create: `src/modules/admin/supa-car/actions.ts`
- Create: `src/modules/admin/supa-car/queries.test.ts`
- Create: `src/modules/admin/supa-car/queries.ts`
- Create: `src/modules/admin/supa-car/OwnerManager.test.tsx`
- Create: `src/modules/admin/supa-car/OwnerManager.tsx`
- Create: `src/app/(protected)/admin/supa-car/page.test.tsx`
- Create: `src/app/(protected)/admin/supa-car/page.tsx`
- Modify: `src/modules/admin/overview/AdminOverviewPage.tsx`

- [ ] RED: test that only `SUPER_ADMIN` can create/reset/block an owner and assign vehicles.
- [ ] RED: test normalized unique phones, 12-character passwords, duplicate assignment prevention, and transactional replacement of selected vehicle access.
- [ ] GREEN: implement server actions that re-check authorization inside every mutation, hash passwords with the existing Supa Pro scrypt helper, revoke sessions after password reset/block, and write audit records.
- [ ] RED: test the owner manager form renders phone, name, password, and real vehicle checkboxes plus current owners and assigned counts.
- [ ] GREEN: implement `/admin/supa-car` in the existing graphite design system and add a quick link from the admin overview.

**Verification:**

```powershell
npx vitest run src/modules/admin/supa-car "src/app/(protected)/admin/supa-car"
```

## Task 6: Scaffold the native Android client and design system

**Files:**

- Create: `apps/supa-car-android/settings.gradle.kts`
- Create: `apps/supa-car-android/build.gradle.kts`
- Create: `apps/supa-car-android/gradle.properties`
- Create: `apps/supa-car-android/gradle/wrapper/gradle-wrapper.properties`
- Create: `apps/supa-car-android/gradlew`
- Create: `apps/supa-car-android/gradlew.bat`
- Create: `apps/supa-car-android/app/build.gradle.kts`
- Create: `apps/supa-car-android/app/src/main/AndroidManifest.xml`
- Create: `apps/supa-car-android/app/src/main/java/ru/supacar/app/MainActivity.kt`
- Create: `apps/supa-car-android/app/src/main/java/ru/supacar/app/ui/theme/SupaCarTheme.kt`
- Create: `apps/supa-car-android/app/src/test/java/ru/supacar/app/ui/theme/BrandTokensTest.kt`
- Copy generated brand assets into Android adaptive icon, launcher icon, and splash resources under `apps/supa-car-android/app/src/main/res/`.

- [ ] RED: add JVM tests for immutable brand colors `#101014`, `#FF7A00`, `#FF3024` and minimum 48dp touch targets.
- [ ] GREEN: create the app module, graphite/orange design tokens, splash, adaptive icon, typography, cards, buttons, status chips, and system-bar treatment.
- [ ] Ensure no Supa Pro logo file is modified or reused as the SUPA CAR mark.

**Verification:**

```powershell
cd apps/supa-car-android
./gradlew.bat testDebugUnitTest
./gradlew.bat assembleDebug
```

## Task 7: Implement API client, encrypted session, login, home, and vehicle detail

**Files:**

- Create: `apps/supa-car-android/app/src/main/java/ru/supacar/app/data/api/SupaCarApi.kt`
- Create: `apps/supa-car-android/app/src/main/java/ru/supacar/app/data/api/ApiModels.kt`
- Create: `apps/supa-car-android/app/src/main/java/ru/supacar/app/data/auth/EncryptedSessionStore.kt`
- Create: `apps/supa-car-android/app/src/main/java/ru/supacar/app/data/repository/OwnerRepository.kt`
- Create: `apps/supa-car-android/app/src/main/java/ru/supacar/app/ui/AppState.kt`
- Create: `apps/supa-car-android/app/src/main/java/ru/supacar/app/ui/login/LoginScreen.kt`
- Create: `apps/supa-car-android/app/src/main/java/ru/supacar/app/ui/home/HomeScreen.kt`
- Create: `apps/supa-car-android/app/src/main/java/ru/supacar/app/ui/vehicle/VehicleScreen.kt`
- Create: `apps/supa-car-android/app/src/test/java/ru/supacar/app/data/repository/OwnerRepositoryTest.kt`
- Create: `apps/supa-car-android/app/src/androidTest/java/ru/supacar/app/LoginFlowTest.kt`

- [ ] RED: test request serialization, bearer injection, one refresh-and-retry on `401`, logout after refresh failure, and cached summary fallback when offline.
- [ ] GREEN: implement the HTTP repository with bounded connect/read timeouts and JSON parsing; use no cleartext HTTP except a debug-only network security rule for USB `adb reverse` development.
- [ ] RED: test that raw tokens are not stored in plain SharedPreferences.
- [ ] GREEN: encrypt token material with an AES/GCM key generated in Android Keystore and keep only ciphertext/IV in private storage.
- [ ] RED: Compose test login validation, loading/error states, finance values, owner-only vehicle list, navigation to vehicle detail, and logout.
- [ ] GREEN: implement the four app states: splash/session restore, login, authenticated home, and vehicle detail. The home shows today/month/balance/pending plus assigned cars; detail shows status, current rental, odometer, fuel, and telemetry freshness.

**Verification:**

```powershell
cd apps/supa-car-android
./gradlew.bat testDebugUnitTest
./gradlew.bat connectedDebugAndroidTest
./gradlew.bat assembleDebug
```

## Task 8: Create a real test owner, deploy the API, and smoke-test on the phone

**Files:**

- Create: `scripts/create-supa-car-test-owner.ts`
- Create: `docs/runbooks/supa-car-first-apk.md`
- Create: `docs/supa-car-usb-smoke.md`

- [ ] Add a guarded, idempotent script that accepts phone/name/password/vehicle IDs from explicit arguments, creates or updates one test owner, sets a 4000-bps revenue rule, assigns selected real vehicles, and adds only an explicitly requested test ledger amount.
- [ ] Run backend focused tests, typecheck, Prisma validation, and production build.
- [ ] Back up the production database and current server release before applying the migration.
- [ ] Apply the migration, deploy the exact tested release, and run unauthenticated/authenticated API canaries.
- [ ] Create the test owner without printing the password or full phone to logs.
- [ ] Use `adb reverse tcp:3000 tcp:3000` for a local debug API smoke first; after the production API is verified, point debug configuration to `https://supapro.ru`.
- [ ] Install with `adb install -r apps/supa-car-android/app/build/outputs/apk/debug/app-debug.apk`.
- [ ] On the real phone verify: launcher icon, splash, login, finance summary, only assigned vehicles, vehicle detail, back navigation, process restart/session restore, offline cached state, and logout.
- [ ] Save a redacted result table and any defects in `docs/supa-car-usb-smoke.md`.

**Final verification:**

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run build
cd apps/supa-car-android
./gradlew.bat testDebugUnitTest connectedDebugAndroidTest assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n ru.supacar.app/.MainActivity
```

Expected: Supa Pro remains healthy, the production API is owner-scoped, and the physical Android phone completes the first vertical scenario without demo-only client data.
