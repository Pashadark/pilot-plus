# SUPA PRO Obsidian: dual-theme product redesign

Date: 2026-09-10  
Status: proposed for implementation  
Owner: Pavel Sedov  
Scope: the authenticated SUPA PRO fleet-management product

## Decision

Add a new interface family named **Obsidian** and preserve the current interface as **Classic** until Pavel makes the final choice. Obsidian ships in two color schemes:

- **Obsidian Dark** — the primary visual direction, based on the selected dark Pinterest reference;
- **Obsidian Light** — a first-class white theme, not an inverted afterthought.

The color-scheme switch is always available in the top bar. The Classic/Obsidian selector lives in the profile menu so the daily header remains clean. The choice is stored locally and applied before hydration to prevent a flash or React hydration mismatch.

## Reference interpretation

Two references define the direction rather than being copied literally:

1. The selected finance UI reference supplies the graphite canvas, icy-blue accent surfaces, large soft radii, quiet borders, layered depth, compact iconography and strong numeric hierarchy.
2. The selected navigation reference supplies the floating rounded sidebar, expanded and compact states, calm active-row treatment, grouped navigation and the profile control anchored at the bottom.

SUPA PRO remains an operations product: information density, Russian labels, status visibility and fast task completion take priority over decorative composition.

## Product goals

- Make the product feel coherent, premium and current without changing business behaviour.
- Let an operator understand fleet state, exceptions and next action in one scan.
- Give Dark and Light equal visual quality and contrast.
- Reduce visual noise while preserving the density required by a fleet dispatcher.
- Keep every existing route and workflow working during the redesign.
- Make desktop and mobile feel deliberately designed rather than responsively compressed.

## Non-goals

- No duplicate page implementations or duplicated business logic.
- No backend, database or workflow rewrite as part of the visual foundation.
- No forced removal of Classic before the new interface is accepted.
- No decorative gradients, excessive glass blur, glowing borders, bouncing cards or animation on every element.
- No new icon language: continue with the existing SVG/Lucide-style icon system.

## Experience architecture

### Interface and color state

Two independent preferences are represented on `<html>`:

- `data-interface="classic|obsidian"`
- `data-theme="light|dark"`

Storage keys:

- `pilot-interface`
- existing `pilot-theme`

The provider reads preferences through a tiny inline bootstrap before React hydrates. Server-rendered markup uses a stable fallback and suppresses only the expected root attribute difference. This directly avoids the previously seen minified React hydration error.

### New app shell

Desktop layout:

- 16 px outer gutter around the application shell;
- floating sidebar, 240 px expanded and 72 px compact;
- 20–24 px sidebar radius with one quiet border and restrained shadow;
- 64 px top bar aligned to the content grid, not spanning under the sidebar;
- main canvas fills the remaining width and uses consistent 24 px page gutters;
- content width remains fluid for operational tables.

Sidebar structure:

- SUPA PRO mark at the top;
- primary operations: Command center, Map, Fleet, Clients, Rentals;
- secondary operations: Fines, Maintenance, Wash, Devices, Events;
- administration: Administration, System status;
- profile row fixed to the bottom;
- active item uses a tinted rounded row and a clear 3 px side marker;
- notification counts use compact numeric badges;
- collapse control remains visible and keyboard accessible;
- labels fade while the sidebar width changes, avoiding text reflow flashes.

Top bar:

- current page title/breadcrumb context on the left;
- global search in the centre on wide screens;
- quick create, notifications, Light/Dark switch and avatar on the right;
- a two-position Sun/Moon switch shows both current state and available action;
- Classic/Obsidian selection is inside the avatar menu, with a visible check state;
- on mobile, search becomes an icon-triggered overlay and navigation becomes a bottom sheet.

### Mobile navigation

- top bar height 56 px;
- no permanently visible left rail;
- a menu button opens a full-height sheet with the same grouped information architecture;
- primary daily destinations may appear in a compact bottom dock, limited to four items plus “More”;
- all controls have at least a 44×44 px touch target;
- tables retain their information hierarchy through stacked rows, not horizontal squeezing.

## Visual system

### Obsidian Dark tokens

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#0B0D10` | page background |
| Sidebar | `#101318` | navigation shell |
| Surface | `#15191F` | cards and tables |
| Elevated | `#1B2028` | popovers and selected areas |
| Border | `#2A313A` | quiet separation |
| Text | `#F5F7FA` | primary content |
| Muted text | `#98A2B3` | labels and metadata |
| Primary | `#4D7CFF` | actions and selection |
| Ice | `#DDF2FF` | signature highlight surface |
| Ice text | `#10233D` | text on Ice |
| Success | `#36C789` | available/healthy |
| Warning | `#F4B860` | due soon/attention |
| Danger | `#F06464` | overdue/destructive |

