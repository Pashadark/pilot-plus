# SUPA PRO Obsidian Shell Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a safe, test-covered Obsidian shell with independent Classic/Obsidian and Light/Dark preferences, the approved floating collapsible sidebar, and a top theme switch without changing application routes or business logic.

**Architecture:** Extend the existing root theme provider into a two-axis appearance provider that owns `data-theme` and `data-interface`. Keep the authenticated layout and all server components intact; only the shell, navigation, and appearance controls stay client-side. Apply Obsidian globally through CSS token overrides so every existing page gets a coherent first pass while Classic remains unchanged and instantly recoverable.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript 5, Tailwind CSS 4, Vitest, Testing Library, existing `react-icons` package.

## Global Constraints

- Preserve every existing route, permission check, business action, and URL.
- Keep `data-theme="light|dark"` and add `data-interface="classic|obsidian"` as independent preferences.
- Keep the existing `pilot-theme` key and add `pilot-interface`.
- Default to Obsidian for first-time users while retaining a visible route back to Classic.
- No new runtime dependencies or animation framework for the shell.
- No decorative gradients, glowing borders, bouncing cards, or card translation/scale on hover.
- Respect `prefers-reduced-motion`, 44 px touch targets, keyboard focus, and WCAG AA contrast.
- Do not overwrite unrelated changes in the dirty worktree.

---

## File map

- `src/shared/providers/ThemeProvider.tsx`: appearance state, persistence, DOM synchronization, hooks.
- `src/shared/providers/ThemeProvider.test.tsx`: independent theme/interface behaviour and persistence.
- `src/app/layout.tsx`: pre-hydration bootstrap for both appearance axes.
- `src/app/globals.css`: Classic compatibility plus Obsidian Light/Dark tokens and shell primitives.
- `src/shared/components/app-shell/AppearanceControls.tsx`: accessible theme switch and interface selector.
- `src/shared/components/app-shell/Header.tsx`: top-bar composition and appearance controls.
- `src/shared/components/app-shell/Sidebar.tsx`: floating grouped navigation and compact state.
- `src/shared/components/app-shell/ShellFrame.tsx`: Obsidian shell geometry and responsive offsets.
- `src/shared/components/app-shell/MobileNavigation.tsx`: mobile sheet styling consistent with Obsidian.
- `src/shared/components/app-shell/Header.test.tsx`: visible theme switch and interface menu behaviour.
- `src/shared/components/app-shell/Sidebar.test.ts`: active marker and navigation semantics.
- `src/shared/components/app-shell/ShellFrame.test.tsx`: shell state and CSS-variable geometry.

---

### Task 1: Add the independent appearance model

