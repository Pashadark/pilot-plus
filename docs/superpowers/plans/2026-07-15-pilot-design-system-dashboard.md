# Pilot+ Design System and Map-First Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable Pilot+ UI Kit and use it to deliver a responsive Pilot Operations dashboard whose mobile primary surface is a full-screen fleet map.

**Architecture:** Keep route files as Server Components and isolate theme, overlays, navigation state, and MapLibre behind small Client Component boundaries. Semantic CSS variables provide the stable design contract; `shared/ui` exposes typed primitives, `shared/components` composes product patterns, and typed dashboard fixtures remain separate from rendering.

**Tech Stack:** Next.js 16.2 App Router and Turbopack, React 19.2, TypeScript 5 strict mode, Tailwind CSS 4, Framer Motion, MapLibre GL, React Icons Feather set, Playwright.

## Global Constraints

- Preserve the Pilot Operations direction: dark navigation, light workspace, teal-blue accent, restrained elevation.
- Use Inter from `next/font`; do not load fonts from a runtime CDN.
- Use semantic CSS variables in components; do not add raw hex colors to component class strings.
- Use only Feather icons from `react-icons/fi`; no emoji as structural UI icons.
- Keep routine motion between 150 and 250 ms and respect `prefers-reduced-motion`.
- Keep all touch targets at least 44 by 44 px.
- Keep `/` and `/ui-kit` usable at 375, 768, 1024 and 1440 px without horizontal page scrolling.
- Mobile `/` uses a full-screen map with floating search, filters, controls and a vehicle bottom sheet.
- Do not add real telemetry, authentication, API integration or backend state in this plan.
- Do not introduce `any` types.
- Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` immediately before changing a Next.js API.

---

## File Map

### Create

- `playwright.config.ts` — browser test configuration.
- `tests/ui-kit.spec.ts` — UI Kit routes, states, themes and overflow checks.
- `tests/dashboard.spec.ts` — desktop and mobile dashboard behavior.
- `src/theme/tokens/index.ts` — exported token names used by TS consumers.
- `src/shared/providers/ThemeProvider.tsx` — persisted theme state and no-flash initialization.
- `src/shared/ui/Button.tsx` — button variants, sizes and states.
- `src/shared/ui/IconButton.tsx` — accessible icon-only actions.
- `src/shared/ui/Badge.tsx` — semantic badge variants.
- `src/shared/ui/Card.tsx` — card composition primitives.
- `src/shared/ui/FormControls.tsx` — input, select, checkbox, switch and segmented controls.
- `src/shared/ui/Navigation.tsx` — breadcrumbs, tabs, pagination and filter chips.
- `src/shared/ui/Feedback.tsx` — alerts, progress, spinner, skeleton, empty and error states.
- `src/shared/ui/Overlays.tsx` — tooltip, dropdown, modal, drawer and bottom sheet.
- `src/shared/ui/index.ts` — public UI Kit exports.
- `src/shared/components/app-shell/AppShell.tsx` — responsive application shell.
- `src/shared/components/app-shell/Header.tsx` — page header and global actions.
- `src/shared/components/app-shell/Sidebar.tsx` — grouped desktop navigation.
- `src/shared/components/app-shell/MobileNavigation.tsx` — mobile drawer trigger and content.
- `src/modules/dashboard/types.ts` — dashboard fixture types.
- `src/modules/dashboard/fixtures.ts` — typed demo data.
- `src/modules/dashboard/Dashboard.tsx` — desktop/tablet dashboard composition.
- `src/modules/dashboard/DashboardPanels.tsx` — KPI, event and status product components.
- `src/modules/dashboard/FleetMapClient.tsx` — dynamic browser-only map boundary.
- `src/modules/dashboard/FleetMap.tsx` — MapLibre implementation.
- `src/modules/dashboard/MobileFleetWorkspace.tsx` — full-screen map overlays and sheet.
- `src/app/ui-kit/page.tsx` — visible component catalog.
- `src/app/ui-kit/sections.tsx` — categorized component examples.

### Modify

- `package.json` and `package-lock.json` — quality scripts and Playwright dependency.
- `eslint.config.mjs` — ignore Prisma generated output.
- `src/app/globals.css` — semantic light/dark tokens and global interaction rules.
- `src/app/layout.tsx` — Inter, metadata and theme provider.
- `src/app/page.tsx` — Server Component dashboard route.
- `src/shared/layouts/AppLayout.tsx` — replaced by the new shell or reduced to a compatibility re-export.
- existing header, sidebar, cards and map components — replaced or re-exported without duplicated implementations.

---

### Task 1: Establish a Green Quality and Browser-Test Baseline

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `eslint.config.mjs`
- Modify: `src/shared/components/dashboard/StatCard.tsx`
- Modify: `src/shared/components/header/Header.tsx`
- Modify: `src/shared/components/map/FleetMap.tsx`
- Modify: `src/shared/components/map/VehiclePanel.tsx`
- Create: `playwright.config.ts`
- Create: `tests/ui-kit.spec.ts`

**Interfaces:**

- Produces npm scripts `typecheck`, `format:check`, `test:e2e` and `test:e2e:install`.
- Produces a Playwright `webServer` contract at `http://127.0.0.1:3000`.

