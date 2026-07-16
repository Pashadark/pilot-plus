# Pilot+ Mosaic Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Pilot+ to closely match Mosaic’s light, compact, purple dashboard language without changing map behavior, fixtures, routes, or product interactions.

**Architecture:** Replace the current teal/dark-navigation presentation through semantic tokens and shared UI primitives first, then introduce one small client shell boundary that owns persisted sidebar expansion. Dashboard, UI Kit, and mobile map compositions consume the same tokens; MapLibre lifecycle and product state remain untouched.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript 5 strict mode, Tailwind CSS 4, CSS variables, MapLibre GL, React Icons Feather set, Playwright.

## Global Constraints

- The visual result must closely follow <https://mosaic.cruip.com/>: cold gray canvas, white navigation/header/cards, purple accent, compact density, restrained borders and shadows.
- Do not change MapLibre sources, coordinates, map lifecycle, markers, selection, fly-to, filtering, search, or bottom-sheet snap/drag behavior.
- Do not change fixtures, routes, API, database, or infrastructure.
- Use semantic CSS variables; product components must not contain raw hex values.
- Keep Inter as the only interface font.
- Keep all user-facing UI, documentation, and code comments in Russian; English is allowed only for technical identifiers and external APIs.
- Keep public interactive targets at least 44 by 44 px even when the visible control appears compact.
- Preserve light/dark themes, keyboard focus, reduced motion, and zero horizontal overflow at 375, 768, 1024, and 1440 px.
- Preserve every existing stable `data-testid` and public component contract unless this plan explicitly adds an optional prop.
- Read the relevant guide in `node_modules/next/dist/docs/` before changing Next.js boundaries or APIs.
- Preserve the existing untracked `debug.log`.

---

## File Map

- `src/app/globals.css` — Mosaic light/dark semantic tokens and global density.
- `src/theme/tokens/index.ts` — TypeScript access to the stable semantic token names.
- `src/shared/ui/Button.tsx` — compact Mosaic button visuals with 44 px hit areas.
- `src/shared/ui/Card.tsx` — flat Mosaic surface, border, radius, and shadow.
- `src/shared/ui/Badge.tsx` — quieter semantic status pills.
- `src/shared/ui/FormControls.tsx` — Mosaic fields, search, checkboxes, radio and segmented controls.
- `src/shared/ui/Navigation.tsx` — purple focus/selected states for breadcrumbs, tabs, chips, and pagination.
- `src/shared/ui/Feedback.tsx` — restrained alerts, progress, empty and error states.
- `src/shared/ui/Overlays.tsx` — Mosaic modal/drawer/sheet/popover surfaces without behavior changes.
- `src/shared/components/app-shell/ShellFrame.tsx` — new client boundary for persisted sidebar expansion.
- `src/shared/components/app-shell/AppShell.tsx` — server composition delegating visual shell state.
- `src/shared/components/app-shell/Sidebar.tsx` — 80/240 px rail and accessible expansion control.
- `src/shared/components/app-shell/Header.tsx` — 64 px Mosaic header.
- `src/shared/components/app-shell/MobileNavigation.tsx` — light Mosaic mobile drawer.
- `src/modules/dashboard/Dashboard.tsx` — denser page header, KPI grid, map/status layout.
- `src/modules/dashboard/DashboardPanels.tsx` — compact KPI, status, event surfaces.
- `src/shared/components/fleet/index.tsx` — Mosaic fleet primitives.
- `src/modules/dashboard/MobileFleetWorkspace.tsx` — floating controls and bottom-sheet styling only.
- `src/modules/dashboard/FleetMap.tsx` — marker presentation only; map behavior is frozen.
- `src/app/ui-kit/page.tsx` — compact Mosaic catalogue header.
- `src/app/ui-kit/sections.tsx` — Mosaic spacing and examples without contract removal.
- `tests/dashboard.spec.ts` — persisted sidebar, map resize, and layout regression tests.
- `tests/ui-kit.spec.ts` — token, dark-theme, density, and responsive regression tests.
- `README.md` — current visual direction note.
- `docs/PROJECT_GUIDE.md` — canonical design-system section update.

---

