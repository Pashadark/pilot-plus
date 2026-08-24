# Dashboard Command Center Release 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixture-driven home page with a company-scoped command center that shows real fleet KPIs, actionable events for today through the next week, and an attention queue.

**Architecture:** A server-only dashboard query loads rentals, committed rental operations, maintenance, washes, vehicles, and latest GLONASSSoft positions for the authenticated company. Pure normalizers convert those records into a shared `DashboardOverviewDto`; presentational components render the DTO and never query Prisma directly. Date windows use `Europe/Moscow`, and incomplete financial values are labelled as calculated rather than confirmed payments.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Prisma 6/PostgreSQL, Tailwind CSS 4, Vitest, Testing Library.

## Global Constraints

- Read the relevant guides in `node_modules/next/dist/docs/` before changing App Router server components or navigation APIs.
- Preserve the existing custom СУПА ПРО design tokens and Tailwind architecture.
- All database reads must be restricted by the authenticated user's `companyId`.
- Money stays in integer minor units and is formatted only at the presentation boundary.
- Deposits are liabilities and never contribute to revenue or profit.
- Time windows default to `Europe/Moscow`.
- No fixture, demo vehicle, placeholder KPI, empty menu entry, or invented financial payment value may ship.
- Keep existing user changes outside the files listed in each task.

---

## File Structure

- `src/modules/dashboard/overview-types.ts` — stable DTOs shared by server query and UI.
- `src/modules/dashboard/date-window.ts` — Moscow day/range parsing without database access.
- `src/modules/dashboard/date-window.test.ts` — boundary and invalid-period tests.
- `src/modules/dashboard/normalizers.ts` — pure KPI and work-item derivation.
- `src/modules/dashboard/normalizers.test.ts` — business-rule tests.
- `src/modules/dashboard/server/queries.ts` — authenticated, company-scoped Prisma orchestration.
- `src/modules/dashboard/server/queries.test.ts` — repository contract and access tests.
- `src/modules/dashboard/CommandCenterDashboard.tsx` — desktop/mobile layout composition.
- `src/modules/dashboard/CommandCenterKpis.tsx` — top KPI cards.
- `src/modules/dashboard/WorkdayBoard.tsx` — chronological operational list and day tabs.
- `src/modules/dashboard/AttentionPanel.tsx` — unresolved risk list.
- `src/modules/dashboard/CommandCenterDashboard.test.tsx` — accessible rendering and empty-state tests.
- `src/app/(protected)/page.tsx` — server page that loads the overview.

The existing map module remains available at `/map`; release 1 removes it from the primary home-page hierarchy rather than deleting its code.

---

### Task 1: Moscow date-window contract

**Files:**
- Create: `src/modules/dashboard/date-window.ts`
- Create: `src/modules/dashboard/date-window.test.ts`

**Interfaces:**
- Produces: `DashboardPeriod = 'today' | 'tomorrow' | 'day-after-tomorrow' | 'week'`.
- Produces: `getDashboardWindow(period: DashboardPeriod, now?: Date): { from: Date; toExclusive: Date; label: string }`.
- Produces: `parseDashboardPeriod(value: string | undefined): DashboardPeriod`.

- [ ] **Step 1: Write failing boundary tests**

```ts
import { describe, expect, it } from 'vitest';
import { getDashboardWindow, parseDashboardPeriod } from './date-window';

describe('dashboard date windows', () => {
  const now = new Date('2026-08-24T20:30:00.000Z'); // 23:30 Moscow

  it('uses Moscow midnight for today', () => {
    expect(getDashboardWindow('today', now)).toMatchObject({
      from: new Date('2026-08-23T21:00:00.000Z'),
      toExclusive: new Date('2026-08-24T21:00:00.000Z'),
    });
  });

  it('falls back to today for unknown input', () => {
    expect(parseDashboardPeriod('month')).toBe('today');
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `npx vitest run src/modules/dashboard/date-window.test.ts`  
Expected: FAIL because `./date-window` does not exist.

- [ ] **Step 3: Implement explicit Moscow windows**

Implement the exported types and functions. Use `Intl.DateTimeFormat` parts for `Europe/Moscow`, convert the local calendar date to `Date.UTC(year, month - 1, day, -3)`, and add exact calendar-day counts: 0/1/2 days for the three single-day periods and 7 days for `week`. Do not use the workstation's local timezone.

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run src/modules/dashboard/date-window.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/date-window.ts src/modules/dashboard/date-window.test.ts
git commit -m "feat(dashboard): add Moscow workday windows"
```

