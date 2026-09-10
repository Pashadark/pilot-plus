# Client Document Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-document autofill flow to new-client creation that reads a passport identity page, passport registration page and driver licence, fills existing form fields, and saves all three images with the created client.

**Architecture:** Keep OCR local in the existing Node.js route handler and split parsing into pure functions selected by an explicit document kind. Add a focused modal component that owns file selection and partial-result handling, while `ClientForm` remains responsible for applying values and uploading selected files after the client is created.

**Tech Stack:** Next.js 16 App Router route handlers, React 19, TypeScript, Tailwind CSS, Tesseract CLI, Vitest, Testing Library, existing Pilot+ UI and private client-document storage.

## Global Constraints

- Do not send passport or driver-licence images to an external service.
- Never invent unreadable values; return only fields supported by OCR text.
- OCR failure must not block manual client creation.
- Do not add required database fields or change existing client statuses.
- Preserve mobile usability and keyboard-accessible dialog behavior.
- Save the identity page and registration page as separate `PASSPORT` documents and the licence as `DRIVER_LICENSE`.

---

### Task 1: Pure document parsers

**Files:**
- Create: `src/modules/clients/document-ocr.ts`
- Create: `src/modules/clients/document-ocr.test.ts`
- Modify: `src/modules/clients/passport-ocr.ts`

**Interfaces:**
- Consumes: `parseRussianPassportOcr(text: string): PassportOcrFields`.
- Produces: `ClientOcrDocumentKind`, `ClientOcrFields`, `parseClientDocumentOcr(kind, text)`.

- [ ] **Step 1: Write failing tests**

Add fixtures that assert `PASSPORT_MAIN` returns identity and passport fields, `PASSPORT_REGISTRATION` returns only `registrationAddress`, and `DRIVER_LICENSE` returns the licence number plus issue/expiry dates. Assert empty/noisy text returns `{}`.

- [ ] **Step 2: Run the parser test and confirm RED**

Run: `npx vitest run src/modules/clients/document-ocr.test.ts`

Expected: FAIL because `document-ocr.ts` does not exist.

- [ ] **Step 3: Implement the typed dispatcher and parsers**

Define:

```ts
export type ClientOcrDocumentKind =
  | 'PASSPORT_MAIN'
  | 'PASSPORT_REGISTRATION'
  | 'DRIVER_LICENSE';

export type ClientOcrFields = PassportOcrFields & {
  registrationAddress?: string;
  driverLicense?: string;
  driverLicenseIssuedAt?: string;
  driverLicenseExpiresAt?: string;
};

export function parseClientDocumentOcr(
  kind: ClientOcrDocumentKind,
  text: string,
): ClientOcrFields;
```

Use conservative Russian-label and numeric-pattern matching. Normalize dates to `YYYY-MM-DD`; omit every field that cannot be supported by the text.

- [ ] **Step 4: Run parser tests and confirm GREEN**

Run: `npx vitest run src/modules/clients/passport-ocr.test.ts src/modules/clients/document-ocr.test.ts`

Expected: all tests pass.

---

### Task 2: Typed local OCR route

**Files:**
- Modify: `src/app/(protected)/clients/document-ocr/route.ts`
- Create: `src/app/(protected)/clients/document-ocr/route.test.ts`

**Interfaces:**
- Consumes: `parseClientDocumentOcr(kind, text)` from Task 1.
- Produces: `POST` accepting multipart `file` and `documentKind`, returning `{ fields: ClientOcrFields }` or `{ error: string }`.

- [ ] **Step 1: Write failing route tests**

Test that a missing/unknown `documentKind` returns HTTP 400, an unsupported file returns HTTP 400, and an allowed kind reaches the selected parser. Mock access control and the OCR process boundary rather than running Tesseract in unit tests.

- [ ] **Step 2: Run the route test and confirm RED**

Run: `npx vitest run "src/app/(protected)/clients/document-ocr/route.test.ts"`

Expected: FAIL because the existing route ignores `documentKind`.

- [ ] **Step 3: Implement route validation and dispatch**

Read `documentKind` from `FormData`, validate it against the three literal values before writing a temporary file, call the parser for that kind, and keep the existing 15 MB image validation, 30-second process timeout, access check and `finally` cleanup.

- [ ] **Step 4: Run route and parser tests**

Run: `npx vitest run "src/app/(protected)/clients/document-ocr/route.test.ts" src/modules/clients/document-ocr.test.ts`