### Task 1: Replace Theme Tokens and Shared Primitive Styling

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/theme/tokens/index.ts`
- Modify: `src/shared/ui/Button.tsx`
- Modify: `src/shared/ui/Card.tsx`
- Modify: `src/shared/ui/Badge.tsx`
- Modify: `src/shared/ui/FormControls.tsx`
- Modify: `src/shared/ui/Navigation.tsx`
- Modify: `src/shared/ui/Feedback.tsx`
- Modify: `src/shared/ui/Overlays.tsx`
- Test: `tests/ui-kit.spec.ts`

**Interfaces:**

- Keeps every existing UI export and prop type unchanged.
- Produces Mosaic semantic variables including `--color-primary`, `--color-primary-soft`, `--color-canvas`, `--color-navigation`, `--sidebar-width-collapsed`, `--sidebar-width-expanded`, and `--header-height`.
- Keeps `--sidebar-width` as the current runtime width consumed by the shell.

- [ ] **Step 1: Add failing token and primitive visual-contract tests**

Append this test to `tests/ui-kit.spec.ts`:

```ts
test('светлая тема использует визуальные токены Mosaic', async ({ page }) => {
  await page.goto('/ui-kit');
  await page.evaluate(() => localStorage.setItem('pilot-theme', 'light'));
  await page.reload();

  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(243, 244, 246)');
  await expect(page.locator('body')).toHaveCSS('font-family', /Inter/);

  const primary = page.getByTestId('button-primary');
  await expect(primary).toHaveCSS('background-color', 'rgb(99, 102, 241)');
  await expect(primary).toHaveCSS('border-radius', '8px');

  const card = page.getByTestId('showcase-card');
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(card).toHaveCSS('border-radius', '12px');
});
```

If `showcase-card` does not yet exist on the current UI Kit card example, add that attribute to the existing example in `sections.tsx` as part of the test setup; do not create a second card solely for the test.

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
npx playwright test --project=desktop tests/ui-kit.spec.ts -g "визуальные токены Mosaic" --workers=1
```

Expected: FAIL because the body is `rgb(245, 247, 250)` and the primary action is teal.

- [ ] **Step 3: Replace the global semantic token tables**

Use this light token contract in `globals.css`:

```css
:root {
  color-scheme: light;
  --color-canvas: #f3f4f6;
  --color-surface: #ffffff;
  --color-elevated: #f9fafb;
  --color-navigation: #ffffff;
  --color-navigation-muted: #6b7280;
  --color-text: #1f2937;
  --color-text-secondary: #6b7280;
  --color-text-inverse: #ffffff;
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-primary-soft: #eef2ff;
  --color-success: #16a34a;
  --color-success-soft: #dcfce7;
  --color-warning: #d97706;
  --color-warning-soft: #fef3c7;
  --color-danger: #dc2626;
  --color-danger-soft: #fee2e2;
  --color-border: #e5e7eb;
  --color-border-strong: #d1d5db;
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.05);
  --shadow-floating: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-panel: 12px;
  --motion-fast: 150ms;
  --motion-normal: 220ms;
  --sidebar-width-collapsed: 80px;
  --sidebar-width-expanded: 240px;
  --sidebar-width: var(--sidebar-width-collapsed);
  --header-height: 64px;
}
```

Use this dark override contract:

```css
:root[data-theme='dark'] {
  color-scheme: dark;
  --color-canvas: #111827;
  --color-surface: #1f2937;
  --color-elevated: #273244;
  --color-navigation: #1f2937;
  --color-navigation-muted: #9ca3af;
  --color-text: #f9fafb;
  --color-text-secondary: #9ca3af;
  --color-text-inverse: #ffffff;
  --color-primary: #818cf8;
  --color-primary-hover: #a5b4fc;
  --color-primary-soft: #312e81;
  --color-success: #4ade80;
  --color-success-soft: #14532d;
  --color-warning: #fbbf24;
  --color-warning-soft: #78350f;
  --color-danger: #f87171;
  --color-danger-soft: #7f1d1d;
  --color-border: #374151;
  --color-border-strong: #4b5563;
}
```

Keep the existing reduced-motion rule verbatim. Update `themeTokens` only to add stable accessors; do not duplicate the hex values in TypeScript:

```ts
layout: {
  sidebarCollapsed: 'var(--sidebar-width-collapsed)',
  sidebarExpanded: 'var(--sidebar-width-expanded)',
  headerHeight: 'var(--header-height)',
},
```

- [ ] **Step 4: Restyle shared primitives without changing behavior**

Apply these exact visual rules:

