# Client Reliability Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explainable five-star client reliability rating, automatic and manual rating events, and actionable problem notes to client cards and detail pages.

**Architecture:** Store every score change in an immutable tenant-scoped `ClientRatingEvent` ledger and derive a clamped 0–100 score from a 55-point baseline. Extend existing client comments with problem lifecycle and optional transactional rating impact, then expose one server projection consumed by reusable star and timeline components.

**Tech Stack:** Next.js 16.2 App Router and Server Actions, React 19.2, TypeScript strict mode, Prisma 6.16/PostgreSQL 17, Tailwind CSS 4, Vitest 3.

## Global Constraints

- New clients start at 55 points and display three stars with `Рейтинг формируется`.
- A normal note has no score impact unless `Учитывать в рейтинге` is explicitly enabled.
- Manual positive impact is `+1…+10`; manual negative impact is `−1…−30`.
- Unconfirmed fine candidates and synchronization errors never reduce the rating.
- Automatic events use a unique idempotency key and are applied once.
- Score is always clamped to `0…100`; stars always display with a number and text label.
- `SUPER_ADMIN`, `COMPANY_ADMIN`, and `DISPATCHER` may create notes; only administrators may change rating impact or hide arbitrary notes.
- `DRIVER` and `VIEWER` must not receive internal notes or rating explanations.
- All reads and writes enforce company boundaries on the server.
- No passport, phone, address, or decrypted document data may enter rating events or audit changes.
- Any Prisma schema change must include an additive migration and focused schema tests.

---

## File Structure

- `src/modules/client-rating/domain/rating.ts` — pure score, star, label, and event rules.
- `src/modules/client-rating/types.ts` — UI-safe projections and event types.
- `src/modules/client-rating/queries.ts` — tenant-scoped rating projection for client list/detail.
- `src/modules/client-rating/automatic-events.ts` — idempotent automatic event creation.
- `src/modules/client-rating/components/ClientRatingStars.tsx` — accessible compact stars.
- `src/modules/client-rating/components/ClientRatingPanel.tsx` — explanation and event timeline.
- Existing `client-comments` files remain responsible for note CRUD and gain lifecycle/rating fields.
- Existing `clients` page components only compose the new projections and components.

### Task 1: Rating ledger schema and pure domain

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260822120000_add_client_rating/migration.sql`
- Create: `src/database/prisma/client-rating-schema.test.ts`
- Create: `src/modules/client-rating/domain/rating.ts`
- Create: `src/modules/client-rating/domain/rating.test.ts`
- Create: `src/modules/client-rating/types.ts`

**Interfaces:**

- Produces: `calculateClientRating(events, completedRentals): ClientRatingSummary`
- Produces: `scoreToStars(score): number` and `ratingLabel(score, completedRentals): string`
- Produces Prisma models `ClientRatingEvent` and comment problem/rating fields.

- [ ] **Step 1: Write failing schema and domain tests**

```ts
expect(schema).toContain('model ClientRatingEvent {');
expect(schema).toMatch(/idempotencyKey\s+String\?\s+@unique/);
expect(schema).toMatch(/problemStatus\s+ClientCommentProblemStatus\?/);

expect(calculateClientRating([], 0)).toMatchObject({ score: 55, stars: 3 });
expect(calculateClientRating([{ delta: 50 }], 2).score).toBe(100);
expect(calculateClientRating([{ delta: -80 }], 1).score).toBe(0);
expect(scoreToStars(90)).toBe(5);
expect(ratingLabel(55, 0)).toBe('Рейтинг формируется');
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/database/prisma/client-rating-schema.test.ts src/modules/client-rating/domain/rating.test.ts`

Expected: FAIL because the model, migration, and domain functions do not exist.

- [ ] **Step 3: Add enums, relations, and immutable event ledger**

```prisma
enum ClientRatingEventSource {
  AUTOMATIC
  MANUAL
}

