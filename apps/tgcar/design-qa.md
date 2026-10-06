# TG CAR preview QA — 2026-09-20

Status: local read-only live fleet integration verified; production deployment and booking writes not implemented. Historical preview notes below are superseded by this section.

## Local SUPA PRO integration — 2026-09-20

- Live read-only SQL, tenant scoped, excludes archived/demo vehicles. Fixed local SSH adapter with 12-second timeout, 30-second data cache, no stale-success fallback. Production mode disabled; dev listener restricted to loopback.
- 17 active fleet records verified against source. All 13 primary vehicle photos returned HTTP 200; four vehicles have no primary image and display an explicit placeholder.
- At verification: two vehicles available now. Missing price is null, not a fabricated rate. All vehicles accessible by disabling the available-only filter.
- Real browser checked all-vehicle count, Toyota filter, dates 2026-10-03 10:00 to 2026-10-06 10:00 Moscow, three available Toyotas in that period, and detail calculation 3 × 4500 = 13500 with 15000 deposit separate.
- Browser mobile detail: document width and scrollWidth 375px at 390px viewport override; no horizontal overflow. Override reset afterward.
- Read-only live photography, tariffs, year, fuel, transmission and seats are shown. Categories now use source make rather than invented rental classes.
- Thirteen automated tests pass, production build passes. Tests cover boundaries, active overdue rentals, readiness, maintenance, invalid date/time ranges, public DTO whitelist, missing prices, day rounding and existing privacy/toasts.
- Private clients, GPS, contracts, VIN and registration documents are not queried or returned. Rental intervals stay server-side; only computed availability is returned.
- No remote mutation, deployment, migration, service restart or DNS change was performed. This bridge requires the owner's local SSH access and is not the future production transport. Booking remains preview-only; no atomic reservations or payment processing.

## Toast and studio-photo update

- Added deduplicated toast queue (maximum three), explicit close controls, persistent errors/warnings, automatic success/info dismissal, hover/focus and hidden-tab pause, reduced-motion support.
- Browser verified storage-choice success toast and its subsequent dismissal. Form feedback remains explicitly preview-only, never claims a booking was created.
- Imagegen edited the three existing car assets into light studio backgrounds. Generated images inspected and used in catalogue and detail; original assets retained.
- Browser visually inspected catalogue at intermediate width and toast over footer.
- Seven unit tests and production build passed.
- Publication is not complete: launch mode, production data and DNS target remain unresolved. See LAUNCH.md. No DNS or production-server modifications made.

Reference: approved exec-7f34e5b2 homepage and exec-ed77712b vehicle detail. White/blue visual direction, text-only brand, Moscow City hero, floating date search, car cards, three-step band, editorial cards, office and white four-column footer implemented. Vehicle details include a separate review empty state.

Evidence:
- Next.js production build passed.
- node:test: 2/2 date/quote tests passed.
- Browser desktop homepage and Toyota Camry detail visually inspected.
- Browser native date input: Oct 2–5 = 3 days × 6000 = 18000; deposit 20000 shown separately. Booking preview opens client form.
- Mobile viewport override 390×844 inspected; document width and scrollWidth both 375 (scrollbar accounted for), no horizontal overflow.
- Dates preserve when returning to catalogue.

Limitations: single-route client-side preview; not production routing. No live fleet/availability, booking submission, payment, CMS or reviews backend. Demo photos and rates are labelled. No invented testimonials. Legal documents are pending, payments disabled. Gallery and related-car section from full detail reference remain to be implemented with real vehicle photos. No production deployment or DNS changes.

Browser automation fill on native date fields did not trigger React change; keyboard date adjustment did and calculation verified. No application fix was necessary.

## Readability and privacy update

- Desktop computed navigation: 17px / 700; body: 16px. Mobile navigation: 16px. Metadata raised to 14px.
- Browser verified technical-storage choice persists on reload and can be reopened from footer.
- Personal-data checkbox starts unchecked and validation action disabled. Synthetic client form tested after explicit checkbox selection; preview-only result confirmed.
- Browser mobile check: 375px document/375px scrollWidth at 390px viewport override; no horizontal overflow. Notice fits, with internal overflow available on short screens.
- Added real /privacy, /cookies, /consent pages describing current preview truth. They are not a claim of production legal readiness. Final retention rules, contact channel and approved documents are still required before real submissions.
- npm test: 5 passed. Production build: passed with all three information routes.

## Ingos-informed surface refinement

Reference inspected live: https://www.ingos.ru/ — light homepage, offer cards and login dialog (no user data entered). Observed 16px/400 regular interface text, 32px/600 section headings, 16px input radii, 32px popup radii and three-layer neutral shadows at 3% opacity.

TG CAR retains its approved hero, photographs, content and composition. Uses locally hosted OFL Manrope instead of proprietary Ingo Stem; license stored beside font. Verified computed body/menu/section-heading weights 400/500/600 and loaded Manrope. Soft surfaces, form fields, cards, footer and popup updated consistently.

Desktop card, footer and popup inspected at 1360px; intermediate-width homepage inspected at 847px. Mobile popup inspected at 390px override: document and scroll widths both 375px. Corrected editorial image alignment and hero text contrast at intermediate widths. Mechanical style detector returned no findings. Existing functional tests 5/5 passed; no live booking or payment changes.
