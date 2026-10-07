# Rental Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в раздел «Аренда» подтверждаемое бронирование с выбором/созданием клиента, проверкой доступности автомобиля, договором, фотографией чека и анимированным успешным завершением.

**Architecture:** Бронирование использует существующий жизненный цикл `Rental`: черновик — `DRAFT`, подтверждённая бронь — `CONFIRMED`, выдача — `ACTIVE`. Новая правая панель оркестрирует существующие расчёты и генерацию договора, а отдельный сервис безопасно прикрепляет проверенный чек к `RentalPayment`. Подтверждение повторно проверяет пересечение интервалов и финализирует БД идемпотентной транзакцией.

**Tech Stack:** Next.js 16.2 App Router и Server Actions, React 19.2, TypeScript strict, Prisma 6.16/PostgreSQL 17, Tailwind CSS 4 с токенами Pilot+, Framer Motion, Vitest 3, Playwright.

## Global Constraints

- Использовать существующую модель `Rental`; отдельную модель `Booking` не создавать.
- Использовать только токены и компоненты Pilot+; минимальный touch-target — 44 px.
- `CONFIRMED` и `ACTIVE` блокируют пересекающийся интервал; `DRAFT` не блокирует автомобиль.
- Подтверждённая бронь обязана иметь созданный договор и проверенный чек оплаты аренды.
- Залог не считать внесённым в момент бронирования; он фиксируется отдельно при выдаче.
- Конфетти показывать только после успешной серверной финализации и отключать движение при `prefers-reduced-motion`.
- Все запросы и записи остаются tenant-scoped, а загрузки проходят карантин и антивирусную проверку.

---

### Task 1: Семантика вкладки бронирований

**Files:**
- Modify: `src/modules/rentals/components/RentalListPage.tsx`
- Modify: `src/modules/rentals/components/RentalListPage.test.tsx`

**Interfaces:**
- Consumes: `RentalStatus.CONFIRMED`, текущий `queryString()` и представление строк аренды.
- Produces: ссылка `?status=CONFIRMED&booking=new`, подпись вкладки «Бронирования», кнопка «Новое бронирование».

- [ ] **Step 1: Написать падающий component-тест**

```tsx
expect(screen.getByRole('link', { name: 'Бронирования' })).toHaveAttribute(
  'href',
  expect.stringContaining('status=CONFIRMED'),
);
expect(screen.getByRole('link', { name: 'Новое бронирование' })).toHaveAttribute(
  'href',
  '/rentals?status=CONFIRMED&booking=new',
);
expect(screen.queryByText('Ожидают выдачи')).toBeNull();
```

- [ ] **Step 2: Запустить тест и подтвердить ожидаемое падение**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx`

Expected: FAIL — ссылки «Бронирования» и «Новое бронирование» отсутствуют.

- [ ] **Step 3: Изменить заголовок и вкладку минимальным патчем**

```tsx
<Link href="/rentals?status=CONFIRMED&booking=new" className={outlineBookingButton}>
  <FiCalendar aria-hidden /> Новое бронирование
</Link>
<Link href="/rentals/new" className={primaryButton}>
  <FiPlusCircle aria-hidden /> Новый договор
</Link>
```

Заменить пользовательские подписи «Ожидают выдачи» на «Бронирования», сохранив фильтр `CONFIRMED` и доступный счётчик.

- [ ] **Step 4: Запустить тест**

Run: `npx vitest run src/modules/rentals/components/RentalListPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/rentals/components/RentalListPage.tsx src/modules/rentals/components/RentalListPage.test.tsx
git commit -m "feat: present confirmed rentals as bookings"
```

### Task 2: Защищённое хранение фотографии чека

**Files:**
- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20261007120000_add_rental_payment_receipts/migration.sql`
- Create: `src/modules/rentals/booking/server/payment-receipt.ts`
- Create: `src/modules/rentals/booking/server/payment-receipt.test.ts`

**Interfaces:**
- Produces: `admitBookingReceipt(input): Promise<AdmittedBookingReceipt>` и Prisma-модель `RentalPaymentReceipt` с tenant-scoped связью на `RentalPayment`.
- `AdmittedBookingReceipt`: `{ storageKey: string; originalName: string; verifiedMime: string; bytes: number; sha256: string; scanEngine: string; signatureVersion: string; scannedAt: Date }`.