### Obsidian Light tokens

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#F2F5F8` | page background |
| Sidebar | `#FFFFFF` | navigation shell |
| Surface | `#FFFFFF` | cards and tables |
| Elevated | `#F7F9FB` | selected areas |
| Border | `#DCE3EA` | quiet separation |
| Text | `#12161C` | primary content |
| Muted text | `#667085` | labels and metadata |
| Primary | `#2F66F6` | actions and selection |
| Ice | `#E2F3FF` | signature highlight surface |
| Ice text | `#10233D` | text on Ice |
| Success | `#168A58` | available/healthy |
| Warning | `#B56B16` | due soon/attention |
| Danger | `#C93C3C` | overdue/destructive |

Status colors are always paired with text or an icon. Color is never the only carrier of meaning.

### Shape and depth

- page-level panels: 20 px radius;
- cards and table containers: 16 px radius;
- inputs and primary controls: 12 px radius;
- pills only for statuses and compact segmented controls;
- one border plus one subtle shadow for floating shell surfaces;
- inset separators inside dense panels instead of nested card stacks;
- no hover translation on vehicle cards or tables.

### Typography

Use the existing locally delivered UI font if it satisfies Cyrillic coverage; otherwise use Inter Variable through the framework font loader with a system fallback. Do not add a second display face.

- body/UI: 16 px desktop and 16–17 px mobile;
- compact metadata: 13 px minimum;
- table body: 14 px with 1.35–1.45 line height;
- section titles: 18–20 px / 650;
- page title: fluid 28–36 px / 680;
- operational numbers use tabular figures;
- hierarchy changes one or two properties at a time, never size, weight and color together.

## Component behaviour

### Buttons and controls

- direct press feedback begins within 100 ms;
- hover/focus transition: 160 ms;
- state changes and sidebar expansion: 200–220 ms using an ease-out curve;
- loading is shown inside the initiating control where possible;
- disabled state explains why through nearby copy or a tooltip;
- destructive actions remain clearly red and require the existing confirmation rules.

### Cards

- image and primary identity form one visual block;
- operational state and next action are above secondary specifications;
- cards do not jump or zoom on hover;
- only shadow/border tone changes on hover;
- vehicle, rental and client cards share spacing and status grammar but keep domain-specific information.

### Tables

- sticky column header on long lists;
- consistent 48–56 px row height;
- left status rail when status is a primary scan dimension;
- numbers align right or centrally only where comparison benefits;
- row actions appear on focus/hover but remain available through a persistent overflow menu;
- selected, overdue and error states remain distinguishable in both themes and at 200% zoom.

### Feedback

- small successful changes use inline confirmation, not a global toast;
- global toasts are reserved for saved cross-page results, errors and background operations;
- operations longer than 600 ms expose honest progress or a labelled indeterminate state;
- reduced-motion users receive immediate state swaps without spatial animation.

Signature moment: the shell theme switch softly changes the canvas and surfaces in a coordinated 180 ms transition while the control thumb moves. It never blocks input and is disabled under `prefers-reduced-motion`.

## Rollout sequence

### Phase 1 — safe foundation

- extend theme provider with independent interface preference;
- add Obsidian token layers without replacing Classic variables;
- build the floating responsive shell, top controls and mobile navigation;
- add a feature-safe selector to return instantly to Classic;
- cover hydration, persistence and keyboard navigation with tests.

### Phase 2 — core daily work

- Command center;
- Fleet and vehicle detail;
- Rentals list/detail/create/return;
- Clients list/detail/edit.

Shared tables, cards, status chips, filters and empty/loading/error states are migrated before page-specific decoration.

### Phase 3 — operational completion

- Map;
- Fines;
- Maintenance and Wash;
- Devices and Events;
- Profile, Administration and System status;
- UI kit updated as the canonical component reference.

### Phase 4 — acceptance and removal decision

- visual regression at 375, 768, 1024 and 1440 px;
- keyboard and 200% zoom checks;
- contrast verification in both schemes;
- production smoke test of critical client-to-contract and rental-return flows;
- Pavel chooses whether Classic remains available or is removed.

## Acceptance criteria

1. A user can switch Light/Dark from the top bar and the choice survives refresh without a flash.
2. A user can switch Classic/Obsidian from the profile menu and return safely at any time.
3. The sidebar has expanded and compact states matching the selected navigation reference’s structure.
4. Every route remains reachable in both sidebar states and on mobile.
5. Existing business actions, permissions and URLs are unchanged.
6. No vehicle card or table row translates or scales on hover.
7. Both color schemes pass WCAG AA for normal text and visible keyboard focus.
8. The interface works at 200% zoom and at 375 px without clipped primary actions.
9. `prefers-reduced-motion` removes spatial transitions.
10. Tests cover preference persistence, hydration safety, shell navigation and theme controls before rollout to the production server.

## Design quality gates

- Visual craft: no accidental nested cards, inconsistent radii, arbitrary colors or one-off shadows.
- Operational clarity: overdue and blocking states outrank decorative metrics.
- Typography: real Russian content is tested, numbers use tabular figures, no text below 13 px.
- Microinteractions target score: 8/8 diagnostic rows (10/10).
- Typography target score: 10/10 diagnostic rows.
- Performance: no animation framework is added for shell transitions; CSS handles the foundation.
- Safety: Classic remains untouched until the Obsidian implementation passes production smoke tests.
