# Pilot+ Design System and Map-First Dashboard

## Status

Approved by Pavel Sedov on 2026-07-15.

## Objective

Create a reusable Pilot+ design system, a public internal UI Kit page, and a redesigned fleet dashboard inspired by the clarity and rhythm of the MUI Minimal Dashboard preview without copying its brand, assets, or implementation.

The map is the primary product surface. All application pages must consume shared tokens and UI components so visual decisions remain consistent as Pilot+ grows.

## Product Direction

The approved visual direction is **Pilot Operations**:

- dark branded navigation;
- light primary workspace;
- teal-blue operational accent;
- soft surfaces with restrained elevation;
- dense but scannable fleet data;
- semantic success, warning, and danger colors;
- Inter typography;
- one consistent Feather icon family;
- light and dark themes designed together.

The reference is used for design quality and composition only. Pilot+ retains its own identity and fleet-specific interaction model.

## Information Architecture

### Routes

- `/` — map-first fleet dashboard.
- `/ui-kit` — visible design-system catalog linked from the sidebar during development.

Future product routes will reuse the same application shell and UI primitives.

### Source Boundaries

```text
src/
├── app/
│   ├── page.tsx
│   └── ui-kit/page.tsx
├── theme/
│   └── tokens/
├── shared/
│   ├── ui/
│   └── components/
└── modules/
    └── dashboard/
```

- `theme/tokens` owns semantic colors, typography, spacing, radii, shadows, icon sizes, z-index, and motion values.
- `shared/ui` owns reusable primitives with stable typed APIs.
- `shared/components` owns reusable product-level compositions.
- `modules/dashboard` owns dashboard fixtures and page-specific composition when the module is introduced.
- Routes compose modules and do not define ad hoc visual primitives.

## Design Tokens

Components consume semantic CSS variables instead of raw hex values.

Required token groups:

- surfaces: canvas, surface, elevated, navigation, overlay;
- text: primary, secondary, muted, inverse;
- actions: primary, primary-hover, primary-pressed, focus-ring;
- statuses: success, warning, danger, info and their soft backgrounds;
- borders: subtle, default, strong;
- spacing: 4, 8, 12, 16, 24, 32, 48, 64 px;
- radii: small, medium, large, panel, round;
- elevation: none, card, floating, modal;
- motion: fast, normal, slow with enter and exit easing;
- layout: sidebar width, header height, content gutters and desktop max width;
- icons: small, medium and large.

Light and dark themes map the same semantic names to different accessible values. Theme changes must not alter component APIs.
The selected theme is persisted locally and restored before the interface becomes visible to avoid a light/dark flash.

## UI Component Catalog

### Foundations

- color roles in light and dark themes;
- typography scale and weights;
- spacing and radius scales;
- elevation levels;
- icon sizes and stroke rules.

### Actions

- `Button`: primary, secondary, soft, outline, ghost and danger;
- sizes: xs, sm, md and lg;
- loading, disabled, hover, pressed and focus-visible states;
- `IconButton`: square, rounded, circular, notification and floating variants.

### Forms

- Input;
- SearchInput;
- Textarea;
- Select;
- Checkbox;
- Radio;
- Switch;
- SegmentedControl.

All form controls have visible labels where applicable, helper and error text, semantic disabled behavior, and a minimum 44 px interactive height for touch usage.

### Data Display

- Card and CardHeader;
- StatCard;
- Badge;
- StatusIndicator;
- Avatar;
- ListItem;
- Table primitives;
- VehiclePlate.

### Navigation

- Breadcrumbs;
- SidebarItem;
- Tabs;
- Pagination;
- DropdownMenu;
- mobile FilterChip.

### Feedback

- Alert;
- Toast;
- Progress;
- Spinner;
- Skeleton;
- EmptyState;
- ErrorState.

### Overlays

- Tooltip;
- Popover;
- Modal;
- ConfirmationDialog;
- Drawer;
- BottomSheet.

### Fleet Components

- VehicleMarker;
- VehicleSummary;
- SpeedIndicator;
- ConnectionStatus;
- EventItem.

Each UI Kit section shows variants, sizes, states, usage guidance, and anti-patterns. The UI Kit is the executable source of truth, not a disconnected mockup.

## Application Shell

### Desktop

- 272 px dark sidebar with Pilot+ brand, grouped navigation and profile footer;
- sticky light header with breadcrumbs, global search, notifications, theme control and profile;
- responsive main content container;
- persistent navigation placement across routes.

