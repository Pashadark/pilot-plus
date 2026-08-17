# Client Rentals and Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показать в карточке клиента tenant-scoped историю аренд и защищённые договоры, а также добавить внутреннюю аудируемую ленту комментариев.

**Architecture:** Существующая `Rental` остаётся единственным источником заказов и документов. Новый изолированный модуль `client-comments` хранит заметки с soft-hide и транзакционным аудитом; карточка клиента получает один server-composed workspace с вкладками и whitelisted DTO.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Prisma 6.16/PostgreSQL 17, Tailwind CSS 4, Vitest, Playwright.

## Global Constraints

- Все тексты интерфейса и комментарии в исходном коде — на русском языке.
- `SUPER_ADMIN` видит всё; `COMPANY_ADMIN` и `DISPATCHER` — только свою компанию; `DRIVER` и `VIEWER` не получают данные.
- Аудит не содержит plaintext комментария, паспорт, телефон, адрес или содержимое договора.
- Миграции только аддитивные; общая БД автоматически не мигрируется и не seed-ится.
- Каждый серверный маршрут и action повторно проверяет сессию и tenant.
- Все состояния загрузки используют skeleton из дизайн-системы Pilot+.

---

### Task 1: Модель внутренних комментариев и tenant RBAC

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260817120000_add_client_comments/migration.sql`
- Create: `src/modules/client-comments/types.ts`
- Create: `src/modules/client-comments/validation.ts`
- Create: `src/modules/client-comments/access.ts`
- Test: `src/database/prisma/client-comments-schema.test.ts`
- Test: `src/modules/client-comments/access.test.ts`
- Test: `src/modules/client-comments/validation.test.ts`

**Interfaces:**

- Consumes: `getClientAccess('VIEW_CLIENTS' | 'MANAGE_CLIENTS')` из `src/modules/clients/access.ts`.
- Produces: `ClientCommentCategory`, `ClientCommentSeverity`, `ClientCommentDto`, `parseClientCommentInput()` и `getClientCommentAccess()`.

- [ ] **Step 1: Write failing schema, access and validation tests**

```ts
expect(schema).toContain('model ClientComment {');
expect(canCreateClientComment('DISPATCHER')).toBe(true);
expect(canCreateClientComment('DRIVER')).toBe(false);
expect(parseClientCommentInput({ text: '  Возврат без замечаний  ' })).toMatchObject({
  ok: true,
  data: { text: 'Возврат без замечаний' },
});
```

- [ ] **Step 2: Run RED tests**

Run: `npx vitest run src/database/prisma/client-comments-schema.test.ts src/modules/client-comments`
Expected: FAIL because the model and module do not exist.

- [ ] **Step 3: Add enums, model and additive SQL migration**

```prisma
model ClientComment {
  id             String                @id @default(cuid())
  companyId      String
  clientId       String
  rentalId       String?
  authorUserId   String
  category       ClientCommentCategory @default(GENERAL)
  severity       ClientCommentSeverity @default(INFO)
  text           String
  isPinned       Boolean               @default(false)
  hiddenAt       DateTime?
  hiddenByUserId String?
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt
  company        Company               @relation(fields: [companyId], references: [id], onDelete: Cascade)
  client         Client                @relation(fields: [companyId, clientId], references: [companyId, id], onDelete: Cascade)
  rental         Rental?               @relation(fields: [rentalId], references: [id], onDelete: SetNull)
  author         User                  @relation("ClientCommentAuthor", fields: [authorUserId], references: [id], onDelete: Restrict)
  hiddenBy       User?                 @relation("ClientCommentHiddenBy", fields: [hiddenByUserId], references: [id], onDelete: Restrict)
  @@index([companyId, clientId, isPinned, createdAt])
}
```

- [ ] **Step 4: Implement strict validation and role helpers**

```ts
export const clientCommentInputSchema = z.object({
  clientId: z.string().trim().min(1).max(128),
  rentalId: z.string().trim().max(128).optional(),
  category: z.enum(['GENERAL', 'POSITIVE', 'PROBLEM', 'DAMAGE', 'PAYMENT', 'VIOLATION']),
  severity: z.enum(['INFO', 'WARNING', 'DANGER']),
  text: z.string().trim().min(1).max(2000).transform(stripControlCharacters),
});
```

- [ ] **Step 5: Run GREEN tests and Prisma checks**

Run: `npx prisma format && npx prisma generate && npx vitest run src/database/prisma/client-comments-schema.test.ts src/modules/client-comments && npm run typecheck`
Expected: all targeted tests and typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add src/database/prisma src/modules/client-comments
git commit -m "feat(clients): add internal comment model"
```