---

### Task 2: Dashboard DTO and pure operational normalizers

**Files:**
- Create: `src/modules/dashboard/overview-types.ts`
- Create: `src/modules/dashboard/normalizers.ts`
- Create: `src/modules/dashboard/normalizers.test.ts`

**Interfaces:**
- Produces: `DashboardOverviewDto`, `DashboardKpiDto`, `DashboardWorkItemDto`, and `DashboardAttentionItemDto`.
- Produces: `buildDashboardOverview(input: DashboardOverviewSource): DashboardOverviewDto`.
- Consumes: the `{ from, toExclusive, label }` window from Task 1.

Define the stable work-item union:

```ts
export type DashboardWorkItemKind =
  | 'HANDOVER'
  | 'DELIVERY'
  | 'RETURN'
  | 'RENTAL_END'
  | 'EXTENSION'
  | 'DEPOSIT_RETURN'
  | 'MAINTENANCE'
  | 'WASH';

export type DashboardWorkItemDto = {
  id: string;
  kind: DashboardWorkItemKind;
  scheduledAt: string;
  title: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  href: string;
  vehicleLabel: string;
  clientLabel: string | null;
  phone: string | null;
  contractNumber: string | null;
  address: string | null;
  amountMinor: string | null;
  overdue: boolean;
};
```

The overview must expose KPIs with raw values and labels, not prebuilt JSX:

```ts
export type DashboardOverviewDto = {
  period: { key: DashboardPeriod; label: string; from: string; toExclusive: string };
  kpis: {
    earnedMinor: string;
    earnedIsEstimated: true;
    heldDepositsMinor: string;
    freeVehicles: number;
    occupiedVehicles: number;
    serviceVehicles: number;
    offlineVehicles: number;
  };
  workItems: DashboardWorkItemDto[];
  attentionItems: DashboardAttentionItemDto[];
};
```

- [ ] **Step 1: Write failing business-rule tests**

Cover these concrete cases:

```ts
it('excludes deposits from earned rental money', () => {
  const result = buildDashboardOverview(source({
    rentals: [rental({
      startsAt: '2026-08-24T07:00:00.000Z',
      endsAt: '2026-08-24T17:00:00.000Z',
      totalPriceMinor: 40_000n,
      depositMinor: 15_000n,
    })],
  }));
  expect(result.kpis.earnedMinor).toBe('40000');
  expect(result.kpis.heldDepositsMinor).toBe('0');
});

it('allocates a multi-day contract across Moscow billable days', () => {
  const result = buildDashboardOverview(source({
    period: moscowDay('2026-08-25'),
    rentals: [rental({
      startsAt: '2026-08-24T07:00:00.000Z',
      endsAt: '2026-08-26T07:00:00.000Z',
      totalPriceMinor: 40_001n,
    })],
  }));
  expect(result.kpis.earnedMinor).toBe('20000');
});

it('counts only the latest committed collected deposit as held', () => {
  const result = buildDashboardOverview(source({
    rentals: [rental({
      depositMinor: 15_000n,
      operations: [operation('COLLECTED', '2026-08-20'), operation('RETURNED', '2026-08-24')],
    })],
  }));
  expect(result.kpis.heldDepositsMinor).toBe('0');
});

it('puts overdue returns before later work items', () => {
  const result = buildDashboardOverview(sourceWithOverdueReturnAndWash());
  expect(result.workItems[0]).toMatchObject({ kind: 'RETURN', overdue: true, tone: 'danger' });
});
```