- [ ] **Step 1: Install Playwright and add quality scripts**

Run:

```powershell
npm install --save-dev @playwright/test
```

Add these exact scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,css}\" \"tests/**/*.ts\" \"*.{json,md,ts,mjs,yaml}\"",
    "test:e2e": "playwright test",
    "test:e2e:install": "playwright install chromium"
  }
}
```

- [ ] **Step 2: Write the first failing route test**

Create `tests/ui-kit.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('UI Kit is reachable from the application', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Дизайн-система' }).click();
  await expect(page).toHaveURL(/\/ui-kit$/);
  await expect(page.getByRole('heading', { name: 'Pilot+ UI Kit', level: 1 })).toBeVisible();
});
```

- [ ] **Step 3: Configure Playwright and verify the test fails**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

Run:

```powershell
npm run test:e2e:install
npm run test:e2e -- --project=desktop tests/ui-kit.spec.ts
```

Expected: FAIL because the `Дизайн-система` link and `/ui-kit` route do not exist.

- [ ] **Step 4: Exclude generated Prisma files and remove application lint errors**

Add to `globalIgnores` in `eslint.config.mjs`:

```js
"src/database/generated/**",
"src/database/src/generated/**",
```

Replace each application `any` with these contracts:

```ts
import type { Root } from 'react-dom/client';
import type { IconType } from 'react-icons';

type VehicleStatus = 'online' | 'moving' | 'idle' | 'alarm';

interface Vehicle {
  name: string;
  plate: string;
  speed: number;
  status: VehicleStatus;
  lng: number;
  lat: number;
}

// StatCard icon
icon: IconType;

// FleetMap refs and state
useRef<Root[]>([]);
useState<Vehicle | null>(null);

// VehiclePanel prop
vehicle: Vehicle;
```

Remove the unused `color`, `FiSun` and duplicate `VehicleStatus` declarations.

- [ ] **Step 5: Verify the baseline**

Run:

```powershell
npm run lint
npm run typecheck
npm run build
```

Expected: all commands exit 0. The e2e test remains intentionally red until Task 5.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json eslint.config.mjs playwright.config.ts tests/ui-kit.spec.ts src/shared/components
git commit -m "test: establish UI quality baseline"
```

---

### Task 2: Implement Theme Tokens and Foundational UI Primitives

**Files:**