**Files:**
- Modify: `src/shared/providers/ThemeProvider.tsx`
- Create: `src/shared/providers/ThemeProvider.test.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: `Theme = 'light' | 'dark'`
- Produces: `InterfaceMode = 'classic' | 'obsidian'`
- Produces: `useTheme(): { theme, interfaceMode, setTheme, toggleTheme, setInterfaceMode }`

- [ ] **Step 1: Write the failing provider tests**

```tsx
it('stores theme and interface independently', async () => {
  render(<ThemeProvider><AppearanceProbe /></ThemeProvider>);
  await user.click(screen.getByRole('button', { name: 'dark' }));
  await user.click(screen.getByRole('button', { name: 'classic' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.dataset.interface).toBe('classic');
  expect(localStorage.getItem('pilot-theme')).toBe('dark');
  expect(localStorage.getItem('pilot-interface')).toBe('classic');
});
```

- [ ] **Step 2: Run the provider test and verify RED**

Run: `npx vitest run src/shared/providers/ThemeProvider.test.tsx`  
Expected: FAIL because `interfaceMode` and `setInterfaceMode` do not exist.

- [ ] **Step 3: Implement the minimal appearance store**

Use one custom window event (`pilot-appearance-storage`) and one `useSyncExternalStore` snapshot returning the serialized pair `theme:interface`. `persistTheme` updates only `data-theme`; `persistInterface` updates only `data-interface`; both persist their own keys and dispatch the shared event. Server snapshot is `light:obsidian`.

- [ ] **Step 4: Add the pre-paint bootstrap**

Update the root initializer to validate both storage values and set:

```ts
document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.interface = savedInterface === 'classic' ? 'classic' : 'obsidian';
```

Keep `suppressHydrationWarning` on `<html>` as required by the installed Next.js 16 guide.

- [ ] **Step 5: Run provider tests and verify GREEN**

Run: `npx vitest run src/shared/providers/ThemeProvider.test.tsx`  
Expected: PASS.

### Task 2: Establish Obsidian Light/Dark tokens

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: root `data-interface` and `data-theme` attributes from Task 1.
- Produces: the existing `--color-*`, `--radius-*`, `--shadow-*`, `--sidebar-*`, and `--header-*` variables for Obsidian.

- [ ] **Step 1: Add a failing static token test**

Extend the provider test file with a source assertion that requires selectors for both `[data-interface='obsidian'][data-theme='light']` and `[data-interface='obsidian'][data-theme='dark']`, plus `--color-ice` and `--shell-gutter`.

- [ ] **Step 2: Run the token test and verify RED**

Run: `npx vitest run src/shared/providers/ThemeProvider.test.tsx`  
Expected: FAIL because Obsidian selectors are absent.

- [ ] **Step 3: Add the complete token layers**

Add Obsidian Light values (`#F2F5F8`, `#FFFFFF`, `#12161C`, `#2F66F6`, `#E2F3FF`) and Obsidian Dark values (`#0B0D10`, `#15191F`, `#F5F7FA`, `#4D7CFF`, `#DDF2FF`) from the approved spec. Set 16 px card radius, 22 px panel radius, 16 px shell gutter, 240/72 px sidebar widths, and restrained offset shadows.

- [ ] **Step 4: Add global craft primitives**

Theme selection, caret, scrollbar, focus ring, tabular figures, body transition and reduced-motion. Obsidian links and controls must inherit foreground correctly; do not change Classic selectors.

- [ ] **Step 5: Run token tests and verify GREEN**

Run: `npx vitest run src/shared/providers/ThemeProvider.test.tsx`  
Expected: PASS.

### Task 3: Build and test the appearance controls

**Files:**
- Create: `src/shared/components/app-shell/AppearanceControls.tsx`
- Create: `src/shared/components/app-shell/AppearanceControls.test.tsx`
- Modify: `src/shared/components/app-shell/Header.tsx`
- Modify: `src/shared/components/app-shell/Header.test.tsx`

**Interfaces:**
- Consumes: `useTheme()` from Task 1.
- Produces: `ThemeSwitch` and `InterfaceModeMenuItems` components.

- [ ] **Step 1: Write failing interaction tests**

Assert that the top switch has `role="switch"`, an accessible Light/Dark label, `aria-checked`, and changes `data-theme`. Assert that profile menu options “Интерфейс Obsidian” and “Классический интерфейс” change `data-interface` and expose `aria-checked`.

- [ ] **Step 2: Run the control tests and verify RED**

Run: `npx vitest run src/shared/components/app-shell/AppearanceControls.test.tsx src/shared/components/app-shell/Header.test.tsx`  
Expected: FAIL because the components and menu options are absent.

- [ ] **Step 3: Implement `ThemeSwitch`**

Render a 64×36 px two-position switch with `FiSun` and `FiMoon`, a sliding thumb, visible focus, 180 ms transition, and no emoji. Keep the current theme visible and set `aria-checked={theme === 'dark'}`.

- [ ] **Step 4: Implement interface menu items**

Use two real `button` menuitems with `role="menuitemradio"`; show `FiCheck` only for the active mode and call `setInterfaceMode` directly on click.

- [ ] **Step 5: Recompose the header**

Show page context on the left, global search in the centre on wide screens, then quick-create, notifications, theme switch and avatar. Put interface selection below profile information. Preserve mobile menu, logout and notification behaviour.

- [ ] **Step 6: Run the control tests and verify GREEN**

Run: `npx vitest run src/shared/components/app-shell/AppearanceControls.test.tsx src/shared/components/app-shell/Header.test.tsx`  
Expected: PASS.

### Task 4: Rebuild the shell and sidebar without breaking routes

**Files:**
- Modify: `src/shared/components/app-shell/ShellFrame.tsx`
- Modify: `src/shared/components/app-shell/Sidebar.tsx`
- Modify: `src/shared/components/app-shell/MobileNavigation.tsx`
- Create: `src/shared/components/app-shell/ShellFrame.test.tsx`
- Modify: `src/shared/components/app-shell/Sidebar.test.ts`

**Interfaces:**
- Consumes: existing `navigation`, user capabilities and system health summary.
- Produces: desktop floating sidebar with expanded/compact state and mobile navigation sheet.

- [ ] **Step 1: Write failing shell tests**

Assert the desktop aside exposes `data-interface-shell="sidebar"`, the main content exposes `data-interface-shell="content"`, and the sidebar current link contains an `aria-hidden` active marker. Preserve every existing access-control assertion.

- [ ] **Step 2: Run shell tests and verify RED**

Run: `npx vitest run src/shared/components/app-shell/ShellFrame.test.tsx src/shared/components/app-shell/Sidebar.test.ts`  
Expected: FAIL because the new shell hooks and active marker are absent.

- [ ] **Step 3: Implement shell geometry**

Keep the existing persisted expanded state. In Obsidian, position the aside inside the 16 px shell gutter with rounded corners and offset header/main using `calc(var(--sidebar-width) + var(--shell-gutter) * 2)`. Keep Classic geometry through CSS selectors rather than duplicate JSX.

- [ ] **Step 4: Implement the approved navigation structure**

Group navigation into “Работа”, “Операции”, and “Система” while retaining the exact current item array and capability filtering. Add a 1 px active side marker, compact badges where available, a quiet system-health row, profile footer and accessible collapse button.

- [ ] **Step 5: Align mobile navigation**

Use a 22 px right-side sheet radius, explicit close control, same grouped labels, safe-area padding and minimum 44 px controls.

- [ ] **Step 6: Run shell tests and verify GREEN**

Run: `npx vitest run src/shared/components/app-shell/ShellFrame.test.tsx src/shared/components/app-shell/Sidebar.test.ts`  
Expected: PASS.

### Task 5: Verify the foundation and inspect it visually

**Files:**
- Review: every changed file from Tasks 1–4.
- Output: `.impeccable/review/desktop.png`
- Output: `.impeccable/review/mobile.png`

**Interfaces:**
- Consumes: completed appearance foundation.
- Produces: verified screenshots and a mechanical design report.

- [ ] **Step 1: Run focused unit tests**

Run: `npx vitest run src/shared/providers/ThemeProvider.test.tsx src/shared/components/app-shell/AppearanceControls.test.tsx src/shared/components/app-shell/Header.test.tsx src/shared/components/app-shell/Sidebar.test.ts src/shared/components/app-shell/ShellFrame.test.tsx`  
Expected: all PASS.

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck`  
Expected: exit 0.

Run: `npm run lint -- src/app/layout.tsx src/shared/providers/ThemeProvider.tsx src/shared/components/app-shell`  
Expected: exit 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`  
Expected: Next.js production build completes successfully.

- [ ] **Step 4: Capture valid desktop and mobile renders**

Use the existing authenticated Playwright setup against the local production build. Capture `/` at 1440 px and 375 px after fonts and layout settle, then open each image to confirm it is not blank, clipped or showing a login/error state.

- [ ] **Step 5: Run the one allowed mechanical design scan**

Run: `C:\Users\pasahdark\.codex\skills\impeccable\scripts\impeccable.cmd detect --json src/app/globals.css src/shared/providers/ThemeProvider.tsx src/shared/components/app-shell`  
Expected: no unresolved mechanical finding that conflicts with the approved direction.

- [ ] **Step 6: Commit only foundation files**

Stage only the plan and files listed in the file map; do not include unrelated working-tree changes. Commit message: `feat: add Obsidian dual-theme shell`.