enum ClientRatingEventType {
  CLEAN_RENTAL
  ON_TIME_RETURN
  CLEAN_RENTAL_STREAK
  LATE_RETURN
  UNPAID_CONFIRMED_FINE
  DAMAGE
  CONTRACT_VIOLATION
  MANUAL_POSITIVE
  MANUAL_NEGATIVE
}

enum ClientCommentProblemStatus {
  OPEN
  RESOLVED
}

model ClientRatingEvent {
  id             String                  @id @default(cuid())
  companyId      String
  clientId       String
  source         ClientRatingEventSource
  type           ClientRatingEventType
  delta          Int
  description    String
  idempotencyKey String?                 @unique
  rentalId       String?
  fineId         String?
  vehicleId      String?
  commentId      String?                 @unique
  actorUserId    String?
  createdAt      DateTime                @default(now()) @db.Timestamptz(3)

  @@index([companyId, clientId, createdAt])
}
```

Add tenant-safe foreign keys in SQL, a `delta BETWEEN -50 AND 10` check, and a trigger that rejects `UPDATE` and `DELETE` on `ClientRatingEvent`. Add nullable `problemStatus`, `resolvedAt`, `resolvedByUserId`, `affectsRating`, and `ratingDelta` fields to `ClientComment`.

- [ ] **Step 4: Implement pure calculation**

```ts
const BASE_SCORE = 55;

export function calculateClientRating(
  events: ReadonlyArray<{ delta: number }>,
  completedRentals: number,
): ClientRatingSummary {
  const score = Math.max(0, Math.min(100, BASE_SCORE + events.reduce((n, e) => n + e.delta, 0)));
  return {
    score,
    stars: scoreToStars(score),
    display: (score / 20).toFixed(1).replace('.', ','),
    label: ratingLabel(score, completedRentals),
    completedRentals,
    eventCount: events.length,
  };
}
```

- [ ] **Step 5: Format Prisma, generate client, and run GREEN tests**

Run: `npx prisma format && npx prisma generate && npx vitest run src/database/prisma/client-rating-schema.test.ts src/modules/client-rating/domain/rating.test.ts`

Expected: both focused files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/database/prisma/schema.prisma src/database/prisma/migrations/20260822120000_add_client_rating src/database/prisma/client-rating-schema.test.ts src/modules/client-rating
git commit -m "feat(clients): add reliability rating ledger"
```

### Task 2: Tenant-scoped rating projection and automatic events

**Files:**

- Create: `src/modules/client-rating/queries.ts`
- Create: `src/modules/client-rating/queries.test.ts`
- Create: `src/modules/client-rating/automatic-events.ts`
- Create: `src/modules/client-rating/automatic-events.test.ts`
- Modify: `src/modules/rentals/operations/server/return-rental.ts`
- Modify: `src/modules/fines/server/assignment-actions.ts`

**Interfaces:**

- Consumes: `calculateClientRating(events, completedRentals)` from Task 1.
- Produces: `getClientRating(access, clientId): Promise<ClientRatingDto | null>`.
- Produces: `listClientRatings(access, clientIds): Promise<Map<string, ClientRatingSummary>>`.
- Produces: `recordAutomaticRatingEvent(transaction, input): Promise<boolean>`.

- [ ] **Step 1: Write failing tenant, idempotency, and fine-gate tests**

