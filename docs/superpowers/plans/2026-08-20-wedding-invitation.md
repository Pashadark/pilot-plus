# Wedding Invitation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a mobile-first wedding invitation for Anastasia and Pavel on a free HTTPS URL.

**Architecture:** Create a dependency-free static mini-site in `wedding-invitation/`, isolated from the Pilot+ Next.js application and deployable from that directory as a Vercel static project. Keep presentation in HTML/CSS and expose pure date/countdown helpers from an ES module so core behavior can be tested with Node's built-in test runner.

**Tech Stack:** Semantic HTML5, modern CSS, vanilla JavaScript ES modules, Node.js built-in tests, Sharp for local HEIC conversion, Playwright for responsive visual verification, Vercel static hosting.

## Global Constraints

- Use the monochrome composition and mood of WeddingPost template №1125 without copying WeddingPost branding, source code, or graphic assets.
- Show «Анастасия и Павел» and the wedding date 2 September 2026.
- Show the schedule: 11:00 gathering at Tverskaya Square, 11:40 ceremony, 12:30–14:00 photo session, 14:30 Bar «Дневник».
- The dress code is free; ask guests not to choose fully white, red, or lilac outfits.
- Attendance confirmation closes on 30 August 2026.
- «Я приду» opens `https://t.me/+ieyOMxZtKNQ3ZDNi`.
- «Не смогу» shows «Нам очень жаль, что вы не сможете быть с нами» and attempts to close only the current invitation tab.
- Do not collect personal data, add analytics, use a database, or require authentication.
- Optimize copies of `IMG_0825.HEIC` and `IMG_0732.HEIC`; never modify the original files.
- Support keyboard navigation, visible focus, sufficient contrast, reduced motion, and responsive mobile/desktop layouts.

---

### Task 1: Static invitation shell and optimized photography

**Files:**
- Create: `wedding-invitation/index.html`
- Create: `wedding-invitation/styles.css`
- Create: `wedding-invitation/assets/anastasia-pavel-hero.webp`
- Create: `wedding-invitation/assets/anastasia-pavel-story.webp`
- Create: `wedding-invitation/assets/og-wedding-invitation.jpg`
- Create: `wedding-invitation/vercel.json`
- Test: `wedding-invitation/tests/structure.test.mjs`

**Interfaces:**
- Consumes: the two user-provided HEIC photos and the content in the approved design spec.
- Produces: semantic section IDs `hero`, `invitation`, `schedule`, `locations`, `dress-code`, `rsvp`, and `closing`; DOM hooks `[data-countdown]`, `[data-attend]`, `[data-decline]`, `[data-decline-panel]`; optimized WebP/JPEG assets.

- [ ] **Step 1: Write the failing structure test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../index.html", import.meta.url);