Also test: archived/demo vehicles are excluded by the query contract; active rental overlap makes a vehicle occupied; maintenance/wash blocks availability; a position older than the existing GPS stale threshold counts as offline; completed/cancelled service records do not enter the workday.

- [ ] **Step 2: Run tests and confirm missing exports**

Run: `npx vitest run src/modules/dashboard/normalizers.test.ts`  
Expected: FAIL because the DTO and normalizer do not exist.

- [ ] **Step 3: Implement the minimal pure normalizer**

Implement deterministic mapping and sorting. Use stable IDs such as `rental-return:${rental.id}`, `deposit-return:${rental.id}`, `maintenance:${record.id}`, and `wash:${record.id}`. Sort with `(overdue desc, scheduledAt asc, id asc)`. Build client names from `lastName`, `firstName`, `middleName`; never select a nonexistent `fullName` Prisma field.

Calculate release-1 `earnedMinor` from contract value, not from deposits or assumed cash receipt. Allocate `totalPriceMinor` across Moscow billable calendar days intersecting `[startsAt, endsAt)`; divide integer minor units evenly, assign any remainder to the earliest billable days, then sum only shares inside the selected dashboard period. Same-day rentals have one billable day. Cancelled/draft rentals contribute zero. Keep `earnedIsEstimated: true` until the payment journal in release 3 replaces this estimate.

Treat `CONFIRMED` and `ACTIVE` rentals overlapping the window as occupied. Treat `PLANNED`/`IN_PROGRESS` maintenance and washes overlapping the window as service vehicles. A vehicle cannot be counted as both free and occupied; service takes precedence, then occupied, then free.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run src/modules/dashboard/normalizers.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/overview-types.ts src/modules/dashboard/normalizers.ts src/modules/dashboard/normalizers.test.ts
git commit -m "feat(dashboard): derive operational overview"
```

---

### Task 3: Authenticated company-scoped dashboard query

**Files:**
- Create: `src/modules/dashboard/server/queries.ts`
- Create: `src/modules/dashboard/server/queries.test.ts`

**Interfaces:**
- Produces: `getDashboardOverviewForCurrentUser(period: DashboardPeriod, now?: Date): Promise<DashboardOverviewDto>`.
- Internal test seam: `createDashboardQueries(repository, getSession)`.
- Consumes: Task 1 windows and Task 2 `buildDashboardOverview`.

- [ ] **Step 1: Write failing repository-contract tests**

Use a fake repository and assert every query receives the same authenticated `companyId`:

```ts
it('scopes every source to the authenticated company', async () => {
  const repository = dashboardRepositoryFixture();
  await createDashboardQueries(repository, async () => session({ companyId: 'company-1' }))
    .getOverview('today', new Date('2026-08-24T09:00:00Z'));

  expect(repository.rentalFindMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-1' }) }),
  );
  expect(repository.vehicleFindMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-1' }) }),
  );
});