- `Card`: `rounded-[var(--radius-panel)] border bg-[var(--color-surface)] shadow-[var(--shadow-card)]`.
- `CardHeader`: `border-b px-5 py-4`.
- `CardContent`: `p-5`.
- `Button`: all public sizes keep `min-h-11 min-w-11`; `xs/sm` reduce font and horizontal visible padding, not hit height.
- `Input`, `Select`, `SearchInput`, `Textarea`: white/elevated background, `rounded-[var(--radius-md)]`, primary focus ring.
- `Badge`: `rounded-full px-2 py-0.5 text-xs font-medium` with soft semantic colors.
- Tabs, chips and pagination: primary soft selected state, primary focus ring, neutral unselected text.
- Modal, Drawer, BottomSheet and Popover: radius 12 px on desktop, 16 px only for the mobile sheet top corners; use `--shadow-floating`.

Do not change event handlers, focus management, roles, test IDs, or exported prop names.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm run lint
npm run typecheck
npx playwright test --project=desktop tests/ui-kit.spec.ts --workers=1
git diff --check
```

Expected: PASS.

```powershell
git add src/app/globals.css src/theme/tokens/index.ts src/shared/ui tests/ui-kit.spec.ts src/app/ui-kit/sections.tsx
git commit -m "feat: adopt Mosaic theme tokens and primitives"
```

---

### Task 2: Build the Collapsible Mosaic Application Shell

**Files:**

- Create: `src/shared/components/app-shell/ShellFrame.tsx`
- Modify: `src/shared/components/app-shell/AppShell.tsx`
- Modify: `src/shared/components/app-shell/Sidebar.tsx`
- Modify: `src/shared/components/app-shell/Header.tsx`
- Modify: `src/shared/components/app-shell/MobileNavigation.tsx`
- Test: `tests/dashboard.spec.ts`

**Interfaces:**

- Produces `ShellFrame({ children, breadcrumbs })` as the single client boundary for shell width.
- Extends `SidebarProps` with `expanded?: boolean` while preserving `onNavigate?: () => void`.
- Uses localStorage key `pilot-sidebar-expanded` with values `true` and `false`.
- Adds `data-sidebar-expanded` to the root shell and `data-testid="desktop-sidebar"` to the desktop rail.

- [ ] **Step 1: Add failing sidebar behavior tests**

Add these tests to `tests/dashboard.spec.ts`:

```ts
test('настольная навигация раскрывается и сохраняет состояние', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const shell = page.getByTestId('app-shell');
  const sidebar = page.getByTestId('desktop-sidebar');
  const toggle = page.getByRole('button', { name: 'Развернуть навигацию' });

  await expect(sidebar).toHaveCSS('width', '80px');
  await toggle.click();
  await expect(shell).toHaveAttribute('data-sidebar-expanded', 'true');
  await expect(sidebar).toHaveCSS('width', '240px');
  await expect(page.getByRole('button', { name: 'Свернуть навигацию' })).toBeVisible();

  await page.reload();
  await expect(shell).toHaveAttribute('data-sidebar-expanded', 'true');
  await expect(sidebar).toHaveCSS('width', '240px');
});

test('раскрытие навигации не ломает карту', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const map = page.getByTestId('fleet-map-workspace');
  const before = await map.boundingBox();

  await page.getByRole('button', { name: 'Развернуть навигацию' }).click();
  await expect
    .poll(async () => (await map.boundingBox())?.width ?? 0)
    .toBeLessThan(before?.width ?? 0);
  await expect(map.getByLabel('Карта автопарка').locator('canvas')).toBeVisible();
  await expect(map.getByText('OpenStreetMap', { exact: false })).toBeVisible();
});
```

- [ ] **Step 2: Run the tests and confirm RED**

```powershell
npx playwright test --project=desktop tests/dashboard.spec.ts -g "навигаци" --workers=1
```

Expected: FAIL because no expansion control or `data-sidebar-expanded` contract exists.

- [ ] **Step 3: Implement the client shell boundary**

Create `ShellFrame.tsx` with this contract:

```tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { Header } from './Header';
import { Sidebar } from './Sidebar';
import type { Breadcrumb } from './AppShell';

const storageKey = 'pilot-sidebar-expanded';

