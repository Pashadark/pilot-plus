# Workday design QA — 2026-10-08

Reference: `C:/Users/pasahdark/.codex/generated_images/019f6750-4141-7fb0-906c-a92740c37323/exec-20a7469f-9e30-4e63-b502-9e2aff0d1420.png`.
Reference and production desktop screenshot were inspected together in one tool input.

## Results

- Preserved graphite shell, blue primary action, fleet summary, three event cards, occupancy calendar and financial/attention sidebar. Production uses actual data rather than the reference's illustrative events.
- Added the approved seven-day strip with paging arrows. Clicking 9 October changes the heading and events to the actual Camry return; details open the matching contract.
- 18 alpha PNGs cover 24 fleet records. All 36 light/dark previews loaded; originals and database photographs are unchanged.
- Light theme: promo cutouts remain readable, without opaque image backgrounds.
- Mobile issue found: implicit grid track inherited the calendar's 700px min-content width. Fixed with `grid-template-columns: minmax(0, 1fr)` on `.workday-main`.
- Mini-map issue found: MapLibre's unlayered `position: relative` overrode the Tailwind absolute utility, collapsing the container. Fixed with a scoped map container rule and explicit 100% height.
- Existing sidebar navigation retained to avoid removing working product routes. It is denser than the illustrative reference.

## Evidence

- `output/playwright/workday-production-desktop.png`
- `output/playwright/workday-production-light.png`
- `output/playwright/workday-production-mobile.png`
- `output/playwright/fleet-promo-gallery.png`

Final verification passed on release `/opt/pilot-plus/releases/20261008-workday-final`: mobile main width 348px and event card 306px in a 390px viewport; both primary actions visible; map container 270px and live tiles/markers visible. Desktop screenshot refreshed after fixes. All 74 dashboard tests pass locally; production build and health check pass. Backup: `/opt/pilot-plus/backups/20261008-before-workday.tar.gz`; previous releases retained for rollback.

---

# Fines dashboard design QA — 2026-10-12

## Evidence

- Source visual truth: `C:/Users/pasahdark/.codex/generated_images/019f6750-4141-7fb0-906c-a92740c37323/exec-ad6b6b06-ed34-4df8-934b-d24de5e608c0.png`
- Browser-rendered production implementation: `output/playwright/fines-dashboard-desktop.png`
- Mobile implementation: `output/playwright/fines-dashboard-mobile.png`
- Same-input comparison: `output/playwright/fines-design-comparison.png`
- Viewport: desktop 1440 × 1024 CSS px at device scale 1; mobile 390 × 844 CSS px at device scale 1.
- Source pixels: 1487 × 1058. Implementation pixels: 1440 × 1024. The comparison board normalizes both sides into 1440 × 1024 frames with `contain`; no density scaling was needed for the implementation.
- State: production dark theme, real company data, default unfiltered fines queue.

## Full-view comparison

- Information hierarchy matches the selected direction: single universal search, four operational KPI blocks, urgent queue first, remaining fines second.
- The production shell intentionally retains the established СУПА ПРО navigation and graphite tokens instead of copying the illustrative menu labels.
- The production search region includes explicit Find, Excel and advanced-filter controls required by the working product; this makes it taller than the concept but keeps every control visible and touch-safe.
- The concept's lower dense table is intentionally represented by the existing operational fine cards because they retain assignment, location, payment selection and payment actions. The visual hierarchy and ordering match; the interaction surface is richer than the static concept.

## Focused comparison

- Typography: current application font, optical weights and hierarchy are consistent with the graphite shell; headings, KPI values and action labels remain readable at desktop and mobile widths.
- Spacing/layout: all four KPI cards remain on one desktop row; urgent cards use the intended rectangular format and right-corner badge; mobile has no horizontal overflow (`390px` client and scroll widths).
- Colors/tokens: background is the production `#101014`; surfaces use the established graphite levels; primary remains `#0067ff`; red is reserved for urgent/payment states.
- Image quality: production vehicle PNG is a transparent, sharp cutout and remains legible on graphite. Missing vehicles fall back to text instead of a fake image.
- Copy/content: labels are operational Russian copy and values come from production rather than illustrative mock data.

## Primary interactions tested

- Opened `/fines` with production authorization.
- Confirmed universal search and advanced filter controls are accessible.
- Downloaded `fines-2026-10-12.xlsx`; ExcelJS reopened it successfully with 196 data rows.
- Checked desktop and 390px mobile layouts; no horizontal overflow.
- Checked browser console: 0 errors.

## Comparison history

- Pass 1: no actionable P0/P1/P2 defects. Differences from the concept are intentional product constraints: working filters/export controls and action-complete fine cards.

## Follow-up polish

- P3: a future compact desktop table view could be offered as a density toggle without replacing the action-complete card view.

final result: passed

## 2026-10-19 — Fines variant 2, deadline table

- Reference: `C:/Users/pasahdark/.codex/generated_images/019f6750-4141-7fb0-906c-a92740c37323/exec-3a4036c6-8456-4026-bd1c-391234a88a42.png`.
- Production capture: `output/fines-deadline-queue.jpg`; comparison viewport 1586×992, temporary override reset after QA.
- Deployed release: `20261019-fines-deadline-queue`, green slot; deployment script completed successfully.
- Replaced summary/urgent cards with seven-day discount strip and grouped table. Retained production shell/logo, graphite design tokens and existing PNG assets. Blue full-number oval sidebar badges, without shadows or 99+ abbreviation.
- Real data differs from demonstration: no urgent-today rows; two discounts on 23 October totaling 1125 RUB. Groups appear only when populated. Driver phone and fictional Telegram sent statuses were not fabricated. Telegram delivery is unavailable until client integration is connected.
- Visual comparison: structure, calendar, table columns and group colors implemented; production header, additional working filter toolbar, data-driven row wrapping and existing icons intentionally differ. Not claimed pixel-identical to generated concept.
- Browser verified date filter returns 2 of 2 records, date reset, advanced filter visibility, separate detail dialog and query-aware Excel link. No browser console errors observed. Document width 1576 within viewport 1586.
- Regression: 28 targeted tests passed; scoped ESLint passed; production build passed. Local global typecheck has two unrelated pre-existing errors in Supa Car route tests.
- Final result: deployed and desktop functional QA passed; mobile visual comparison and actual Telegram delivery not verified in this change.