- Create: `src/theme/tokens/index.ts`
- Create: `src/shared/providers/ThemeProvider.tsx`
- Create: `src/shared/ui/Button.tsx`
- Create: `src/shared/ui/IconButton.tsx`
- Modify: `src/shared/ui/Badge.tsx`
- Modify: `src/shared/ui/Card.tsx`
- Create: `src/shared/ui/index.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Test: `tests/ui-kit.spec.ts`

**Interfaces:**

- Produces `Theme = "light" | "dark"` and `useTheme(): { theme; setTheme; toggleTheme }`.
- Produces `Button`, `IconButton`, `Badge`, `Card`, `CardHeader`, `CardContent`.
- All primitives accept standard DOM props plus documented variant props.

- [ ] **Step 1: Add failing theme and primitive tests**

Append to `tests/ui-kit.spec.ts`:

```ts
test('theme and action primitives expose accessible states', async ({ page }) => {
  await page.goto('/ui-kit');
  await expect(page.getByTestId('button-primary')).toBeVisible();
  await expect(page.getByTestId('button-loading')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByTestId('button-disabled')).toBeDisabled();

  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
```

Run `npm run test:e2e -- --project=desktop tests/ui-kit.spec.ts`.

Expected: FAIL because the route and primitives are not implemented.

- [ ] **Step 2: Define semantic tokens**

Replace the token section in `src/app/globals.css` with semantic roles:

```css
:root {
  color-scheme: light;
  --color-canvas: #f5f7fa;
  --color-surface: #ffffff;
  --color-elevated: #ffffff;
  --color-navigation: #10243a;
  --color-navigation-muted: #91a3b5;
  --color-text: #172033;
  --color-text-secondary: #64748b;
  --color-text-inverse: #ffffff;
  --color-primary: #0092be;
  --color-primary-hover: #007fa6;
  --color-primary-soft: #dff6fb;
  --color-success: #168a5b;
  --color-success-soft: #e5f7ef;
  --color-warning: #b76e00;
  --color-warning-soft: #fff4db;
  --color-danger: #cf3f4f;
  --color-danger-soft: #ffeaed;
  --color-border: #e3e9ef;
  --color-border-strong: #cbd5df;
  --shadow-card: 0 1px 2px rgb(15 23 42 / 0.04), 0 10px 30px rgb(15 23 42 / 0.05);
  --shadow-floating: 0 18px 48px rgb(15 23 42 / 0.14);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-panel: 20px;
  --motion-fast: 150ms;
  --motion-normal: 220ms;
  --sidebar-width: 272px;
  --header-height: 72px;
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --color-canvas: #09121f;
  --color-surface: #101c2b;
  --color-elevated: #17263a;
  --color-navigation: #07111e;
  --color-navigation-muted: #9aabbb;
  --color-text: #f4f7fa;
  --color-text-secondary: #a7b5c3;
  --color-text-inverse: #07111e;
  --color-primary: #39b5d7;
  --color-primary-hover: #68c8e2;
  --color-primary-soft: #123748;
  --color-success: #55c891;
  --color-success-soft: #14382a;
  --color-warning: #efb550;
  --color-warning-soft: #3c2d14;
  --color-danger: #ff7886;
  --color-danger-soft: #421e25;
  --color-border: #26384d;
  --color-border-strong: #3b5068;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Export matching readonly names from `src/theme/tokens/index.ts`:

```ts
export const themeTokens = {
  colors: {
    canvas: 'var(--color-canvas)',
    surface: 'var(--color-surface)',
    text: 'var(--color-text)',
    primary: 'var(--color-primary)',
  },
  radii: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)' },
  motion: { fast: 'var(--motion-fast)', normal: 'var(--motion-normal)' },
} as const;
```

- [ ] **Step 3: Implement persisted theme provider**

Create `ThemeProvider.tsx` with this public contract:

```tsx
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const saved = window.localStorage.getItem('pilot-theme');
    setThemeState(saved === 'dark' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('pilot-theme', theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
```

In `layout.tsx`, load `Inter` from `next/font/google`, set its variable on `<body>`, wrap only `{children}` with `ThemeProvider`, and place this no-flash initializer in `<head>` before the body is painted:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{var saved=localStorage.getItem("pilot-theme");var theme=saved==="dark"?"dark":"light";document.documentElement.dataset.theme=theme}catch(_){document.documentElement.dataset.theme="light"}})()`,
  }}
/>
```

Initialize the provider from `document.documentElement.dataset.theme` in its mount effect so the React state agrees with the pre-paint script. Keep the script constant and never interpolate user-controlled data.

- [ ] **Step 4: Implement typed actions and display primitives**

Use these exact union contracts:

```ts
export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'outline' | 'ghost' | 'danger';
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg';
export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
```

`Button` extends `React.ButtonHTMLAttributes<HTMLButtonElement>`, accepts `variant`, `size`, `loading`, `leadingIcon` and `trailingIcon`, sets `aria-busy={loading}`, and disables itself while loading. `IconButton` requires `label: string` and applies it as `aria-label`. Use variant and size lookup objects containing token-based Tailwind arbitrary values such as `bg-[var(--color-primary)]`, never raw colors.

`Card` exports compound `Card`, `CardHeader`, and `CardContent` elements using `var(--color-surface)`, `var(--color-border)`, `var(--radius-panel)` and `var(--shadow-card)`.

- [ ] **Step 5: Export primitives and verify types**

Create `src/shared/ui/index.ts`:

```ts
export * from './Badge';
export * from './Button';
export * from './Card';
export * from './IconButton';
```

Run `npm run typecheck` and `npm run lint`.

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/app src/theme src/shared/providers src/shared/ui tests/ui-kit.spec.ts
git commit -m "feat: add Pilot theme and UI foundations"
```

---

### Task 3: Add Forms, Navigation, Feedback and Overlay Primitives

**Files:**

- Create: `src/shared/ui/FormControls.tsx`
- Create: `src/shared/ui/Navigation.tsx`
- Create: `src/shared/ui/Feedback.tsx`
- Create: `src/shared/ui/Overlays.tsx`
- Modify: `src/shared/ui/index.ts`
- Test: `tests/ui-kit.spec.ts`

**Interfaces:**

- Produces controlled and uncontrolled native form wrappers, including the dedicated `SearchInput` used by the map workspace.
- Produces `Breadcrumbs`, `Tabs`, `Pagination`, `FilterChip`, `Alert`, `Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, `Tooltip`, `DropdownMenu`, `Modal`, `Drawer`, `BottomSheet`.

- [ ] **Step 1: Add failing keyboard and semantics tests**

Append:

```ts
test('overlays and form controls are keyboard accessible', async ({ page }) => {
  await page.goto('/ui-kit');
  await page.getByRole('button', { name: 'Открыть окно' }).click();
  await expect(page.getByRole('dialog', { name: 'Пример окна' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Пример окна' })).toBeHidden();

  await expect(page.getByLabel('Название автомобиля')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Только онлайн' })).toBeVisible();
});
```

Run the desktop test and expect FAIL.

- [ ] **Step 2: Implement native-first form controls**

Define shared props:

```ts
interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}
```

`Input` and `Select` combine `FieldShellProps` with their native element props, derive `aria-describedby` IDs with `useId`, set `aria-invalid={Boolean(error)}`, and render the error immediately below the control with `role="alert"`. `Checkbox` uses a native checkbox. `Switch` uses a native checkbox with `role="switch"`. `SegmentedControl<T extends string>` accepts `value`, `options: readonly { value: T; label: string }[]`, and `onChange(value: T)`.

`SearchInput` extends `React.InputHTMLAttributes<HTMLInputElement>`, always sets `type="search"`, exposes the native `searchbox` role, accepts `className`, and does not require a visible `label` when an `aria-label` is supplied.

- [ ] **Step 3: Implement navigation and feedback contracts**

Use these types:

```ts
interface BreadcrumbItem {
  label: string;
  href?: string;
}
interface TabItem<T extends string> {
  value: T;
  label: string;
  badge?: number;
}
interface FeedbackProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}
```

Breadcrumb links use `next/link`; the final crumb renders `aria-current="page"`. Tabs use buttons with `role="tab"`, `aria-selected` and roving keyboard selection. `FilterChip` uses `aria-pressed`. `Alert` uses `role="status"` or `role="alert"` by tone. `Spinner` exposes an accessible label. `Skeleton` is `aria-hidden`.

- [ ] **Step 4: Implement overlays with one shared dialog boundary**

`Modal` accepts:

```ts
interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}
```

`ModalProps` also extends `React.HTMLAttributes<HTMLDivElement>` after omitting conflicting keys, so `data-testid`, `className`, and other valid container attributes pass through. `BottomSheet` extends that contract with `snap: "collapsed" | "intermediate" | "expanded"` and `onSnapChange`.

When open, save `document.activeElement`, focus the first focusable element, close on Escape, prevent background scroll, and restore focus on close. `Drawer` and `BottomSheet` reuse the same behavior but differ in responsive placement. `Tooltip` is supplementary and must not contain required actions. `DropdownMenu` opens from a semantic button and closes on outside click or Escape.

- [ ] **Step 5: Export, typecheck and test**

Append exports for all four files to `src/shared/ui/index.ts`.

Run:

```powershell
npm run lint
npm run typecheck
npm run test:e2e -- --project=desktop tests/ui-kit.spec.ts
```

Expected: lint and typecheck PASS; the route-level test remains red until Task 5.

- [ ] **Step 6: Commit**

```powershell
git add src/shared/ui tests/ui-kit.spec.ts
git commit -m "feat: add interactive Pilot UI primitives"
```

---

### Task 4: Build the Responsive Application Shell

**Files:**

- Create: `src/shared/components/app-shell/AppShell.tsx`
- Create: `src/shared/components/app-shell/Header.tsx`
- Create: `src/shared/components/app-shell/Sidebar.tsx`
- Create: `src/shared/components/app-shell/MobileNavigation.tsx`
- Modify: `src/shared/layouts/AppLayout.tsx`
- Test: `tests/dashboard.spec.ts`

**Interfaces:**

- Produces `AppShell({ children, breadcrumbs = [] })`; breadcrumbs are optional so the compatibility alias remains valid.
- Sidebar navigation contains a real `/ui-kit` link named `Дизайн-система`.

- [ ] **Step 1: Write failing responsive shell tests**

Create `tests/dashboard.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('desktop shell exposes persistent navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Дизайн-система' })).toBeVisible();
});

test('mobile shell uses a drawer without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Открыть меню' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
```

Run and expect FAIL.

- [ ] **Step 2: Implement the navigation model**

Use one readonly navigation array:

```ts
export const navigation = [
  { label: 'Панель управления', href: '/', icon: FiHome },
  { label: 'Онлайн-карта', href: '/map', icon: FiMap },
  { label: 'Автомобили', href: '/vehicles', icon: FiTruck },
  { label: 'Устройства', href: '/devices', icon: FiCpu },
  { label: 'События', href: '/events', icon: FiAlertTriangle },
  { label: 'Дизайн-система', href: '/ui-kit', icon: FiLayers },
] as const;
```

Render each item as `next/link`, use pathname equality for `aria-current="page"`, and keep the same array in desktop and mobile navigation.

- [ ] **Step 3: Implement shell boundaries**

`AppShell` is a Server Component and accepts rendered `children`. Header interactivity is limited to client controls for drawer and theme. Desktop classes reserve `var(--sidebar-width)` and `var(--header-height)` rather than separate magic numbers. At widths below 768 px, hide the desktop sidebar and render `MobileNavigation`.

Reduce `AppLayout.tsx` to:

```tsx
export { AppShell as AppLayout } from '@/shared/components/app-shell/AppShell';
```

- [ ] **Step 4: Verify responsive behavior**

Run:

```powershell
npm run test:e2e -- --project=desktop tests/dashboard.spec.ts
npm run test:e2e -- --project=mobile tests/dashboard.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/components/app-shell src/shared/layouts tests/dashboard.spec.ts
git commit -m "feat: add responsive Pilot application shell"
```

---

### Task 5: Build the Executable UI Kit Route

**Files:**

- Create: `src/app/ui-kit/page.tsx`
- Create: `src/app/ui-kit/sections.tsx`
- Modify: `tests/ui-kit.spec.ts`

**Interfaces:**

- Produces a visible `/ui-kit` Server Component route.
- Every required component category has a landmark section and stable test ID.

- [ ] **Step 1: Expand the failing coverage test**

Add:

```ts
test('UI Kit presents all approved categories', async ({ page }) => {
  await page.goto('/ui-kit');
  for (const name of [
    'Foundations',
    'Actions',
    'Forms',
    'Data Display',
    'Navigation',
    'Feedback',
    'Overlays',
    'Fleet Components',
  ]) {
    await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
  }
});
```

Run and expect FAIL.

- [ ] **Step 2: Implement the Server Component catalog structure**

Create `page.tsx`:

```tsx
import { AppShell } from '@/shared/components/app-shell/AppShell';
import { UiKitSections } from './sections';

export const metadata = { title: 'Pilot+ UI Kit' };

export default function UiKitPage() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+', href: '/' }, { label: 'UI Kit' }]}>
      <header className="mb-8">
        <p className="text-sm font-semibold text-[var(--color-primary)]">Design system</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--color-text)]">Pilot+ UI Kit</h1>
        <p className="mt-3 max-w-2xl text-[var(--color-text-secondary)]">
          Компоненты, состояния и правила интерфейса Pilot+.
        </p>
      </header>
      <UiKitSections />
    </AppShell>
  );
}
```

- [ ] **Step 3: Render every category from shared primitives**

`sections.tsx` may be a Client Component only because it demonstrates live state. Define one reusable section wrapper:

```tsx
function KitSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-[var(--color-border)] py-10">
      <h2 className="text-2xl font-bold text-[var(--color-text)]">{title}</h2>
      <p className="mt-2 text-[var(--color-text-secondary)]">{description}</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}
```

Render the eight approved headings exactly as asserted by the test. Show all Button variants and sizes, `data-testid` values from Task 2, form labels from Task 3, alert tones, loading/empty/error states, overlay launchers, status indicators and vehicle primitives. Include concise `Когда использовать` and `Не использовать` copy per category.

- [ ] **Step 4: Verify route, themes and mobile overflow**

Run:

```powershell
npm run test:e2e -- tests/ui-kit.spec.ts
```

Expected: PASS in desktop and mobile projects.

- [ ] **Step 5: Commit**

```powershell
git add src/app/ui-kit tests/ui-kit.spec.ts
git commit -m "feat: add executable Pilot UI Kit"
```

---

### Task 6: Compose the Desktop Dashboard from Typed Fixtures

**Files:**

- Create: `src/modules/dashboard/types.ts`
- Create: `src/modules/dashboard/fixtures.ts`
- Create: `src/modules/dashboard/Dashboard.tsx`
- Create: `src/modules/dashboard/DashboardPanels.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/dashboard.spec.ts`

**Interfaces:**

- Produces `Vehicle`, `FleetStat`, and `FleetEvent` contracts.
- `Dashboard` consumes fixtures through props and does not import database code.

- [ ] **Step 1: Add failing desktop composition assertions**

Append:

```ts
test('desktop dashboard prioritizes the fleet map', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Центр управления транспортом' })).toBeVisible();
  await expect(page.getByTestId('fleet-map-workspace')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Состояние парка' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Последние события' })).toBeVisible();
});
```

Run and expect FAIL.

- [ ] **Step 2: Define domain-shaped UI types and fixtures**

Create `types.ts`:

```ts
export type VehicleStatus = 'moving' | 'idle' | 'offline' | 'alarm';

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  speedKph: number;
  status: VehicleStatus;
  longitude: number;
  latitude: number;
  lastSeenLabel: string;
  fuelPercent: number;
  mileageKm: number;
}

export interface FleetStat {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: 'primary' | 'success' | 'warning' | 'danger';
}

export interface FleetEvent {
  id: string;
  title: string;
  vehicleName: string;
  timeLabel: string;
  tone: 'info' | 'warning' | 'danger';
}
```

Create `fixtures.ts` with four stats, three events and three vehicles matching the existing demo names and coordinates. Export readonly `fleetStats`, `fleetEvents`, and `vehicles` using `satisfies readonly ...[]`.

- [ ] **Step 3: Build product compositions only from UI Kit exports**

`DashboardPanels.tsx` exports `FleetStatCard`, `FleetEvents`, `FleetStatusPanel`, `StatusIndicator`, and `VehicleSummary`. `StatusIndicator` maps `VehicleStatus` to semantic badge tones and accessible Russian labels. `VehicleSummary` accepts `{ vehicle?: Vehicle }` and renders a compact `EmptyState` when no vehicle is available. Each composition uses `Card`, `Badge`, `IconButton` and token classes from `@/shared/ui`. No component contains raw color literals.

`Dashboard.tsx` accepts:

```ts
interface DashboardProps {
  stats: readonly FleetStat[];
  events: readonly FleetEvent[];
  vehicles: readonly Vehicle[];
}
```

Use a four/two/one KPI grid and a desktop workspace grid where the map column is at least twice the status column width.

- [ ] **Step 4: Make the route a Server Component**

Replace `src/app/page.tsx` with:

```tsx
import { Dashboard } from '@/modules/dashboard/Dashboard';
import { fleetEvents, fleetStats, vehicles } from '@/modules/dashboard/fixtures';
import { AppShell } from '@/shared/components/app-shell/AppShell';

export default function Home() {
  return (
    <AppShell breadcrumbs={[{ label: 'Pilot+' }, { label: 'Панель управления' }]}>
      <Dashboard stats={fleetStats} events={fleetEvents} vehicles={vehicles} />
    </AppShell>
  );
}
```

- [ ] **Step 5: Test and commit**

Run `npm run test:e2e -- --project=desktop tests/dashboard.spec.ts`, `npm run typecheck`, and `npm run lint`.

Expected: PASS.

```powershell
git add src/app/page.tsx src/modules/dashboard tests/dashboard.spec.ts
git commit -m "feat: compose Pilot fleet dashboard"
```

---

### Task 7: Implement the Dynamic Desktop Map and Full-Screen Mobile Workspace

**Files:**

- Create: `src/modules/dashboard/FleetMapClient.tsx`
- Create: `src/modules/dashboard/FleetMap.tsx`
- Create: `src/modules/dashboard/MobileFleetWorkspace.tsx`
- Modify: `src/modules/dashboard/Dashboard.tsx`
- Test: `tests/dashboard.spec.ts`

**Interfaces:**

- `FleetMapClient({ vehicles, mode })`, where `mode` is `"desktop" | "mobile"`.
- `FleetMap({ vehicles, mode })` owns MapLibre and selected vehicle state.
- `MobileFleetWorkspace` composes floating search, chips, controls and bottom sheet and owns `query`, `activeFilter`, and `selectedVehicle` client state.

- [ ] **Step 1: Add failing mobile map tests**

Append:

```ts
test('mobile dashboard is a full-screen map workspace', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const workspace = page.getByTestId('mobile-map-workspace');
  await expect(workspace).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Поиск транспорта' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Все автомобили' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('vehicle-bottom-sheet')).toBeVisible();
  const box = await workspace.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(600);
});
```

Run mobile tests and expect FAIL.

- [ ] **Step 2: Create the client-only dynamic boundary**

Create `FleetMapClient.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import type { Vehicle } from './types';

const FleetMap = dynamic(() => import('./FleetMap').then((module) => module.FleetMap), {
  ssr: false,
  loading: () => (
    <div
      className="h-full min-h-96 animate-pulse bg-[var(--color-primary-soft)]"
      aria-label="Карта загружается"
    />
  ),
});

export function FleetMapClient({
  vehicles,
  mode,
}: {
  vehicles: readonly Vehicle[];
  mode: 'desktop' | 'mobile';
}) {
  return <FleetMap vehicles={vehicles} mode={mode} />;
}
```

- [ ] **Step 3: Refactor MapLibre with typed markers and required states**

`FleetMap.tsx` is a Client Component. Use `Root[]`, `Vehicle | null`, a typed marker collection, and cleanup that unmounts every React root before `map.remove()`. Keep attribution visible. Add `map.on("error")` to expose an `ErrorState` overlay with retry that reconstructs the map. Render an `EmptyState` when `vehicles.length === 0`.

Use status-to-token mapping:

```ts
const statusColor: Record<VehicleStatus, string> = {
  moving: 'var(--color-primary)',
  idle: 'var(--color-warning)',
  offline: 'var(--color-text-secondary)',
  alarm: 'var(--color-danger)',
};
```

- [ ] **Step 4: Implement the approved mobile composition**

`MobileFleetWorkspace` is a Client Component. Initialize `selectedVehicle` from `vehicles[0]`, synchronize it when the fixture list changes, filter vehicles from `query` and `activeFilter`, and pass a typed `onVehicleSelect` callback through `FleetMapClient` to `FleetMap`. It renders this structure (with the shown state bindings rather than hard-coded selection):

```tsx
<section
  data-testid="mobile-map-workspace"
  className="relative h-[calc(100dvh-var(--header-height))] min-h-[620px] overflow-hidden md:hidden"
>
  <FleetMapClient vehicles={vehicles} mode="mobile" />
  <SearchInput aria-label="Поиск транспорта" className="absolute top-4 right-4 left-4 z-20" />
  <div className="absolute top-16 right-4 left-4 z-20 flex gap-2 overflow-x-auto py-2">
    <FilterChip selected>Все автомобили</FilterChip>
    <FilterChip>В движении</FilterChip>
    <FilterChip>Тревоги</FilterChip>
  </div>
  <BottomSheet data-testid="vehicle-bottom-sheet" snap="collapsed" title="Выбранный автомобиль">
    <VehicleSummary vehicle={selectedVehicle ?? vehicles[0]} />
  </BottomSheet>
</section>
```

The sheet exposes collapsed, intermediate and expanded buttons/drag affordances, never traps the map while collapsed, and keeps its close/expand controls at least 44 px.

- [ ] **Step 5: Keep the desktop map dominant**

In `Dashboard.tsx`, hide the desktop dashboard composition below `md`, render `MobileFleetWorkspace`, and set the desktop map container to `min-h-[560px]` with `data-testid="fleet-map-workspace"`.

- [ ] **Step 6: Verify both viewports and commit**

Run:

```powershell
npm run test:e2e -- tests/dashboard.spec.ts
npm run lint
npm run typecheck
npm run build
```

Expected: all commands PASS.

```powershell
git add src/modules/dashboard tests/dashboard.spec.ts
git commit -m "feat: make fleet map the primary mobile workspace"
```

---

### Task 8: Complete Visual, Accessibility and Delivery Verification

**Files:**

- Modify: `tests/ui-kit.spec.ts`
- Modify: `tests/dashboard.spec.ts`
- Modify: `README.md`
- Modify: `docs/PROJECT_GUIDE.md`
- Remove or re-export: obsolete duplicate components under `src/shared/components/header`, `sidebar`, `dashboard`, and `map`.

**Interfaces:**

- Produces a documented and green delivery branch.
- Leaves one implementation per UI and product component.

- [ ] **Step 1: Add final responsive, dark-mode and reduced-motion tests**

Add:

```ts
for (const viewport of [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 1000 },
]) {
  test(`routes have no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const route of ['/', '/ui-kit']) {
      await page.goto(route);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(overflow).toBe(false);
    }
  });
}