### Task 2: Аренды клиента, статистика и защищённые документы

**Files:**

- Create: `src/modules/clients/server/client-rentals.ts`
- Test: `src/modules/clients/server/client-rentals.test.ts`
- Modify: `src/app/(protected)/clients/[id]/page.tsx`
- Modify: `src/modules/clients/types.ts`

**Interfaces:**

- Consumes: `ClientAccess`, `Rental`, `RentalDocumentVersion` and the existing protected rental download route.
- Produces: `getClientRentalWorkspace(access, clientId): Promise<ClientRentalWorkspaceDto | null>`.

- [ ] **Step 1: Write failing tenant and projection tests**

```ts
expect(query.where).toMatchObject({ clientId: 'client-1', companyId: { in: ['company-1'] } });
expect(result.summary).toEqual({ total: 3, active: 1, completed: 2, totalMinor: '250000' });
expect(result.rentals[0].documents).toEqual([
  { version: 1, format: 'DOCX' },
  { version: 1, format: 'PDF' },
]);
```

- [ ] **Step 2: Run RED test**

Run: `npx vitest run src/modules/clients/server/client-rentals.test.ts`
Expected: FAIL with missing module.

- [ ] **Step 3: Implement whitelisted tenant query and DTO mapping**

```ts
export type ClientRentalWorkspaceDto = {
  summary: { total: number; active: number; completed: number; totalMinor: string };
  rentals: Array<{
    id: string;
    contractNumber: string | null;
    status: RentalStatus;
    startsAt: string;
    endsAt: string;
    totalPriceMinor: string;
    depositMinor: string;
    vehicle: { label: string; registrationNumber: string | null };
    documents: Array<{ version: number; format: 'DOCX' | 'PDF' }>;
  }>;
};
```

- [ ] **Step 4: Compose workspace in protected client page**

Load the workspace only after `getClientById(access, id)` succeeds and pass it as a typed prop to `ClientDetailPage`; never serialize raw Prisma records or BigInt.

- [ ] **Step 5: Run GREEN tests**

Run: `npx vitest run src/modules/clients/server/client-rentals.test.ts src/modules/rentals/server/queries.test.ts && npm run typecheck`
Expected: tests and typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/clients src/app/(protected)/clients/[id]/page.tsx
git commit -m "feat(clients): expose rental history workspace"
```

### Task 3: Серверные действия и аудит комментариев

**Files:**

- Create: `src/modules/client-comments/queries.ts`
- Create: `src/modules/client-comments/actions.ts`
- Test: `src/modules/client-comments/queries.test.ts`
- Test: `src/modules/client-comments/actions.test.ts`

**Interfaces:**

- Consumes: Task 1 model, access and validation.
- Produces: `listClientComments()`, `createClientCommentAction()`, `updateClientCommentAction()`, `toggleClientCommentPinAction()` and `hideClientCommentAction()`.

- [ ] **Step 1: Write failing mutation tests**

```ts
expect(transaction.clientComment.create).toHaveBeenCalledWith(
  expect.objectContaining({ data: expect.objectContaining({ companyId: 'company-1' }) }),
);
expect(JSON.stringify(transaction.auditLog.create.mock.calls)).not.toContain('царапина');
expect(hideResult).toMatchObject({ ok: true });
```

- [ ] **Step 2: Run RED tests**

Run: `npx vitest run src/modules/client-comments/actions.test.ts src/modules/client-comments/queries.test.ts`
Expected: FAIL because actions and queries do not exist.

- [ ] **Step 3: Implement tenant queries and atomic mutations**

Every mutation executes `ClientComment` write and `AuditLog` creation inside one Serializable transaction. Update uses `updateMany` constrained by `id`, `companyId`, `clientId`, `hiddenAt: null`; dispatcher may hide only comments where `authorUserId` equals the session user.

```ts
changes: {
  (commentId, category, severity, pinned, hidden);
}
```

- [ ] **Step 4: Revalidate client routes and return stable Russian states**

```ts
export type ClientCommentActionState =
  | { ok: true; message: string; commentId: string }
  | { ok: false; code: 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'SAVE_FAILED'; message: string };
