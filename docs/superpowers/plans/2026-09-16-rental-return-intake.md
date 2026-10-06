# Rental Return Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать утверждённый мобильный экран приёмки автомобиля и полностью отделить приёмку от возврата залога.

**Architecture:** Выделить визуальные зоны загрузки в отдельный клиентский компонент, оставить существующий защищённый Server Action для файлов и изменить контракт `RETURN`, чтобы он не принимал депозитные решения. Срок возврата залога продолжает рассчитываться существующей бизнес-логикой командного центра от времени завершения аренды.

**Tech Stack:** Next.js 16 Server Actions, React 19, TypeScript, Tailwind CSS, Prisma, Vitest, Testing Library.

## Global Constraints

- Сохранить существующую авторизацию, tenant scope и проверку файлов.
- Не менять операцию выдачи автомобиля: залог фиксируется при выдаче или оплате.
- Не добавлять новую зависимость или миграцию БД.
- Реализовать утверждённую русскую копию и мобильную композицию.

---

### Task 1: Отделить возврат залога от приёмки

**Files:**
- Modify: `src/modules/rentals/operations/validation.ts`
- Modify: `src/modules/rentals/server/actions.ts`
- Modify: `src/modules/rentals/operations/server/return-rental.ts`
- Test: `src/modules/rentals/operations/validation.test.ts`
- Test: `src/modules/rentals/operations/server/return-rental.test.ts`

**Interfaces:**
- Consumes: `validateReturnCommand(command)` and `createRentalReturn(database)`.
- Produces: return command without deposit fields and a committed return operation with `depositStatus: null`.

- [ ] Add failing validation and return-service tests proving that deposit fields are rejected/omitted.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Remove deposit fields from the return command, action parsing and operation persistence.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Утверждённый загрузчик фото и видео

**Files:**
- Create: `src/modules/rentals/components/ReturnEvidenceDropzone.tsx`
- Create: `src/modules/rentals/components/ReturnEvidenceDropzone.test.tsx`
- Modify: `src/modules/rentals/components/RentalOperationDialog.tsx`
- Test: `src/modules/rentals/components/RentalOperationDialog.test.tsx`

**Interfaces:**
- Consumes: standard named file inputs expected by `operationEvidenceFiles(formData)`.
- Produces: accessible dropzones for `dashboardPhoto`, four body views and `inspectionVideo`.

- [ ] Add failing component tests for the six upload zones, exact labels and absence of deposit controls.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Build the reusable dropzone with the approved inline SVG variants and selected-file state.
- [ ] Compose the return screen in the approved order and copy.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Vehicle label and complete verification

**Files:**
- Modify: `src/modules/rentals/components/RentalActionRail.tsx`
- Modify: `src/app/(protected)/rentals/[id]/page.tsx`
- Test: `src/modules/rentals/components/RentalActionRail.test.tsx`

**Interfaces:**
- Consumes: vehicle make, model and registration number from the rental detail query.
- Produces: `rental.vehicleLabel` displayed below «Приём автомобиля».

- [ ] Add a failing test for the vehicle label in the return dialog.
- [ ] Pass and render `vehicleLabel`.
- [ ] Run all rental-operation tests, TypeScript, ESLint and production build.
- [ ] Deploy the verified build and smoke-test the live return dialog on mobile width.