Expected: all tests pass.

---

### Task 3: Autofill dialog

**Files:**
- Create: `src/modules/clients/components/ClientDocumentAutofillDialog.tsx`
- Create: `src/modules/clients/components/ClientDocumentAutofillDialog.test.tsx`

**Interfaces:**
- Consumes: existing `Modal`, `Button`, `DocumentDropzone`, `/clients/document-ocr`.
- Produces:

```ts
export type ClientAutofillFiles = {
  passportMain: File;
  passportRegistration: File;
  driverLicense: File;
};

export function ClientDocumentAutofillDialog(props: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onApply(fields: Record<string, string>, files: ClientAutofillFiles): void;
}): React.ReactNode;
```

- [ ] **Step 1: Write failing component tests**

Assert the modal has three labelled image inputs, disables recognition until all are selected, posts each file with its matching `documentKind`, accepts partial success, reports failed document names, and calls `onApply` once with merged non-empty fields and all files.

- [ ] **Step 2: Run the component test and confirm RED**

Run: `npx vitest run src/modules/clients/components/ClientDocumentAutofillDialog.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the dialog**

Use the shared accessible `Modal`; render the three dropzones in one column on mobile and responsive columns on larger screens. Submit with `Promise.allSettled`, merge fulfilled `fields`, show textual per-file failures, keep retry possible, and close only after a successful `onApply`.

- [ ] **Step 4: Run the component test and confirm GREEN**

Run: `npx vitest run src/modules/clients/components/ClientDocumentAutofillDialog.test.tsx`

Expected: all tests pass.

---

### Task 4: Integrate with new-client form and protected storage

**Files:**
- Modify: `src/modules/clients/components/ClientForm.tsx`
- Modify: `src/modules/clients/components/ClientForm.test.tsx`

**Interfaces:**
- Consumes: `ClientDocumentAutofillDialog`, `ClientAutofillFiles`, `uploadClientDocumentAction`.
- Produces: visible `Автозаполнение по документам` action and three persisted client-document uploads.

- [ ] **Step 1: Add failing form tests**

Assert the button is present only for new clients next to the final create action, applying OCR fills existing named inputs and navigates to the document-data step, and successful client creation schedules uploads titled `Паспорт — основной разворот`, `Регистрация по паспорту`, and `Водительское удостоверение` with categories `PASSPORT`, `PASSPORT`, and `DRIVER_LICENSE`.

- [ ] **Step 2: Run the form test and confirm RED**

Run: `npx vitest run src/modules/clients/components/ClientForm.test.tsx`

Expected: new autofill assertions fail.

- [ ] **Step 3: Implement form integration**

Replace automatic single-passport OCR with modal state. Apply only non-empty values to existing form controls, retain the three selected files for post-create upload, move to the `Документы и данные` step, and show a success/warning toast with the number of filled fields. Keep manual file inputs and client-photo upload behavior intact.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx vitest run src/modules/clients/components/ClientForm.test.tsx src/modules/clients/components/ClientDocumentAutofillDialog.test.tsx src/modules/clients/document-ocr.test.ts "src/app/(protected)/clients/document-ocr/route.test.ts"`

Expected: all tests pass.

---

### Task 5: Full verification and production rollout

**Files:**
- Modify only if verification exposes a defect in the files above.

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: verified and deployed production feature.

- [ ] **Step 1: Run static and regression checks**

Run: `npm run typecheck`, `npm run lint`, `npx prettier --check` for changed files, then `npm run build`.

Expected: exit code 0 for every command.

- [ ] **Step 2: Deploy atomically**

Copy the current production release into a new timestamped release, transfer only changed source files, build as the `pilot-plus` service account, atomically switch `/opt/pilot-plus/current`, restart `pilot-plus`, and keep the previous release available for rollback.

- [ ] **Step 3: Verify production**

Confirm `systemctl is-active pilot-plus` returns `active`, `https://supapro.ru/login` returns HTTP 200, and an authenticated `/clients?form=new` check shows the new action and three-document dialog without console errors.

- [ ] **Step 4: Commit implementation**

Stage only the files from Tasks 1-4 plus this plan, review `git diff --cached`, and commit with `feat: add client document autofill`.

## Self-review

Every requirement in the approved design maps to Tasks 1-5. All public types are consistent across parser, dialog and form integration. The plan contains no placeholders, introduces no external OCR dependency and preserves manual client creation as a fallback.