it('rejects an unauthenticated request', async () => {
  await expect(createDashboardQueries(repository, async () => null).getOverview('today'))
    .rejects.toThrow('Доступ к панели управления запрещён.');
});
```

- [ ] **Step 2: Run tests and confirm the missing-query failure**

Run: `npx vitest run src/modules/dashboard/server/queries.test.ts`  
Expected: FAIL because `server/queries.ts` does not exist.

- [ ] **Step 3: Implement the repository seam and Prisma adapter**

Use `getAuthenticatedSession()` from `src/services/auth/session.ts`. Query in parallel:

- vehicles with `companyId`, `archivedAt: null`, `isDemoImport: false`, latest GLONASSSoft position, overlapping active rentals, active maintenance, and active washes;
- rentals whose start/end or required return intersects the requested window, including client name fields, encrypted phone field only when existing access utilities permit decryption, latest committed operations, fulfillment details, price, and deposit;
- maintenance and washes scheduled in the requested window.

Use Prisma `select` objects checked with `satisfies Prisma.*Select`. Do not leak encrypted phone values into the DTO; decrypt using the existing field-encryption/search-key conventions, and return `null` if the caller lacks access or the field is absent.

- [ ] **Step 4: Run query and normalizer tests**

Run: `npx vitest run src/modules/dashboard/server/queries.test.ts src/modules/dashboard/normalizers.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/server/queries.ts src/modules/dashboard/server/queries.test.ts
git commit -m "feat(dashboard): load company command center data"
```

---

### Task 4: Command-center presentation components

**Files:**
- Create: `src/modules/dashboard/CommandCenterDashboard.tsx`
- Create: `src/modules/dashboard/CommandCenterKpis.tsx`
- Create: `src/modules/dashboard/WorkdayBoard.tsx`
- Create: `src/modules/dashboard/AttentionPanel.tsx`
- Create: `src/modules/dashboard/CommandCenterDashboard.test.tsx`
- Reuse: `src/shared/ui/Card.tsx`, `src/shared/ui/Badge.tsx`, existing button primitives and design tokens.

**Interfaces:**
- Produces: `CommandCenterDashboard({ overview }: { overview: DashboardOverviewDto })`.
- Produces accessible links for period navigation: `/?period=today`, `/?period=tomorrow`, `/?period=day-after-tomorrow`, `/?period=week`.
- Consumes Task 2 DTOs only.

- [ ] **Step 1: Write failing rendering tests**

```tsx
it('renders the operational priority before analytics', () => {
  render(<CommandCenterDashboard overview={overviewFixture()} />);
  expect(screen.getByRole('heading', { name: 'Рабочий день' }))
    .toBeInTheDocument();
  expect(screen.getByText('Вернуть депозит')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /открыть договор/i })).toHaveAttribute(
    'href', '/rentals/rental-1',
  );
});

it('explains an empty day instead of rendering an empty list', () => {
  render(<CommandCenterDashboard overview={overviewFixture({ workItems: [] })} />);
  expect(screen.getByText('На выбранный день обязательных действий нет')).toBeInTheDocument();
});