export function ShellFrame({
  children,
  breadcrumbs,
}: {
  children: ReactNode;
  breadcrumbs: readonly Breadcrumb[];
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(window.localStorage.getItem(storageKey) === 'true');
  }, []);

  function toggleSidebar() {
    setExpanded((current) => {
      const next = !current;
      window.localStorage.setItem(storageKey, String(next));
      return next;
    });
  }

  const sidebarWidth = expanded
    ? 'var(--sidebar-width-expanded)'
    : 'var(--sidebar-width-collapsed)';

  return (
    <div
      data-testid="app-shell"
      data-sidebar-expanded={expanded}
      style={{ '--sidebar-width': sidebarWidth } as React.CSSProperties}
      className="min-h-screen overflow-x-hidden bg-[var(--color-canvas)] text-[var(--color-text)]"
    >
      <Header breadcrumbs={breadcrumbs} />
      <aside
        data-testid="desktop-sidebar"
        className="fixed inset-y-0 left-0 z-50 hidden w-[var(--sidebar-width)] border-r bg-[var(--color-navigation)] md:flex md:flex-col"
      >
        <Sidebar expanded={expanded} onToggle={toggleSidebar} />
      </aside>
      <main className="min-h-screen pt-[var(--header-height)] md:pl-[var(--sidebar-width)]">
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
```

If the installed React lint rule rejects synchronous state assignment in an effect, replace the state source with `useSyncExternalStore` over a `storage` subscription; do not disable the lint rule.

Reduce `AppShell.tsx` to the server composition:

```tsx
export function AppShell({ children, breadcrumbs = [] }: AppShellProps) {
  return <ShellFrame breadcrumbs={breadcrumbs}>{children}</ShellFrame>;
}
```

- [ ] **Step 4: Implement Mosaic sidebar and header visuals**

`Sidebar` must render:

- a 64 px logo row with the Pilot+ mark centered while collapsed;
- navigation labels with `overflow-hidden whitespace-nowrap` and opacity/width transition;
- active link `bg-[var(--color-primary-soft)] text-[var(--color-primary)]`;
- neutral icons `text-[var(--color-navigation-muted)]`;
- a bottom `IconButton` named `Развернуть навигацию` or `Свернуть навигацию`.

Add `onToggle: () => void` to `SidebarProps`. Keep the existing `navigation` data and links unchanged.

`Header` must remain behaviorally identical but use:

```tsx
className =
  'fixed inset-x-0 top-0 z-40 flex h-[var(--header-height)] items-center border-b bg-[var(--color-surface)] px-4 md:pl-[var(--sidebar-width)]';
```

Use 44 px icon buttons with neutral gray icons, a compact 40 px visible search field inside its 44 px wrapper, a separator before profile, and purple focus styles inherited from primitives. Mobile still shows menu + Pilot+ and opens the existing accessible Drawer.

- [ ] **Step 5: Verify and commit**

```powershell
npm run lint
npm run typecheck
npx playwright test --project=desktop tests/dashboard.spec.ts --workers=1
git diff --check
```

Expected: PASS, including map canvas and attribution after width transition.

```powershell
git add src/shared/components/app-shell tests/dashboard.spec.ts
git commit -m "feat: add collapsible Mosaic application shell"
```

---

### Task 3: Restyle the Desktop Dashboard and Fleet Compositions

**Files:**

- Modify: `src/modules/dashboard/Dashboard.tsx`
- Modify: `src/modules/dashboard/DashboardPanels.tsx`
- Modify: `src/shared/components/fleet/index.tsx`
- Test: `tests/dashboard.spec.ts`

**Interfaces:**

- Keeps `DashboardProps`, fixtures, fleet component props, map props, and test IDs unchanged.
- Adds no chart dependency and no fake chart business data.

- [ ] **Step 1: Add failing desktop density tests**

Add:

```ts
test('настольная панель использует плотную сетку Mosaic', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Панель управления' })).toHaveCSS(
    'font-size',
    '30px',
  );
  await expect(page.getByTestId('fleet-stat-total')).toHaveCSS('border-radius', '12px');

  const map = await page.getByTestId('fleet-map-workspace').boundingBox();
  const status = await page.getByTestId('fleet-status-panel').boundingBox();
  expect((map?.width ?? 0) / (status?.width ?? 1)).toBeGreaterThan(1.7);
});
```

Add `data-testid="fleet-stat-${stat.id}"` to the existing KPI card and `data-testid="fleet-status-panel"` to the existing status card; these attributes become stable regression contracts.

- [ ] **Step 2: Confirm RED**

```powershell
npx playwright test --project=desktop tests/dashboard.spec.ts -g "плотную сетку Mosaic" --workers=1
```

Expected: FAIL because the current heading text is `Центр управления транспортом` and panel radius is 20 px.

- [ ] **Step 3: Apply the Mosaic dashboard composition**

Change the desktop heading block to a single responsive row:

```tsx
<header className="flex flex-wrap items-center justify-between gap-4">
  <div>
    <h1 className="text-[30px] leading-10 font-bold tracking-tight">Панель управления</h1>
    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
      Мониторинг демонстрационного автопарка
    </p>
  </div>
  <div className="flex flex-wrap gap-2" aria-label="Действия панели управления">
    <Button variant="secondary">Фильтр</Button>
    <Button variant="secondary">Сегодня</Button>
    <Button>Добавить вид</Button>
  </div>