test('reduced motion disables routine transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ui-kit');
  const duration = await page
    .getByTestId('button-primary')
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(['0s', '0.00001s']).toContain(duration);
});
```

- [ ] **Step 2: Remove duplicate implementations**

Use `rg` to find imports of old `Header`, `Sidebar`, `StatCard`, `FleetMap`, `VehicleMarker` and `VehiclePanel`. Either delete unused files or replace them with explicit compatibility re-exports. Do not keep two editable implementations of the same component.

- [ ] **Step 3: Update documentation with actual routes and commands**

Document `/ui-kit`, `npm run typecheck`, `npm run format:check`, `npm run test:e2e`, the responsive map behavior, and the semantic-token rule. State that fixtures remain demo data.

- [ ] **Step 4: Run the full delivery gate**

Run:

```powershell
npm run lint
npm run typecheck
npm run format:check
npm run test:e2e
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 5: Manually inspect visual acceptance**

Open `/` and `/ui-kit` at 375, 768, 1024 and 1440 px. Confirm light and dark theme contrast, keyboard focus, Escape behavior, map dominance, OSM attribution, sheet controls, and absence of emoji structural icons. Record any defect as a failing Playwright assertion before fixing it.

- [ ] **Step 6: Commit**

```powershell
git add README.md docs src tests
git commit -m "chore: verify and document Pilot design system"
```

---

## Completion Gate

The implementation is complete only when:

1. All eight tasks have independent commits.
2. `/ui-kit` is visible in navigation and demonstrates every approved category.
3. `/` uses the Pilot Operations design and shared primitives.
4. Mobile `/` is a full-screen map workspace with floating controls and a bottom sheet.
5. Desktop `/` keeps the map as the largest content region.
6. Light/dark themes persist without a visible flash.
7. All automated delivery commands exit 0.
8. A draft pull request targets `develop` and lists any remaining product-level decisions without merging automatically.