it('marks earned money as estimated', () => {
  render(<CommandCenterDashboard overview={overviewFixture()} />);
  expect(screen.getByText('Расчёт по договорам')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and confirm missing components**

Run: `npx vitest run src/modules/dashboard/CommandCenterDashboard.test.tsx`  
Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the approved A layout**

Desktop order:

1. title/date and equal-height quick-action buttons;
2. KPI grid;
3. two-column area with `WorkdayBoard` at roughly two-thirds width and `AttentionPanel` at one-third;
4. a release-1 footer link to detailed `/map`, `/rentals`, `/maintenance`, and `/wash` pages.

Mobile order: attention, workday, KPI cards, detail links. Use semantic `section`, `ol`, `time`, headings, and visible focus states. Format minor-unit strings with `Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })`. Do not include the old fixture map or mileage/fuel charts.

- [ ] **Step 4: Run component tests**

Run: `npx vitest run src/modules/dashboard/CommandCenterDashboard.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/CommandCenterDashboard.tsx src/modules/dashboard/CommandCenterKpis.tsx src/modules/dashboard/WorkdayBoard.tsx src/modules/dashboard/AttentionPanel.tsx src/modules/dashboard/CommandCenterDashboard.test.tsx
git commit -m "feat(dashboard): render command center workspace"
```

---

### Task 5: Wire the protected home page to real data

**Files:**
- Modify: `src/app/(protected)/page.tsx`
- Test: `src/app/(protected)/page.test.tsx`

**Interfaces:**
- Consumes: `parseDashboardPeriod`, `getDashboardOverviewForCurrentUser`, and `CommandCenterDashboard`.
- Removes: imports from `src/modules/dashboard/fixtures.ts` on the protected home page.

- [ ] **Step 1: Write the failing page test**

Mock the query and assert the URL period is forwarded:

```tsx
it('loads real dashboard data for the selected period', async () => {
  getDashboardOverviewForCurrentUser.mockResolvedValue(overviewFixture());
  render(await Home({ searchParams: Promise.resolve({ period: 'tomorrow' }) }));
  expect(getDashboardOverviewForCurrentUser).toHaveBeenCalledWith('tomorrow');
  expect(screen.getByRole('heading', { name: 'Рабочий день' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the page test and verify failure**

Run: `npx vitest run "src/app/(protected)/page.test.tsx"`  
Expected: FAIL because the current page still renders fixtures.

- [ ] **Step 3: Replace fixture wiring**

Keep the welcome flash toast. Parse `searchParams.period`, load the server DTO, and render:

```tsx
const period = parseDashboardPeriod(query.period);
const overview = await getDashboardOverviewForCurrentUser(period);

return (
  <AppShell breadcrumbs={[{ label: 'СУПА ПРО', href: '/' }, { label: 'Командный центр' }]}>
    <FlashToast kind={flash} />
    <CommandCenterDashboard overview={overview} />
  </AppShell>
);
```

Do not delete old dashboard components in this task; they may still be useful as references until later releases and deleting them adds unrelated risk.

- [ ] **Step 4: Run page and dashboard tests**

Run: `npx vitest run "src/app/(protected)/page.test.tsx" src/modules/dashboard/*.test.ts src/modules/dashboard/*.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/page.tsx" "src/app/(protected)/page.test.tsx"
git commit -m "feat(dashboard): launch real command center"
```

---

### Task 6: Release verification and runbook update

**Files:**
- Create: `docs/runbooks/dashboard-command-center.md`
- Modify: `docs/PROJECT_GUIDE.md` only in the dashboard/current-state sections; preserve all unrelated user edits.

**Interfaces:**
- Documents KPI definitions, Moscow boundaries, data freshness, known calculated-money limitation, and rollback.

- [ ] **Step 1: Run the focused release suite**

Run: `npx vitest run src/modules/dashboard "src/app/(protected)/page.test.tsx"`  
Expected: all dashboard tests PASS.

- [ ] **Step 2: Run project verification**

Run: `npm run typecheck`  
Expected: exit 0.

Run: `npm run lint`  
Expected: exit 0.

Run: `npm run build`  
Expected: production build completes and `/` remains a dynamic authenticated route.

- [ ] **Step 3: Perform authenticated browser smoke checks**

At desktop and mobile widths verify:

- `/` has no demo vehicle counts or fixture chart labels;
- `/?period=tomorrow` changes the active day and work items;
- rental links open the matching rental;
- empty periods show the designed empty state;
- deposits are labelled separately from earned money;
- all right-side actions align and remain keyboard accessible.

- [ ] **Step 4: Write the runbook**

Document:

- exact KPI formulas from this plan;
- the `Europe/Moscow` date contract;
- which source models feed each work-item kind;
- how to diagnose a missing event;
- the fact that release 1 earned income is calculated from contracts and does not claim confirmed cash receipt;
- rollback by reverting the page wiring commit while retaining query code.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/runbooks/dashboard-command-center.md docs/PROJECT_GUIDE.md
git commit -m "docs(dashboard): add command center runbook"
```

---

## Follow-up Plans

After release 1 is verified, write and execute separate plans in this order:

1. `dashboard-tasks-notifications` — manual tasks, per-user notification state, real header center, deduplicated toast, snooze and Telegram event alignment.
2. `dashboard-fuel-finance` — complete fuel expense records, receipt storage, payment journal, expense ledger, confirmed receipts and profit.
3. `dashboard-vehicle-analytics` — vehicle profitability, utilization, combined charts, rankings and arbitrary date ranges.

Each follow-up consumes `DashboardOverviewDto` through additive versioned fields so release 1 remains deployable throughout the work.