test("invitation contains every required section and action", async () => {
  const html = await readFile(htmlPath, "utf8");
  for (const id of ["hero", "invitation", "schedule", "locations", "dress-code", "rsvp", "closing"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /Анастасия/);
  assert.match(html, /Павел/);
  assert.match(html, /02\.09\.2026/);
  assert.match(html, /https:\/\/t\.me\/\+ieyOMxZtKNQ3ZDNi/);
});
```

- [ ] **Step 2: Run the structure test and verify failure**

Run: `node --test wedding-invitation/tests/structure.test.mjs`

Expected: FAIL because `wedding-invitation/index.html` does not exist.

- [ ] **Step 3: Convert and optimize the supplied photographs**

Run a small `sharp` command from the repository runtime that reads the two absolute HEIC paths and writes only the three files listed above. Use portrait crops for the two WebP files at maximum width 1600, quality 84; create the Open Graph JPEG at 1200×630, quality 88. Visually inspect both source photographs first and choose the stronger image for the hero and Open Graph crop.

Expected: all three output files exist, each is below 700 KiB, and neither HEIC source has changed.

- [ ] **Step 4: Implement the semantic page and monochrome responsive design**

Create `index.html` with real Russian copy, exact schedule, map links supplied by the user, Telegram RSVP link, Open Graph metadata, and no placeholder text. Create `styles.css` with a black, ivory, and soft-grey palette; a classic serif display stack; large «А & П» monogram; photographic full-height hero; vertical timeline; generous spacing; mobile-first breakpoints; `:focus-visible`; and `prefers-reduced-motion` overrides.

Create `vercel.json`:

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [{ "key": "X-Content-Type-Options", "value": "nosniff" }]
    }
  ]
}
```

- [ ] **Step 5: Run the structure test and static checks**

Run: `node --test wedding-invitation/tests/structure.test.mjs`

Expected: PASS with one passing test.

Run: `npx prettier --check wedding-invitation/index.html wedding-invitation/styles.css wedding-invitation/vercel.json wedding-invitation/tests/structure.test.mjs`

Expected: all files use Prettier formatting.

- [ ] **Step 6: Commit the completed shell**

```powershell
git add -- wedding-invitation
git commit -m "feat: add wedding invitation shell"
```

### Task 2: Countdown and RSVP interactions

**Files:**
- Create: `wedding-invitation/invitation.mjs`
- Modify: `wedding-invitation/index.html`
- Modify: `wedding-invitation/styles.css`
- Test: `wedding-invitation/tests/invitation.test.mjs`

**Interfaces:**
- Consumes: `[data-countdown]`, `[data-decline]`, and `[data-decline-panel]` hooks from Task 1.
- Produces: `getCountdownParts(targetMs: number, nowMs: number): {days: number, hours: number, minutes: number, seconds: number, complete: boolean}` and `showDeclinePanel(document: Document): void`.

- [ ] **Step 1: Write failing countdown tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { getCountdownParts } from "../invitation.mjs";

test("countdown splits remaining duration", () => {
  assert.deepEqual(getCountdownParts(90_061_000, 0), {
    days: 1,
    hours: 1,
    minutes: 1,
    seconds: 1,
    complete: false,
  });
});

test("countdown stops at zero after the wedding starts", () => {
  assert.deepEqual(getCountdownParts(1_000, 2_000), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    complete: true,
  });
});
```

- [ ] **Step 2: Run tests and verify module-not-found failure**

Run: `node --test wedding-invitation/tests/invitation.test.mjs`

Expected: FAIL because `invitation.mjs` does not exist.

- [ ] **Step 3: Implement the pure countdown helper**

```js
export function getCountdownParts(targetMs, nowMs) {
  const remaining = Math.max(0, targetMs - nowMs);
  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining % 86_400_000) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1_000),
    complete: remaining === 0,
  };
}
```

- [ ] **Step 4: Run the countdown tests**

Run: `node --test wedding-invitation/tests/invitation.test.mjs`

Expected: PASS with two passing tests.

- [ ] **Step 5: Add the browser controller**

In `invitation.mjs`, set the target to `2026-09-02T11:00:00+03:00`, render Russian day/hour/minute/second values once per second, and stop the interval when `complete` becomes true. Add an intersection observer that reveals `[data-reveal]` blocks while leaving all content visible when JavaScript is unavailable or reduced motion is enabled.

Export and use this decline handler:

```js
export function showDeclinePanel(documentRef) {
  const panel = documentRef.querySelector("[data-decline-panel]");
  const choices = documentRef.querySelector("[data-rsvp-choices]");
  if (!(panel instanceof HTMLElement) || !(choices instanceof HTMLElement)) return;
  choices.hidden = true;
  panel.hidden = false;
  panel.focus();
  window.setTimeout(() => window.close(), 1200);
}
```

Wire the module from `index.html` with `<script type="module" src="./invitation.mjs"></script>`. Style the decline state as a full-width calm final card and keep it readable if `window.close()` is blocked.

- [ ] **Step 6: Run all invitation tests and formatting checks**

Run: `node --test wedding-invitation/tests/*.test.mjs`

Expected: PASS for structure and countdown behavior.

Run: `npx prettier --check wedding-invitation`

Expected: all supported files pass.

- [ ] **Step 7: Commit the interactions**

```powershell
git add -- wedding-invitation
git commit -m "feat: add wedding invitation interactions"
```

### Task 3: Responsive verification and free deployment

**Files:**
- Modify: `wedding-invitation/index.html` if visual verification finds content defects.
- Modify: `wedding-invitation/styles.css` if visual verification finds layout defects.
- Modify: `wedding-invitation/invitation.mjs` if interaction verification finds behavior defects.
- Create: `wedding-invitation/README.md`

**Interfaces:**
- Consumes: the complete static invitation from Tasks 1 and 2.
- Produces: a verified static site, deployment instructions, and a public HTTPS Vercel URL.

- [ ] **Step 1: Start a local static server**

Run from `wedding-invitation/`: `python -m http.server 4173 --bind 127.0.0.1`

Expected: `http://127.0.0.1:4173/` serves the invitation without console errors.

- [ ] **Step 2: Verify mobile rendering in a real browser**

Use a 390×844 viewport. Capture the hero, invitation, schedule, dress-code, and RSVP sections. Confirm that text never clips, photographs remain intentional, tap targets are at least 44×44 CSS pixels, the page has no horizontal overflow, and the Telegram link exactly matches the approved invite URL.

- [ ] **Step 3: Verify desktop and reduced-motion rendering**

Use a 1440×900 viewport and then enable reduced motion. Confirm sensible maximum content width, non-stretched photography, visible keyboard focus, readable contrast, no hidden content, and no layout shift when animations are disabled.

- [ ] **Step 4: Verify both RSVP branches**

Click «Я приду» and verify the browser resolves the link toward Telegram without submitting any form. Return to the invitation, click «Не смогу», and verify the exact decline copy is shown; treat a browser-blocked `window.close()` as expected behavior.

- [ ] **Step 5: Add operating notes**

Create `README.md` documenting local preview, the source photo locations, the generated asset filenames, the RSVP Telegram link, the Vercel project root (`wedding-invitation`), and how to update text without touching Pilot+.

- [ ] **Step 6: Run final local verification**

Run: `node --test wedding-invitation/tests/*.test.mjs`

Expected: all tests PASS.

Run: `npx prettier --check wedding-invitation`

Expected: all supported files PASS.

Run: `git diff --check`

Expected: no whitespace errors in the implementation.

- [ ] **Step 7: Commit verified implementation**

```powershell
git add -- wedding-invitation
git commit -m "docs: verify wedding invitation deployment"
```

- [ ] **Step 8: Deploy to Vercel**

Use the Vercel deployment workflow with `wedding-invitation` as the project root and no environment variables. Create a preview deployment first, open the returned HTTPS URL on mobile dimensions, repeat the RSVP-link and no-overflow checks, then provide the public URL to the user. Do not attach the wedding site to the Pilot+ production project.

Expected: a public HTTPS URL opens the finished invitation without authentication.