```ts
expect(await getClientRating(companyAAccess, companyBClientId)).toBeNull();
expect(await recordAutomaticRatingEvent(tx, cleanRental)).toBe(true);
expect(await recordAutomaticRatingEvent(tx, cleanRental)).toBe(false);
expect(createFineRatingInput({ assignment: 'CANDIDATE' })).toBeNull();
expect(createFineRatingInput({ assignment: 'CONFIRMED', overdue: false })).toBeNull();
expect(createFineRatingInput({ assignment: 'CONFIRMED', overdue: true })?.delta).toBe(-15);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/client-rating/queries.test.ts src/modules/client-rating/automatic-events.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement exact tenant projection**

```ts
export async function getClientRating(access: ClientAccess, clientId: string) {
  const client = await prisma.client.findFirst({
    where: scopedClientWhere(access, clientId),
    select: {
      id: true,
      _count: { select: { rentals: { where: { status: 'COMPLETED' } } } },
      ratingEvents: { select: { delta: true, type: true, description: true, createdAt: true } },
      comments: { where: { hiddenAt: null, problemStatus: 'OPEN' }, select: { severity: true } },
    },
  });
  if (!client) return null;
  return mapClientRating(client);
}
```

Keep list aggregation bounded to requested client IDs and do not load decrypted client fields.

- [ ] **Step 4: Implement idempotent automatic writer**

```ts
const result = await transaction.clientRatingEvent.createMany({
  data: [{ ...input, source: 'AUTOMATIC', actorUserId: null }],
  skipDuplicates: true,
});
return result.count === 1;
```

Use keys such as `rental:<id>:clean-completion`, `rental:<id>:on-time-return`, and `fine:<id>:confirmed-overdue`. The return transaction records clean/on-time events only after a committed return. Fine attribution records no score event; the overdue-fine worker/action records one only after exact confirmed client/rental binding and unpaid deadline.

- [ ] **Step 5: Run focused GREEN tests**

Run: `npx vitest run src/modules/client-rating/queries.test.ts src/modules/client-rating/automatic-events.test.ts src/modules/rentals/operations/server/return-rental.test.ts src/modules/fines/server/assignment-actions.test.ts`

Expected: all focused tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/client-rating src/modules/rentals/operations/server/return-rental.ts src/modules/rentals/operations/server/return-rental.test.ts src/modules/fines/server/assignment-actions.ts src/modules/fines/server/assignment-actions.test.ts
git commit -m "feat(clients): calculate automatic reliability events"
```

### Task 3: Transactional problem notes and manual rating impact

**Files:**

- Modify: `src/modules/client-comments/types.ts`
- Modify: `src/modules/client-comments/validation.ts`
- Modify: `src/modules/client-comments/validation.test.ts`
- Modify: `src/modules/client-comments/actions.ts`
- Modify: `src/modules/client-comments/actions.test.ts`
- Modify: `src/modules/client-comments/queries.ts`
- Modify: `src/modules/client-comments/queries.test.ts`

**Interfaces:**

- Consumes: immutable `ClientRatingEvent` from Task 1.
- Produces: expanded `ClientCommentDto` with `problemStatus`, `affectsRating`, `ratingDelta`, and `resolvedAt`.
- Produces: `resolveClientCommentAction(formData)`.

- [ ] **Step 1: Write failing validation and transaction tests**

```ts
expect(parseClientCommentInput({ affectsRating: false, ratingDelta: '' }).ok).toBe(true);
expect(
  parseClientCommentInput({
    affectsRating: true,
    ratingDelta: '-15',
    text: 'Отказывается оплачивать подтверждённый штраф',
  }).ok,
).toBe(true);
expect(parseClientCommentInput({ affectsRating: true, ratingDelta: '-31' }).ok).toBe(false);
expect(parseClientCommentInput({ affectsRating: true, ratingDelta: '0' }).ok).toBe(false);
expect(transaction.clientComment.create).toHaveBeenCalledBefore(
  transaction.clientRatingEvent.create,
);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/client-comments/validation.test.ts src/modules/client-comments/actions.test.ts src/modules/client-comments/queries.test.ts`

Expected: FAIL on missing fields, range validation, and resolve action.

- [ ] **Step 3: Extend validation with explicit rating switch**

```ts
const affectsRating = input.affectsRating === true || input.affectsRating === 'on';
const ratingDelta = affectsRating ? Number(input.ratingDelta) : null;
if (
  affectsRating &&
  (!Number.isInteger(ratingDelta) || ratingDelta === 0 || ratingDelta < -30 || ratingDelta > 10)
) {
  return { ok: false, message: 'Укажите влияние от −30 до +10, кроме нуля.' };
}
```

