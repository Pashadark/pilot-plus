# Supa Pro Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser favicon with the approved blue rounded-square «СП» brand mark.

**Architecture:** Keep the root App Router `src/app/favicon.ico` file convention documented by the installed Next.js version. Generate one ICO containing 16, 32, 48, and 64 pixel frames from a high-resolution source, then verify its structure and production build.

**Tech Stack:** Next.js App Router metadata files, Pillow image generation, Vitest, TypeScript.

## Global Constraints

- Blue rounded square with centered white «СП».
- No caption, shadows, or small decorative details.
- Preserve safe padding at 16×16 and 32×32.
- Do not modify application title or other metadata.

---

### Task 1: Generate and verify the favicon

**Files:**
- Modify: `src/app/favicon.ico`
- Create: `src/app/favicon.test.ts`

**Interfaces:**
- Consumes: Next.js root `app/favicon.ico` file convention.
- Produces: a multi-size ICO served automatically as `/favicon.ico`.

- [ ] **Step 1: Write the failing asset test**

```ts
expect(icon.widths).toEqual(expect.arrayContaining([16, 32, 48, 64]));
expect(icon.centerPixel).toEqual([255, 255, 255, 255]);
expect(icon.cornerPixel[3]).toBe(0);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/app/favicon.test.ts`
Expected: FAIL because the existing favicon does not contain the approved frames and brand pixels.

- [ ] **Step 3: Generate the approved ICO**

Use Pillow to render a 256×256 transparent canvas, a `#0B63F6` rounded square with safe padding, and centered white «СП» text using an installed bold font. Export ICO frames at 16, 32, 48, and 64 pixels to `src/app/favicon.ico`.

- [ ] **Step 4: Run focused verification**

Run: `npx vitest run src/app/favicon.test.ts && npm run typecheck && npm run build`
Expected: PASS; Next.js build includes the favicon metadata route.

- [ ] **Step 5: Commit the isolated favicon change**

```bash
git add src/app/favicon.ico src/app/favicon.test.ts docs/superpowers/plans/2026-09-04-supapro-favicon.md
git commit -m "feat: add Supa Pro favicon"
```
