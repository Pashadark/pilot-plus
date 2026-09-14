# Global Notifications and Header Popovers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать верхние окна устойчивыми и превратить колокольчик в полный журнал событий компании с понятными toast для пользовательских действий.

**Architecture:** Общий клиентский `AnchoredPopover` рендерит профиль и уведомления через portal и вычисляет безопасную позицию относительно кнопки. Серверный notification query объединяет автомобильные события с audit log, формирует единый DTO, применяет область доступа SYSTEM/COMPANY и существующие read receipts. Toast остаётся быстрым feedback-слоем, но получает единые правила дедупликации и отображения результатов операций.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Prisma/PostgreSQL, Vitest, Testing Library, Playwright.

## Global Constraints

- `SYSTEM_ADMIN` видит события всех сотрудников и всех компаний; `COMPANY_ADMIN` — своей компании; остальные роли — только разрешённые разделы.
- Верхние окна не выходят за viewport, не обрезаются header и сохраняют корректное положение при scroll/resize.
- Цвет означает состояние: красный — критическое, янтарный — внимание, зелёный — успех, синий — информация, фиолетовый — аренда с правом выкупа.
- Toast подтверждает текущее действие, колокольчик хранит историю; одновременно не более четырёх toast.
- Не менять действующую синюю дизайн-систему СУПА ПРО и не затрагивать несвязанные рабочие изменения.

---

### Task 1: Viewport-safe anchored popover

**Files:**
- Create: `src/shared/ui/AnchoredPopover.tsx`
- Create: `src/shared/ui/AnchoredPopover.test.tsx`
- Modify: `src/shared/ui/Overlays.tsx`
- Modify: `src/shared/ui/index.ts`
- Modify: `src/shared/components/app-shell/Header.test.tsx`

**Interfaces:**
- Produces: `AnchoredPopover({ trigger, ariaLabel, children, panelClassName, mobileTitle })`.
- Preserves: `DropdownMenu({ label, ariaLabel, children })` public API by delegating to `AnchoredPopover`.

- [ ] **Step 1: Write failing component tests**

Test opening/closing, Escape focus restoration, outside click, portal rendering, `top`/`right` collision clamping, and mobile sheet attributes.

```tsx
render(<AnchoredPopover ariaLabel="Профиль" trigger={<span>П</span>}><a href="/profile">Профиль</a></AnchoredPopover>);
fireEvent.click(screen.getByRole('button', { name: 'Профиль' }));
expect(screen.getByRole('menu')).toHaveAttribute('data-overlay-layer', 'header');
fireEvent.keyDown(document, { key: 'Escape' });
expect(screen.getByRole('button', { name: 'Профиль' })).toHaveFocus();
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npx vitest run src/shared/ui/AnchoredPopover.test.tsx src/shared/components/app-shell/Header.test.tsx`

Expected: FAIL because `AnchoredPopover` does not exist and current dropdown has no viewport positioning.

- [ ] **Step 3: Implement the portal and positioning contract**

Use `createPortal`, trigger/panel refs, `getBoundingClientRect`, viewport gap `8`, panel gap `8`, `position: fixed`, `top`, `left`, and a `requestAnimationFrame` recalculation on open/resize/scroll. Close on Escape/outside click/link selection and return focus. Render a mobile bottom sheet below `640px`; apply only opacity/transform motion and reduced-motion fallback.

- [ ] **Step 4: Delegate existing DropdownMenu to AnchoredPopover**

Keep all callers source-compatible and expose `data-overlay-layer="header"` for regression tests.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/shared/ui/AnchoredPopover.test.tsx src/shared/components/app-shell/Header.test.tsx`

Expected: PASS.

---

### Task 2: Role-scoped company activity notifications

**Files:**
- Create: `src/modules/notifications/domain/build-audit-notifications.ts`
- Create: `src/modules/notifications/domain/build-audit-notifications.test.ts`
- Modify: `src/modules/notifications/types.ts`
- Modify: `src/modules/notifications/server/queries.ts`
- Create: `src/modules/notifications/server/queries.test.ts`
- Modify: `src/modules/admin/access/server.ts` only if an existing exported access helper cannot be reused.

**Interfaces:**
- Produces: `NotificationCategory = 'RENTAL' | 'FINE' | 'CLIENT' | 'FLEET' | 'SYSTEM'`.
- Produces: `buildAuditNotifications(rows): PilotNotification[]` with `actorLabel`, `companyLabel`, `category`, stable `audit:<id>` key, semantic tone and object href.
- Produces: `listNotificationsForCurrentUser({ limit?: number } = {})` returning merged, deduplicated, newest-first notifications.

- [ ] **Step 1: Write failing domain tests**

Cover rental create/update/handover/return/payment, fine create/update, client comments, vehicle/maintenance changes, author/company labels, link mapping and fallback copy.

```ts
expect(buildAuditNotifications([row])[0]).toMatchObject({
  id: 'audit:audit-1',
  category: 'RENTAL',
  actorLabel: 'Оператор',
  companyLabel: 'СУПА ПРО',
  href: '/rentals/rental-1',
});
```

- [ ] **Step 2: Write failing access/query tests**

Assert SYSTEM access queries all companies, COMPANY access restricts `companyId in companyIds`, read receipts are joined by current user, and vehicle timeline notifications remain present.

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `npx vitest run src/modules/notifications/domain/build-audit-notifications.test.ts src/modules/notifications/server/queries.test.ts`

Expected: FAIL because audit notification projection is absent.

- [ ] **Step 4: Implement audit projection and query merge**

Load admin access, fetch recent audit rows with actor/company, load matching `EventReadReceipt` rows, map entity types to category/tone/href, merge with existing vehicle events, dedupe by id, sort by ISO timestamp, and cap after merging. Never expose raw `changes` values containing protected client data.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/modules/notifications/domain/build-audit-notifications.test.ts src/modules/notifications/server/queries.test.ts src/modules/notifications/domain/build-notifications.test.ts`