Set `problemStatus: 'OPEN'` only for problem, damage, payment, or violation categories. General and positive notes keep it null.

- [ ] **Step 4: Create note and manual event in one transaction**

```ts
const comment = await transaction.clientComment.create({ data: commentData, select: { id: true } });
if (parsed.data.affectsRating && parsed.data.ratingDelta !== null) {
  await transaction.clientRatingEvent.create({
    data: {
      companyId: client.companyId,
      clientId: client.id,
      source: 'MANUAL',
      type: parsed.data.ratingDelta > 0 ? 'MANUAL_POSITIVE' : 'MANUAL_NEGATIVE',
      delta: parsed.data.ratingDelta,
      description: parsed.data.text.slice(0, 160),
      commentId: comment.id,
      rentalId: parsed.data.rentalId,
      actorUserId: access.user.id,
    },
  });
}
```

Only `SYSTEM` or exact `COMPANY_ADMIN` membership may submit `affectsRating=true`, alter impact, or hide another author's note. Dispatcher notes remain available with no manual score impact.

- [ ] **Step 5: Implement resolution without rewriting history**

`resolveClientCommentAction` must use `updateMany` scoped by `id`, `companyId`, `clientId`, `hiddenAt: null`, and `problemStatus: 'OPEN'`, then write an audit entry. It sets `RESOLVED`, `resolvedAt`, and `resolvedByUserId`; it does not update or delete the rating event.

- [ ] **Step 6: Run focused GREEN tests and commit**

Run: `npx vitest run src/modules/client-comments/validation.test.ts src/modules/client-comments/actions.test.ts src/modules/client-comments/queries.test.ts`

Expected: all focused tests PASS.

```bash
git add src/modules/client-comments
git commit -m "feat(clients): add rated problem notes"
```

### Task 4: Five-star UI in client list and card

**Files:**

- Create: `src/modules/client-rating/components/ClientRatingStars.tsx`
- Create: `src/modules/client-rating/components/ClientRatingStars.test.tsx`
- Create: `src/modules/client-rating/components/ClientRatingPanel.tsx`
- Create: `src/modules/client-rating/components/ClientRatingPanel.test.tsx`
- Modify: `src/modules/clients/components/ClientCard.tsx`
- Modify: `src/modules/clients/components/ClientCard.test.tsx`
- Modify: `src/modules/clients/components/ClientDetailPage.tsx`
- Modify: `src/modules/clients/components/ClientDetailPage.test.tsx`
- Modify: `src/modules/clients/components/ClientPage.tsx`
- Modify: `src/app/(protected)/clients/[id]/page.tsx`
- Modify: `src/modules/client-comments/components/ClientCommentsPanel.tsx`
- Modify: `src/modules/client-comments/components/ClientCommentsPanel.test.tsx`

**Interfaces:**

- Consumes: `ClientRatingDto` from Task 2 and expanded comment DTO from Task 3.
- Produces: accessible `ClientRatingStars({ rating, compact })` and rating/event timeline UI.

- [ ] **Step 1: Write failing component tests**

```tsx
render(
  <ClientRatingStars rating={{ score: 84, stars: 4, display: '4,2', label: 'Надёжный клиент' }} />,
);
expect(screen.getByLabelText('Рейтинг клиента: 4,2 из 5')).toBeVisible();
expect(screen.getAllByTestId('rating-star')).toHaveLength(5);

expect(renderedClientCard).toHaveTextContent('4,2');
expect(renderedDetail).toHaveTextContent('1 открытое замечание');
expect(screen.getByLabelText('Учитывать в рейтинге')).toBeVisible();
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/client-rating/components src/modules/clients/components/ClientCard.test.tsx src/modules/clients/components/ClientDetailPage.test.tsx src/modules/client-comments/components/ClientCommentsPanel.test.tsx`

Expected: FAIL because rating components and props are absent.

- [ ] **Step 3: Build accessible five-star component**

