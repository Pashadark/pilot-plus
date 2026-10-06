# Material-style menu and search

**Goal:** Apply approved Materialize interaction to SUPA PRO, preserving branding and real search.
**Architecture:** Reuse shared Modal focus management in a body portal. Keep existing search endpoint and debounce. Sidebar hover/focus expands visually without changing the reserved collapsed width; pin persists existing preference.
**Tech Stack:** React 19, Next 16, Tailwind 4, Vitest.

- [x] Add failing tests for modal search, Ctrl+K, dismiss, and sidebar hover without layout shift.
- [x] Add opt-in Modal backdrop and hidden-title styling; existing consumers unchanged.
- [x] Replace HeaderSearch dropdown with centered 600px modal, black 50% overlay, quick navigation, real grouped results, Escape and keyboard controls.
- [x] Add sidebar hover/focus expansion, pin control and reduced-motion transitions.
- [x] Run targeted tests and lint; browser-check desktop/mobile, build release and deploy with rollback. 29 tests passed; production build and HTTP 200 verified; release 20260922-material-menu.