### Tablet

- sidebar may collapse to an icon rail;
- content retains readable gutters;
- dashboard panels reflow without horizontal scrolling.

### Mobile

- sidebar becomes a drawer;
- header becomes compact;
- core navigation remains reachable without covering the map;
- fixed elements reserve safe space for content and device controls.

## Dashboard Composition

### Desktop and Tablet

1. Breadcrumbs and page heading.
2. Four KPI cards with icon, metric, trend and restrained visual accent.
3. Primary fleet workspace with the map as the largest region.
4. Fleet status panel adjacent to the map when width allows.
5. Recent events, vehicle activity and quick actions below the map.

Responsive grid progression is 4, 2 and 1 columns. The map remains visually dominant at every breakpoint.

### Mobile Map-First Experience

The approved mobile composition is a full-screen operational map rather than a map card inside a scrolling dashboard.

- MapLibre fills the available viewport below the compact system header.
- Search floats above the map.
- Filter chips float below search.
- Map controls remain reachable with one hand and avoid screen edges.
- Selected vehicle details appear in a draggable bottom sheet.
- The sheet has collapsed, intermediate and expanded states.
- KPI summaries and events live inside the expanded sheet or linked secondary views.
- The map remains usable while the sheet is collapsed.
- No bottom navigation or panel may permanently reduce the main map viewport without a clear product need.

## Map States

The map must provide explicit presentation for:

- initial loading;
- tile or network error with retry;
- empty fleet;
- filtered result with no matching vehicles;
- selected vehicle;
- clustered or overlapping vehicles;
- reduced connectivity.

Public OSM attribution must remain visible and compliant. Heavy map code should be dynamically loaded in Next.js.

## Data Boundaries

This phase uses typed demo fixtures. Fixtures are stored separately from components and reflect the future domain shape without creating backend contracts prematurely.

Components accept typed data through props. They do not import demo records directly and do not contain `any` types.

Real MQTT telemetry, authentication, API integration and persistent product state are outside this design-system phase.

## Interaction and Accessibility

- All interactive controls use semantic links, buttons or form elements.
- Icon-only actions include accessible names.
- Keyboard order follows visual order.
- Focus indicators are visible in both themes.
- Overlays trap focus when appropriate and restore it to the trigger when closed.
- Escape closes dismissible overlays.
- Color is never the only status indicator.
- Text contrast targets WCAG AA.
- Touch targets are at least 44 by 44 px.
- Motion lasts 150–250 ms for routine interactions.
- Exits are faster than entrances.
- `prefers-reduced-motion` disables non-essential movement.
- Loading, disabled, empty, success and error states are visually and semantically distinct.

## Rendering Strategy

- Server Components remain the default.
- Client Components are limited to interactive islands such as theme controls, overlays and MapLibre.
- MapLibre is dynamically imported.
- Static page content and UI Kit documentation do not require client rendering.
- Inter is loaded through `next/font`.

## Verification

### Automated

- ESLint;
- TypeScript strict checking;
- production build;
- Playwright smoke coverage for `/` and `/ui-kit`;
- keyboard-open and keyboard-close checks for key overlays where practical.

### Visual

- widths: 375, 768, 1024 and 1440 px;
- mobile portrait and landscape;
- light and dark themes independently;
- reduced motion;
- no horizontal page scroll;
- no content hidden by fixed navigation or sheets;
- mobile map remains the dominant surface;
- all UI Kit variants render without layout shift.

## Acceptance Criteria

- `/ui-kit` is visible from the application navigation.
- The UI Kit exposes the specified component categories and states.
- `/` is redesigned with the approved Pilot Operations direction.
- Dashboard pages use shared UI primitives and semantic tokens instead of ad hoc styles.
- Desktop, tablet and mobile layouts are usable at the required widths.
- Mobile `/` uses the approved full-screen map composition.
- Theme switching works consistently across the shell, UI Kit and dashboard.
- The selected theme is restored on the next browser visit without a visible theme flash.
- No emoji is used as a structural interface icon.
- No new `any` types are introduced.
- Relevant automated checks pass before delivery.

## Out of Scope

- real telemetry ingestion;
- production authentication and authorization;
- persistent user theme preferences on the server;
- real analytics and reports;
- production notification delivery;
- final backend API contracts;
- exact replication of the commercial MUI template.