```tsx
<div aria-label={`Рейтинг клиента: ${rating.display} из 5`} className="flex items-center gap-2">
  <span aria-hidden="true" className="flex text-amber-500">
    {Array.from({ length: 5 }, (_, index) => (
      <FiStar
        key={index}
        data-testid="rating-star"
        className={index < rating.stars ? 'fill-current' : 'opacity-25'}
      />
    ))}
  </span>
  <strong>{rating.display}</strong>
  {!compact ? <span>{rating.label}</span> : null}
</div>
```

Render it under the name in `ClientCard` and directly below the name/status row in `ClientDetailPage`. Keep five icons visible at all times and include a text fallback.

- [ ] **Step 4: Add rating explanation and problem controls**

`ClientRatingPanel` shows current score, completed rentals, open problems, and newest events. Extend `ClientCommentsPanel` with category labels `Выдача / возврат` and `Документы`, status badges `Открыта`/`Решена`, the explicit rating switch and bounded impact select/input, and a resolve button. Put right-side actions in one aligned row on desktop and a compact wrapping row on mobile.

- [ ] **Step 5: Wire list/detail server projections**

The list page calls `listClientRatings(access, visibleClientIds)` once and attaches ratings by client ID. The detail route loads `getClientRating` in its existing `Promise.all`. Do not make one query per client.

- [ ] **Step 6: Run focused GREEN tests and commit**

Run: `npx vitest run src/modules/client-rating/components src/modules/clients/components/ClientCard.test.tsx src/modules/clients/components/ClientDetailPage.test.tsx src/modules/client-comments/components/ClientCommentsPanel.test.tsx`

Expected: all focused component tests PASS.

```bash
git add src/modules/client-rating/components src/modules/clients/components src/modules/client-comments/components 'src/app/(protected)/clients/[id]/page.tsx'
git commit -m "feat(clients): show five-star reliability rating"
```

### Task 5: Integration verification and release notes

**Files:**

- Modify: `docs/PROJECT_GUIDE.md` only if its current user-owned changes can be preserved without overlap.
- Create: `docs/runbooks/client-rating.md`

**Interfaces:**

- Consumes all prior task outputs.
- Produces operator documentation and migration/rollback instructions.

- [ ] **Step 1: Add focused integration regression**

Add a server test that creates a 55-point client, records one clean completed rental (`+8`), one on-time return (`+2`), and one manual problem (`−15`), then expects score 50, three stars, one open problem, and no duplicate automatic events after replay.

- [ ] **Step 2: Run the complete focused suite**

Run:

```bash
npx vitest run src/database/prisma/client-rating-schema.test.ts src/modules/client-rating src/modules/client-comments src/modules/clients/components/ClientCard.test.tsx src/modules/clients/components/ClientDetailPage.test.tsx src/modules/rentals/operations/server/return-rental.test.ts src/modules/fines/server/assignment-actions.test.ts
```

Expected: all focused files PASS.

- [ ] **Step 3: Run static verification**

Run:

```bash
npx prisma format
npx prisma validate
npm run typecheck
npm run lint
npx prettier --check src/database/prisma/schema.prisma src/modules/client-rating src/modules/client-comments src/modules/clients/components docs/runbooks/client-rating.md
git diff --check
```

Expected: Prisma validation, typecheck, lint, formatting, and diff check all PASS. Existing unrelated warnings must be reported separately and must not be hidden.

- [ ] **Step 4: Write runbook**

Document additive migration deployment, score rules, role matrix, idempotency keys, how to resolve a problem, how to add a compensating event, and a read-only SQL verification query that compares cached score to ledger sum if caching is introduced.

- [ ] **Step 5: Commit**

```bash
git add docs/runbooks/client-rating.md
git commit -m "docs: add client rating operations runbook"
```

- [ ] **Step 6: Final review checkpoint**

Review tenant boundaries, manual-impact permissions, immutable event history, absence of PII in events/audits, five visible stars in both client surfaces, and exact evidence from focused tests. Do not apply migrations to a shared or production database during review.