```

- [ ] **Step 5: Run GREEN tests**

Run: `npx vitest run src/modules/client-comments && npm run typecheck`
Expected: all targeted tests and typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/client-comments
git commit -m "feat(clients): manage audited internal comments"
```

### Task 4: Вкладки карточки клиента и поиск договоров

**Files:**

- Create: `src/modules/clients/components/ClientWorkspaceTabs.tsx`
- Create: `src/modules/clients/components/ClientRentalHistory.tsx`
- Create: `src/modules/client-comments/components/ClientCommentsPanel.tsx`
- Test: `src/modules/clients/components/ClientWorkspaceTabs.test.tsx`
- Test: `src/modules/clients/components/ClientRentalHistory.test.tsx`
- Test: `src/modules/client-comments/components/ClientCommentsPanel.test.tsx`
- Modify: `src/modules/clients/components/ClientDetailPage.tsx`
- Modify: `src/modules/rentals/components/RentalListPage.tsx`
- Modify: `src/app/(protected)/clients/[id]/loading.tsx`
- Modify: `src/app/(protected)/clients/[id]/error.tsx`

**Interfaces:**

- Consumes: Task 2 rental workspace and Task 3 comments/actions.
- Produces: responsive tab workspace under the client header.

- [ ] **Step 1: Write failing component tests**

```tsx
expect(screen.getByRole('tab', { name: 'Аренды 3' })).toBeTruthy();
expect(screen.getByText('ME-2026-0009-BK')).toBeTruthy();
expect(screen.getByRole('link', { name: 'Скачать PDF' })).toHaveAttribute(
  'href',
  '/rentals/rental-1/documents/1/PDF',
);
expect(screen.getByRole('textbox', { name: 'Комментарий' })).toBeTruthy();
```

- [ ] **Step 2: Run RED component tests**

Run: `npx vitest run src/modules/clients/components src/modules/client-comments/components`
Expected: FAIL with missing components.

- [ ] **Step 3: Implement accessible tabs and responsive rental history**

Use `role="tablist"`, `role="tab"`, `aria-selected`, URL hash-independent client state and 44px controls. Desktop uses a table; mobile uses cards. Each document link points only to the existing protected route.

- [ ] **Step 4: Implement comments panel**

Render category/severity badges, author, Moscow timestamp, rental link, pin/edit/hide controls according to server-provided capabilities. Use Pilot+ Button, Select, Card, Skeleton and Toast primitives.

- [ ] **Step 5: Preserve search filters in URL and visible values**

Pass current `query`, `status`, `from`, `to` values from `app/(protected)/rentals/page.tsx` to `RentalListPage`, render the search placeholder `Фамилия, договор, машина или госномер`, and add a distinct empty-search state with a reset link.

- [ ] **Step 6: Run GREEN UI tests and verification**

Run: `npx vitest run src/modules/clients/components src/modules/client-comments/components src/modules/rentals && npm run typecheck && npm run lint`
Expected: all tests PASS, typecheck PASS, lint has zero errors.

- [ ] **Step 7: Browser verification**

Open a real client at desktop and 390px width. Verify tabs, rental links, DOCX/PDF links, comment create/edit/pin/hide, no horizontal overflow, loading skeleton and tenant denial.

- [ ] **Step 8: Production build and commit**

Run: `npm run build && git diff --check`
Expected: build and diff check PASS.

```bash
git add src/modules/clients src/modules/client-comments src/modules/rentals src/app/(protected)/clients
git commit -m "feat(clients): add rental and comment workspace"
```