- [ ] **Step 1: Написать падающие тесты сервиса**

```ts
it('rejects a non-image receipt before storage promotion', async () => {
  await expect(admitBookingReceipt(input({ type: 'application/pdf' }))).rejects.toThrow(
    'CHECK_RECEIPT_INVALID',
  );
});

it('returns CLEAN scan metadata for a JPEG receipt', async () => {
  await expect(admitBookingReceipt(input({ type: 'image/jpeg' }))).resolves.toMatchObject({
    verifiedMime: 'image/jpeg',
    storageKey: expect.stringContaining('/rental-payment-receipts/'),
  });
});
```

- [ ] **Step 2: Запустить тест и подтвердить падение**

Run: `npx vitest run src/modules/rentals/booking/server/payment-receipt.test.ts`

Expected: FAIL — модуль отсутствует.

- [ ] **Step 3: Добавить Prisma-модель и SQL-миграцию**

```prisma
model RentalPaymentReceipt {
  id               String        @id @default(cuid())
  companyId        String
  paymentId        String
  payment          RentalPayment @relation(fields: [companyId, paymentId], references: [companyId, id], onDelete: Cascade)
  storageKey       String        @unique
  originalName     String
  verifiedMime     String
  bytes            Int
  sha256           String
  scanEngine       String
  signatureVersion String
  scannedAt        DateTime      @db.Timestamptz(3)
  createdAt        DateTime      @default(now()) @db.Timestamptz(3)

  @@unique([companyId, paymentId, id])
  @@index([companyId, paymentId, createdAt])
}
```

Добавить `receipts RentalPaymentReceipt[]` в `RentalPayment`; SQL должен создать таблицу, составной внешний ключ и индексы без изменения существующих данных.

- [ ] **Step 4: Реализовать admission-сервис**

Использовать `LocalPrivateStorage`, `ClamAvClient` и `scanPendingUpload`. Разрешить JPEG, PNG и WebP, ограничить файл 10 MiB, формировать ключ `companies/{companyId}/rentals/{rentalId}/rental-payment-receipts/{uploadId}.{ext}`. При ошибке удалять карантинный или продвинутый файл.

- [ ] **Step 5: Проверить Prisma и тесты**

Run: `npx prisma validate && npx prisma generate && npx vitest run src/modules/rentals/booking/server/payment-receipt.test.ts`

Expected: Prisma valid, generated successfully, PASS.

- [ ] **Step 6: Commit**

```bash
git add src/database/prisma src/modules/rentals/booking/server/payment-receipt.ts src/modules/rentals/booking/server/payment-receipt.test.ts
git commit -m "feat: store verified rental payment receipts"
```

### Task 3: Запрос данных и серверное подтверждение брони

**Files:**
- Create: `src/modules/rentals/booking/types.ts`
- Create: `src/modules/rentals/booking/server/queries.ts`
- Create: `src/modules/rentals/booking/server/actions.ts`
- Create: `src/modules/rentals/booking/server/actions.test.ts`
- Modify: `src/modules/rentals/server/draft-vehicle-options.ts`

**Interfaces:**
- Produces: `getBookingWorkspace(access, query): Promise<BookingWorkspaceData>`.
- Produces: `saveBookingDraftAction(previous, formData): Promise<BookingActionState>`.
- Produces: `confirmBookingAction(previous, formData): Promise<BookingActionState>`.
- `BookingActionState`: `{ ok: true; rentalId: string; contractNumber: string } | { ok: false; code: 'VALIDATION' | 'VEHICLE_UNAVAILABLE' | 'DOCUMENT_FAILED' | 'RECEIPT_FAILED' | 'FORBIDDEN'; fieldErrors?: Record<string,string> }`.

- [ ] **Step 1: Написать падающие серверные тесты**