Expected: PASS.

---

### Task 3: Operational notification center UX

**Files:**
- Modify: `src/modules/notifications/NotificationCenter.tsx`
- Modify: `src/modules/notifications/NotificationCenter.test.tsx`
- Modify: `src/modules/notifications/types.ts`
- Modify: `src/shared/components/app-shell/Header.tsx`

**Interfaces:**
- Consumes: `PilotNotification.category`, `actorLabel`, `companyLabel`, `tone`, `isRead`.
- Produces: category filters `ALL`, `IMPORTANT`, `RENTAL`, `FINE`, `CLIENT`, `FLEET`.

- [ ] **Step 1: Write failing UI tests**

Test category filters, unread marker, author/company metadata, empty filtered state, mark-one/mark-all behavior, accessible labels, and that profile/notifications cannot remain open together.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run src/modules/notifications/NotificationCenter.test.tsx src/shared/components/app-shell/Header.test.tsx`

Expected: FAIL because the current list has no categories or author/company metadata.

- [ ] **Step 3: Implement compact notification rows and filters**

Use a sticky header, horizontally scrollable compact filters, semantic icon/tone rail, title as the primary line, object/author/company as metadata, and time aligned without forcing the row wider. Preserve existing links and read actions.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run src/modules/notifications/NotificationCenter.test.tsx src/shared/components/app-shell/Header.test.tsx`

Expected: PASS.

---

### Task 4: Consistent toast feedback

**Files:**
- Modify: `src/shared/providers/toast-state.ts`
- Modify: `src/shared/providers/ToastProvider.tsx`
- Modify: `src/shared/providers/ToastProvider.test.tsx`
- Create: `src/shared/providers/action-toast.ts`
- Create: `src/shared/providers/action-toast.test.ts`
- Modify: `src/modules/rentals/settlement/components/RentalSettlementCard.tsx`
- Modify: `src/modules/rentals/edit/components/RentalTermsEditor.tsx`
- Modify: `src/modules/fines/components/FinePaymentPanel.tsx`
- Modify: `src/modules/fines/components/FineAssignmentReview.tsx`
- Modify: `src/modules/maintenance/components/RepairForm.tsx`
- Modify: `src/modules/maintenance/components/MaintenanceForm.tsx`
- Modify: `src/modules/maintenance/components/MaintenanceRecordCard.tsx`
- Modify: `src/modules/wash/components/WashForm.tsx`
- Modify: `src/modules/wash/components/WashRecordCard.tsx`
- Modify: `src/modules/devices/components/DeviceForm.tsx`

**Interfaces:**
- Produces: `toActionToast(result, fallback): ToastInput` for `{ ok/status, message, code }` action results.
- Preserves: `useToast().showToast(input)`.

- [ ] **Step 1: Write failing reducer/provider tests**

Test three-second duplicate coalescing, maximum four visible items, danger duration, pause behavior and global unhandled error conversion.

- [ ] **Step 2: Write failing action-result mapping tests**

```ts
expect(toActionToast({ ok: false, message: 'Не сохранено' }, 'Ошибка')).toMatchObject({
  tone: 'danger',
  title: 'Не сохранено',
});
```

- [ ] **Step 3: Implement toast deduplication and mapper**

Generate a stable content key from tone/title/description, refresh an existing toast rather than stacking it within three seconds, retain the four-item cap, and keep errors for 10 seconds.

- [ ] **Step 4: Audit high-value mutations and add missing bridges**

Cover rental create/edit/extend/handover/return/payment/deposit, fine assignment/payment, client create/edit/comment/document, vehicle create/edit/fuel/document, maintenance/repair, wash and device commands. Do not add duplicate component and global toasts for the same action.

- [ ] **Step 5: Run toast and affected component tests**

Run: `npx vitest run src/shared/providers src/modules/rentals src/modules/fines src/modules/clients src/modules/client-comments src/modules/vehicles src/modules/maintenance src/modules/wash`

Expected: PASS.

---

### Task 5: Browser, accessibility and release verification

**Files:**
- Modify: `tests/profile.spec.ts`
- Modify: `tests/rentals.spec.ts`
- Modify: `tests/clients.spec.ts`
- Modify: `tests/system-states.spec.ts`

**Interfaces:**
- Consumes the finished popover, notification query, notification UI and toast behavior.

- [ ] **Step 1: Add desktop and mobile E2E assertions**

At desktop and 390 px width, open profile and notification surfaces, assert their bounding boxes remain inside viewport, scroll, resize and recheck. Assert category filtering and navigation from a rental/comment/fine notification.

- [ ] **Step 2: Run static and unit checks**

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm run test:unit`

Expected: all commands exit 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: exit 0 without hydration or TypeScript errors.

- [ ] **Step 4: Run focused browser checks**

Run: `npx playwright test tests/profile.spec.ts tests/rentals.spec.ts tests/clients.spec.ts tests/system-states.spec.ts`

Expected: PASS on desktop and mobile projects used by the repository configuration.

- [ ] **Step 5: Run Impeccable mechanical detector once**

Run: `C:\Users\pasahdark\.codex\skills\impeccable\scripts\impeccable.cmd detect --json src/shared/ui/AnchoredPopover.tsx src/modules/notifications/NotificationCenter.tsx src/shared/providers/ToastProvider.tsx`

Expected: no unresolved blocking design findings.

- [ ] **Step 6: Verify the deployed site**

After deployment, inspect profile and notification windows on desktop/mobile, confirm a real rental, fine and comment event appear for the super-admin, and confirm success/error toast behavior without exposing protected client data.