</header>
```

These buttons remain demonstrational and must not mutate data. Use existing `Button` exports; do not add local button styling.

Use `gap-6` throughout desktop. KPI cards remain four/two/one responsive. Use `xl:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]` for map/status. Preserve map height, `FleetMapClient`, test ID, and all data.

- [ ] **Step 4: Restyle fleet panels through shared tokens**

Apply:

- KPI value `text-3xl font-bold tracking-tight`;
- KPI label `text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]`;
- icons in 40 px primary-soft squares;
- status cards with smaller `p-3`, 12 px radius and no nested heavy shadow;
- events as compact rows with subtle dividers;
- fleet markers retain their colors and selection behavior but use radius 8 px and the Mosaic shadow token.

Do not change status labels, values, fixtures, marker event handlers, or selection state.

- [ ] **Step 5: Verify and commit**

```powershell
npm run lint
npm run typecheck
npx playwright test --project=desktop tests/dashboard.spec.ts --workers=1
git diff --check
```

Expected: PASS.

```powershell
git add src/modules/dashboard/Dashboard.tsx src/modules/dashboard/DashboardPanels.tsx src/shared/components/fleet/index.tsx tests/dashboard.spec.ts
git commit -m "feat: restyle Pilot dashboard with Mosaic density"
```

---

### Task 4: Restyle Mobile Map Controls and the Executable UI Kit

**Files:**

- Modify: `src/modules/dashboard/MobileFleetWorkspace.tsx`
- Modify: `src/modules/dashboard/FleetMap.tsx`
- Modify: `src/app/ui-kit/page.tsx`
- Modify: `src/app/ui-kit/sections.tsx`
- Test: `tests/dashboard.spec.ts`
- Test: `tests/ui-kit.spec.ts`

**Interfaces:**

- Keeps every map, filter, drag, snap, selection, UI Kit export, and stable test ID unchanged.
- Changes CSS classes and token consumption only.

- [ ] **Step 1: Add failing mobile visual tests**

Add:

```ts
test('мобильная карта использует плавающие поверхности Mosaic', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const search = page.getByRole('searchbox', { name: 'Поиск транспорта' });
  await expect(search).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(search).toHaveCSS('border-radius', '8px');

  const sheet = page.getByTestId('vehicle-bottom-sheet');
  await expect(sheet).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(sheet).toHaveCSS('border-top-left-radius', '16px');
});
```

Add to `ui-kit.spec.ts`:

```ts
test('каталог сохраняет плотность Mosaic на телефоне', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/ui-kit');
  await expect(page.getByRole('heading', { name: 'Дизайн-система Pilot+' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
```

- [ ] **Step 2: Confirm RED**

```powershell
npx playwright test --project=desktop tests/dashboard.spec.ts tests/ui-kit.spec.ts -g "Mosaic" --workers=1
```

Expected: at least the mobile sheet radius assertion fails because it currently uses the global 12/20 px panel token rather than an explicit 16 px mobile top radius.

- [ ] **Step 3: Restyle mobile map composition without touching behavior**

In `MobileFleetWorkspace.tsx`:

- keep `FleetMapClient`, state, filter functions, pointer capture, and snap calculations byte-for-byte unless formatting requires movement;
- search: `rounded-[var(--radius-md)] border bg-[var(--color-surface)] shadow-[var(--shadow-card)]`;
- chips: white/elevated surface, compact 44 px target, purple selected state from `FilterChip`;
- sheet: `rounded-t-2xl border bg-[var(--color-surface)] shadow-[var(--shadow-floating)]`;
- drag handle: neutral strong border color;
- snap buttons: ghost icon style with primary-soft selected state.

In `FleetMap.tsx`, change only marker class styling to the Mosaic surface/radius/shadow tokens. Do not alter the effect, ResizeObserver, RAF, MapLibre configuration, errors, or cleanup.

- [ ] **Step 4: Restyle UI Kit layout**

Use a compact header (`mb-6`), 30 px H1, section spacing `py-8`, cards with `p-5`, and the same gray canvas/white surface hierarchy. Preserve all showcase test IDs and all actual component instances, especially ConfirmationDialog, Drawer, and fleet components.

- [ ] **Step 5: Verify and commit**

```powershell
npm run lint
npm run typecheck
npx playwright test --project=desktop tests/dashboard.spec.ts tests/ui-kit.spec.ts --workers=1
git diff --check
```

Expected: PASS.

```powershell
git add src/modules/dashboard/MobileFleetWorkspace.tsx src/modules/dashboard/FleetMap.tsx src/app/ui-kit tests/dashboard.spec.ts tests/ui-kit.spec.ts
git commit -m "feat: apply Mosaic styling to mobile map and UI kit"
```

---

### Task 5: Complete Visual, Documentation, and Delivery Verification

**Files:**

- Modify: `README.md`
- Modify: `docs/PROJECT_GUIDE.md`
- Modify: `tests/dashboard.spec.ts`
- Modify: `tests/ui-kit.spec.ts`

**Interfaces:**

- Produces a documented redesign with a fully green delivery branch.
- Leaves `debug.log` untracked and untouched.

- [ ] **Step 1: Add final theme and responsive assertions**

Extend the existing viewport loop so both `/` and `/ui-kit` are checked at 375, 768, 1024 and 1440 px in light and dark themes. Use the existing overflow assertion and add:

```ts
await expect(page.locator('body')).toHaveCSS(
  'background-color',
  theme === 'light' ? 'rgb(243, 244, 246)' : 'rgb(17, 24, 39)',
);
```

Do not duplicate the loop; parameterize the existing responsive test by theme.

- [ ] **Step 2: Update documentation**

In `README.md`, add one sentence under the interface section:

```md
Визуальная система интерфейса использует светлую плотную композицию в стиле Mosaic: компактную навигационную рейку, фиолетовый акцент и плоские информационные панели; продуктовые сценарии и карта остаются собственными Pilot+.
```

In `docs/PROJECT_GUIDE.md`, replace the old teal/dark-navigation design paragraph with:

```md
Текущее визуальное направление Pilot+ основано на плотной dashboard-композиции Mosaic: холодный серый canvas, белые поверхности, фиолетовый основной акцент, компактная раскрываемая навигационная рейка и сдержанные тени. Это визуальная адаптация, а не перенос бизнес-компонентов Mosaic. Карта, телематика и продуктовые сценарии остаются собственными Pilot+.
```

Keep the historical Tailwind decision and all infrastructure/domain sections.

- [ ] **Step 3: Run the complete delivery gate**

```powershell
npm run lint
npm run typecheck
npm run format:check
npx playwright test --workers=1
npm run build
git diff --check
git status --short
```

Expected:

- lint: exit 0;
- typecheck: exit 0;
- format check: exit 0;
- all desktop and mobile Chromium tests pass;
- Next.js 16.2 production build succeeds for `/` and `/ui-kit`;
- diff check: exit 0;
- status contains only the task files and the preserved untracked `debug.log` before commit.

- [ ] **Step 4: Perform visual inspection**

Capture and inspect these views against Mosaic:

- `/` at 1440×1000, light, sidebar collapsed;
- `/` at 1440×1000, light, sidebar expanded;
- `/` at 375×812, light;
- `/` at 375×812, dark;
- `/ui-kit` at 1440×1000, light;
- `/ui-kit` at 375×812, dark.

Accept only when:

- the sidebar is white and visually close to Mosaic’s 80 px rail;
- the accent is purple rather than teal;
- cards are flat 12 px surfaces;
- the map remains visible, correctly sized, and dominant;
- mobile search, filters, and sheet float cleanly above the map;
- no view has horizontal overflow or unreadable contrast.

- [ ] **Step 5: Commit**

```powershell
git add README.md docs/PROJECT_GUIDE.md tests/dashboard.spec.ts tests/ui-kit.spec.ts
git commit -m "chore: verify Mosaic visual redesign"
```

---

## Completion Gate

The redesign is complete only when all five task reviews are approved, the complete delivery gate passes on the final commit, and visual inspection confirms Mosaic-like proportions at every required viewport without any change to map or product behavior.