```ts
it('does not let a confirmed booking overlap a confirmed or active rental', async () => {
  await expect(confirmBookingAction(null, validForm())).resolves.toMatchObject({
    ok: false,
    code: 'VEHICLE_UNAVAILABLE',
  });
});

it('confirms contract, rent payment and receipt once', async () => {
  await expect(confirmBookingAction(null, validForm())).resolves.toMatchObject({
    ok: true,
    rentalId: 'rental-1',
  });
  expect(transaction.rental.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) }),
  );
  expect(transaction.rentalPayment.create).toHaveBeenCalledTimes(1);
  expect(transaction.rentalPaymentReceipt.create).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Запустить тест и подтвердить падение**

Run: `npx vitest run src/modules/rentals/booking/server/actions.test.ts`

Expected: FAIL — actions отсутствуют.

- [ ] **Step 3: Реализовать типизированный query**

Вернуть до 30 найденных активных клиентов и только rental-ready автомобили вместе с главным фото, ценой, залогом и интервалами `CONFIRMED`/`ACTIVE`. Поиск клиента выполняется сервером по существующему tenant-scoped механизму.

- [ ] **Step 4: Реализовать черновик и подтверждение**

Переиспользовать `calculateRental`, генерацию документа и проверку `intervalsOverlap`. На финальном подтверждении внутри serializable-транзакции повторно запросить пересечения, создать `RENT` payment со стабильным idempotency key, создать receipt relation, подтвердить подписи/документ и установить `CONFIRMED`. `depositStatus` и `DEPOSIT` payment здесь не создавать.

- [ ] **Step 5: Проверить серверные тесты**

Run: `npx vitest run src/modules/rentals/booking/server/actions.test.ts src/modules/rentals/domain/availability.test.ts src/modules/rentals/domain/calculate-rental.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/rentals/booking src/modules/rentals/server/draft-vehicle-options.ts
git commit -m "feat: add booking confirmation workflow"
```

### Task 4: Создание клиента внутри бронирования

**Files:**
- Modify: `src/modules/clients/actions.ts`
- Modify: `src/modules/clients/actions.test.ts`
- Create: `src/modules/rentals/booking/components/BookingClientStep.tsx`
- Create: `src/modules/rentals/booking/components/BookingClientStep.test.tsx`

**Interfaces:**
- Produces: успешный результат `createClientAction` с `client: { id: string; fullName: string; phone: string | null }` без изменения поведения существующих потребителей.
- Produces: `BookingClientStep` с `onSelect(client)` и встроенным переключением поиска/создания.

- [ ] **Step 1: Написать падающие тесты результата и UI**

```ts
expect(await createClientAction(null, validClientForm())).toMatchObject({
  ok: true,
  client: { id: 'client-1', fullName: 'Иванов Иван Иванович' },
});
```

```tsx
await user.click(screen.getByRole('button', { name: 'Создать нового' }));
expect(screen.getByRole('heading', { name: 'Новый клиент' })).toBeVisible();
```

- [ ] **Step 2: Запустить тесты и подтвердить падение**

Run: `npx vitest run src/modules/clients/actions.test.ts src/modules/rentals/booking/components/BookingClientStep.test.tsx`

Expected: FAIL на новом контракте ответа и отсутствующем компоненте.

- [ ] **Step 3: Расширить безопасный ответ action и реализовать шаг**

Вернуть только публичные поля созданного клиента. В UI использовать поля и правила существующего `ClientForm`, но после успеха не перенаправлять страницу: выбрать клиента и вернуться к шагам брони.

- [ ] **Step 4: Запустить тесты**

Run: `npx vitest run src/modules/clients/actions.test.ts src/modules/clients/components/ClientForm.test.tsx src/modules/rentals/booking/components/BookingClientStep.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/clients src/modules/rentals/booking/components/BookingClientStep.tsx src/modules/rentals/booking/components/BookingClientStep.test.tsx
git commit -m "feat: create clients inside booking flow"
```

### Task 5: Правая форма бронирования в дизайн-системе Pilot+

**Files:**
- Create: `src/modules/rentals/booking/components/RentalBookingDrawer.tsx`
- Create: `src/modules/rentals/booking/components/RentalBookingDrawer.test.tsx`
- Create: `src/modules/rentals/booking/components/BookingSuccess.tsx`
- Create: `src/modules/rentals/booking/components/BookingSuccess.test.tsx`
- Modify: `src/app/(protected)/rentals/page.tsx`
- Modify: `src/app/(protected)/rentals/page.test.tsx`

**Interfaces:**
- Consumes: `BookingWorkspaceData`, `saveBookingDraftAction`, `confirmBookingAction`, `BookingClientStep`.
- Produces: drawer controlled by `booking=new`, four steps and success state.

- [ ] **Step 1: Написать падающие component-тесты**

```tsx
expect(screen.getByRole('dialog', { name: 'Новое бронирование' })).toBeVisible();
expect(screen.getAllByRole('listitem')).toHaveLength(4);
expect(screen.getByRole('button', { name: 'Создать бронирование' })).toBeDisabled();
```

После mock-успеха:

```tsx
expect(screen.getByText('Бронирование создано')).toBeVisible();
expect(screen.getByTestId('booking-confetti')).toBeVisible();
```

- [ ] **Step 2: Запустить тесты и подтвердить падение**

Run: `npx vitest run src/modules/rentals/booking/components src/app/'(protected)'/rentals/page.test.tsx`

Expected: FAIL — компоненты отсутствуют.

- [ ] **Step 3: Реализовать четыре шага**

Использовать `Drawer` на `sm+` и адаптированный `BottomSheet`/полноэкранный слой на телефоне. Шаги: клиент; автомобиль; даты и цена; договор и чек. Секции используют `bg-[var(--color-elevated)]`, существующие радиусы, `Button`, `Badge`, tabular numbers и размеры текста списка аренды.

- [ ] **Step 4: Реализовать success-state**

```tsx
const reduceMotion = useReducedMotion();
return (
  <motion.section initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
    {!reduceMotion && <ConfettiBurst data-testid="booking-confetti" />}
    <FiCheckCircle aria-hidden />
    <h2>Бронирование создано</h2>
  </motion.section>
);
```

`ConfettiBurst` — не более 18 небольших DOM-частиц, один цикл до 700 ms, цвета только `primary`, `success`, `warning`; при reduced motion частицы не рендерить.

- [ ] **Step 5: Проверить component-тесты**

Run: `npx vitest run src/modules/rentals/booking/components src/app/'(protected)'/rentals/page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/rentals/booking/components src/app/'(protected)'/rentals
git commit -m "feat: add Pilot booking drawer and success motion"
```

### Task 6: Выдача, отмена и мобильный end-to-end сценарий

**Files:**
- Modify: `src/modules/rentals/components/RentalRowActionsMenu.tsx`
- Modify: `src/modules/rentals/components/RentalRowActionsMenu.test.tsx`
- Modify: `src/modules/rentals/components/RentalListPage.tsx`
- Create: `e2e/rental-booking.spec.ts`

**Interfaces:**
- Consumes: существующий handover flow `CONFIRMED → ACTIVE`.
- Produces: действия «Выдать автомобиль», «Открыть», «Отменить бронирование» и проверенный desktop/mobile поток.

- [ ] **Step 1: Написать падающие тесты действий**

```tsx
expect(screen.getByRole('link', { name: 'Выдать автомобиль' })).toHaveAttribute(
  'href',
  '/rentals/rental-1#rental-actions',
);
expect(screen.getByRole('menuitem', { name: 'Отменить бронирование' })).toBeVisible();
```

- [ ] **Step 2: Реализовать действия без дублирования выдачи**

Для `CONFIRMED` использовать существующую операцию HANDOVER. Отмена вызывает tenant-scoped action, устанавливает `CANCELLED`, пишет audit log и освобождает интервал.

- [ ] **Step 3: Добавить Playwright-сценарий**

```ts
test('создаёт бронь и выдаёт автомобиль без повторного ввода', async ({ page }) => {
  await page.goto('/rentals?status=CONFIRMED&booking=new');
  await page.getByRole('button', { name: 'Создать бронирование' }).click();
  await expect(page.getByText('Бронирование создано')).toBeVisible();
  await page.getByRole('link', { name: 'Открыть бронирование' }).click();
  await expect(page.getByRole('button', { name: 'Выдать автомобиль' })).toBeVisible();
});
```

Повторить ключевую проверку в viewport 390×844 и убедиться, что нижние действия видимы и карта/таблица не перекрывают форму.

- [ ] **Step 4: Запустить целевые и общие проверки**

Run: `npm run typecheck && npm run lint && npm run test:unit && npm run build`

Expected: все команды завершаются с кодом 0.

Run: `npx playwright test e2e/rental-booking.spec.ts`

Expected: PASS на desktop и mobile проекта.

- [ ] **Step 5: Commit**

```bash
git add src/modules/rentals e2e/rental-booking.spec.ts
git commit -m "feat: complete rental booking lifecycle"
```
