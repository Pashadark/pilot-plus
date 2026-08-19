# Pilot+ Telegram Bot MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать первую рабочую версию Telegram-бота, в которой клиент безопасно привязывается к Pilot+, видит свои аренды, отправляет заявку на аренду или продление, а сотрудники получают durable-уведомления.

**Architecture:** Python 3.12+/aiogram-бот работает через versioned HTTPS Route Handlers Pilot+ и никогда не подключается к PostgreSQL напрямую. Pilot+ остаётся единственным источником клиентов, автомобилей, аренд, ТО, документов, ролей и заявок; Redis бота хранит только краткоживущее FSM-состояние.

**Tech Stack:** Next.js 16.2 Route Handlers, TypeScript 5, Prisma 6.16/PostgreSQL 17, Zod 4, Python 3.12+, aiogram 3, httpx, pydantic-settings, Redis, pytest.

## Global Constraints

- Бот не хранит собственные копии клиентов, машин, договоров, аренд или ТО.
- Бот не имеет прямого подключения к PostgreSQL Pilot+.
- Все Telegram-клавиатуры, кнопки и callback-константы находятся только в `bot/keyboards`.
- Backend повторно определяет tenant, identity и capability; значения роли/company/client из Telegram не считаются доверенными.
- Секреты находятся только в `.env`, не попадают в Git, callback data, ответы или логи.
- Команды записи используют idempotency key.
- Документы выдаются только короткоживущей tenant-scoped ссылкой Pilot+.
- API-ответы содержат `Cache-Control: private, no-store`.
- Первая версия использует long polling; webhook не требуется.
- Разработка выполняется тестами RED → GREEN; каждая задача заканчивается отдельным коммитом.

---

## File Map

### Pilot+ backend

- `src/database/prisma/schema.prisma` — постоянные Telegram-привязки, одноразовые приглашения, заявки клиента и очередь уведомлений.
- `src/database/prisma/migrations/20260819120000_add_telegram_bot_mvp/migration.sql` — additive/rolling-safe DDL и ограничения.
- `src/modules/bot-api/auth.ts` — проверка service token и разрешение Telegram identity.
- `src/modules/bot-api/invitations.ts` — выпуск и атомарное погашение одноразовых приглашений.
- `src/modules/bot-api/contracts.ts` — Zod-контракты API без PII в ошибках.
- `src/modules/bot-api/queries.ts` — tenant-scoped меню, аренды, документы и доступность.
- `src/modules/bot-api/rental-requests.ts` — идемпотентное создание новой заявки/продления.
- `src/modules/bot-api/notifications.ts` — постановка и выборка durable notification jobs.
- `src/app/api/bot/v1/*/route.ts` — тонкие versioned Route Handlers.

### Python bot

- `bot/config.py` — обязательные настройки окружения.
- `bot/main.py` — Bot/Dispatcher/RedisStorage и подключение роутеров.
- `bot/services/pilot_api.py` — единственный HTTP-клиент Pilot+.
- `bot/keyboards/*.py` — все клавиатуры и callback-константы.
- `bot/handlers/start.py` — deep-link привязка и стартовое меню.
- `bot/handlers/rentals.py` — просмотр аренд, новая заявка и продление.
- `bot/states/rental.py` — FSM новой аренды/продления.
- `bot/formatters/*.py` — HTML-safe сообщения.
- `bot/tests/*.py` — unit/API-client/handler tests.

---

### Task 1: Telegram identity, invitation, request and notification schema

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260819120000_add_telegram_bot_mvp/migration.sql`
- Create: `src/database/prisma/telegram-bot-schema.test.ts`

**Interfaces:**

- Produces: `TelegramIdentity`, `TelegramInvite`, `BotRentalRequest`, `BotNotificationJob` Prisma models.
- Produces: enums `TelegramIdentityKind`, `BotRentalRequestStatus`, `BotFulfillmentMode`, `BotNotificationStatus`.
- Produces: explicit `MaintenanceRecord.scheduledEndsAt` so availability never guesses a maintenance duration.

- [ ] **Step 1: Write the failing schema test**

```ts
it('adds tenant-scoped Telegram bot lifecycle tables and XOR identity ownership', () => {
  expect(schema).toContain('model TelegramIdentity');
  expect(schema).toContain('telegramUserId String');
  expect(schema).toContain('@@unique([companyId, telegramUserId])');
  expect(schema).toContain('model TelegramInvite');
  expect(schema).toContain('tokenHash String @unique');
  expect(schema).toContain('model BotRentalRequest');
  expect(schema).toContain('idempotencyKey String');
  expect(schema).toContain('model BotNotificationJob');
  expect(schema).toContain('scheduledEndsAt DateTime?');
  expect(migration).toContain('CHECK (("userId" IS NOT NULL) <> ("clientId" IS NOT NULL))');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/database/prisma/telegram-bot-schema.test.ts --maxWorkers=1`  
Expected: FAIL because the models and migration do not exist.

- [ ] **Step 3: Add the minimal Prisma models and additive SQL migration**

Use these stable fields:

```prisma
model TelegramIdentity {
  id             String               @id @default(cuid())
  companyId      String
  telegramUserId String
  kind           TelegramIdentityKind
  userId         String?
  clientId       String?
  isActive       Boolean              @default(true)
  createdAt      DateTime             @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime             @updatedAt @db.Timestamptz(3)

  @@unique([companyId, telegramUserId])
  @@unique([companyId, userId])
  @@unique([companyId, clientId])
}

model TelegramInvite {
  id             String               @id @default(cuid())
  companyId      String
  kind           TelegramIdentityKind
  targetId       String
  tokenHash      String               @unique
  expiresAt      DateTime             @db.Timestamptz(3)
  usedAt         DateTime?            @db.Timestamptz(3)
  createdByUserId String
  createdAt      DateTime             @default(now()) @db.Timestamptz(3)

  @@index([companyId, targetId, expiresAt])
}

model BotRentalRequest {
  id                 String                 @id @default(cuid())
  companyId          String
  clientId           String
  rentalId           String?
  preferredVehicleId String?
  startsAt           DateTime               @db.Timestamptz(3)
  endsAt             DateTime               @db.Timestamptz(3)
  fulfillmentMode    BotFulfillmentMode
  deliveryAddressEncrypted String?
  commentEncrypted   String?
  status             BotRentalRequestStatus @default(PENDING)
  idempotencyKey     String
  decidedByUserId    String?
  decidedAt          DateTime?              @db.Timestamptz(3)
  createdAt          DateTime               @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime               @updatedAt @db.Timestamptz(3)

  @@unique([companyId, idempotencyKey])
  @@index([companyId, status, createdAt])
}

model BotNotificationJob {
  id          String                @id @default(cuid())
  companyId   String
  identityId  String?
  chatId      String?
  eventKey    String                @unique
  template    String
  payload     Json
  status      BotNotificationStatus @default(PENDING)
  claimToken  String?               @unique
  leaseExpiresAt DateTime?          @db.Timestamptz(3)
  availableAt DateTime              @db.Timestamptz(3)
  attempts    Int                   @default(0)
  sentAt      DateTime?             @db.Timestamptz(3)
  lastErrorCode String?
  createdAt   DateTime              @default(now()) @db.Timestamptz(3)

  @@index([status, availableAt])
}
```

Migration must add foreign keys to `Company`, `User`, `Client`, `Vehicle`, and `Rental`, plus an XOR check on identity ownership. Do not apply the migration to a shared database.
The same additive migration adds `MaintenanceRecord.scheduledEndsAt DateTime? @db.Timestamptz(3)` and an index on `[vehicleId, scheduledAt, scheduledEndsAt]`.

- [ ] **Step 4: Verify schema GREEN**

Run:

```powershell
npx prisma format
$env:DATABASE_URL='postgresql://pilot:pilot@127.0.0.1:5433/pilot'; npx prisma validate
npx prisma generate
npx vitest run src/database/prisma/telegram-bot-schema.test.ts --maxWorkers=1
```

Expected: Prisma commands exit 0 and schema test PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/database/prisma/schema.prisma src/database/prisma/migrations/20260819120000_add_telegram_bot_mvp src/database/prisma/telegram-bot-schema.test.ts
git commit -m "feat(bot): add Telegram workflow schema"
```

---

### Task 2: Service authentication and one-time identity linking

**Files:**

- Create: `src/modules/bot-api/auth.ts`
- Create: `src/modules/bot-api/auth.test.ts`
- Create: `src/modules/bot-api/invitations.ts`
- Create: `src/modules/bot-api/invitations.test.ts`
- Create: `src/modules/bot-api/contracts.ts`
- Create: `src/app/api/bot/v1/link/route.ts`
- Create: `src/app/api/bot/v1/link/route.test.ts`
- Modify: `.env.example`

**Interfaces:**

- Produces: `authenticateBotRequest(request: Request): BotServiceAuth`.
- Produces: `linkTelegramIdentity(input: LinkIdentityInput): Promise<BotProfile>`.
- Consumes: Task 1 Prisma models.

- [ ] **Step 1: Write failing tests for authentication and invite consumption**

```ts
it('rejects a missing or wrong service token without querying identity', async () => {
  await expect(authenticateBotRequest(new Request(url))).rejects.toMatchObject({ status: 401 });
});

it('consumes one valid invite once and binds the exact Telegram user id', async () => {
  const profile = await linkTelegramIdentity({ inviteToken: rawToken, telegramUserId: '12345' });
  expect(profile).toMatchObject({ kind: 'CLIENT', clientId: 'client-1' });
  await expect(
    linkTelegramIdentity({ inviteToken: rawToken, telegramUserId: '999' }),
  ).rejects.toMatchObject({ code: 'INVITE_INVALID' });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run src/modules/bot-api/auth.test.ts src/modules/bot-api/invitations.test.ts src/app/api/bot/v1/link/route.test.ts --maxWorkers=1`  
Expected: FAIL due to missing modules/routes.

- [ ] **Step 3: Implement constant-time service auth and transactional linking**

`authenticateBotRequest` must:

```ts
export interface BotServiceAuth {
  service: 'TELEGRAM_BOT';
}

export async function authenticateBotRequest(request: Request): Promise<BotServiceAuth> {
  const header = request.headers.get('authorization');
  const expected = process.env.PILOT_BOT_SERVICE_TOKEN;
  if (!expected || !header?.startsWith('Bearer ') || !safeEqual(header.slice(7), expected)) {
    throw new BotApiError('UNAUTHORIZED', 401);
  }
  return { service: 'TELEGRAM_BOT' };
}
```

`linkTelegramIdentity` hashes the invite token with SHA-256 and performs a Serializable transaction that:

1. finds unused/unexpired invite;
2. verifies target belongs to the invite company and is active/not archived;
3. creates or safely returns the exact same Telegram binding;
4. rejects any binding to another target;
5. sets `usedAt` conditionally;
6. writes a PII-free `AuditLog`.

The route parses `{ inviteToken, telegramUserId }` with Zod, returns only safe profile fields, sets `Cache-Control: private, no-store`, and never echoes the token.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/modules/bot-api/auth.test.ts src/modules/bot-api/invitations.test.ts src/app/api/bot/v1/link/route.test.ts --maxWorkers=1`  
Expected: all tests PASS.

- [ ] **Step 5: Add documented secret names**

Append names without values:

```dotenv
PILOT_BOT_SERVICE_TOKEN=
PILOT_BOT_INVITE_SECRET=
PILOT_BOT_API_BASE_URL=http://127.0.0.1:3001
```

- [ ] **Step 6: Commit**

```powershell
git add src/modules/bot-api src/app/api/bot/v1/link .env.example
git commit -m "feat(bot): link Telegram identities securely"
```

---

### Task 3: Client profile, rentals and protected document links API

**Files:**

- Create: `src/modules/bot-api/queries.ts`
- Create: `src/modules/bot-api/queries.test.ts`
- Create: `src/app/api/bot/v1/me/route.ts`
- Create: `src/app/api/bot/v1/rentals/route.ts`
- Create: `src/app/api/bot/v1/rentals/[id]/documents/route.ts`
- Create: `src/app/api/bot/v1/client-routes.test.ts`

**Interfaces:**

- Produces: `resolveBotIdentity(telegramUserId): BotIdentityContext`.
- Produces: `listClientRentals(identity): BotRentalSummary[]`.
- Produces: `createRentalDocumentGrant(identity, rentalId): { url; expiresAt }[]`.
- Consumes: Task 2 authentication and Task 1 identity.

- [ ] **Step 1: Write failing tenant-boundary tests**

```ts
it('returns only rentals owned by the linked client in the linked company', async () => {
  const result = await listClientRentals(clientIdentity);
  expect(result.map((r) => r.id)).toEqual(['own-rental']);
});

it('does not grant a document from another client or company', async () => {
  await expect(createRentalDocumentGrant(clientIdentity, 'foreign-rental')).rejects.toMatchObject({
    status: 404,
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run src/modules/bot-api/queries.test.ts src/app/api/bot/v1/client-routes.test.ts --maxWorkers=1`  
Expected: FAIL because queries and routes do not exist.

- [ ] **Step 3: Implement safe DTO queries**

Rental DTO:

```ts
export interface BotRentalSummary {
  id: string;
  contractNumber: string | null;
  status: RentalStatus;
  startsAt: string;
  endsAt: string;
  vehicle: { make: string; model: string; registrationNumber: string };
  totalPriceMinor: string;
  depositMinor: string | null;
  documentsReady: boolean;
}
```

All queries include `companyId`, `clientId`, active identity and non-archived client constraints. Document grants must be signed server-side, expire within 5 minutes, reference exact rental/document version and reuse the existing protected download route rather than exposing `storageKey`.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/modules/bot-api/queries.test.ts src/app/api/bot/v1/client-routes.test.ts --maxWorkers=1`  
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/bot-api/queries.ts src/modules/bot-api/queries.test.ts src/app/api/bot/v1/me src/app/api/bot/v1/rentals
git commit -m "feat(bot): expose client rental API"
```

---

### Task 4: Availability and idempotent rental/extension requests

**Files:**

- Create: `src/modules/bot-api/rental-requests.ts`
- Create: `src/modules/bot-api/rental-requests.test.ts`
- Create: `src/app/api/bot/v1/availability/route.ts`
- Create: `src/app/api/bot/v1/rental-requests/route.ts`
- Create: `src/app/api/bot/v1/rental-requests/[id]/decision/route.ts`
- Create: `src/app/api/bot/v1/rental-requests/route.test.ts`
- Modify: `src/modules/rentals/domain/availability.ts`
- Modify: `src/modules/rentals/domain/availability.test.ts`

**Interfaces:**

- Produces: `listBotAvailability(identity, interval): BotAvailableVehicle[]`.
- Produces: `createBotRentalRequest(identity, input, idempotencyKey): BotRentalRequestDto`.
- Produces: `decideBotRentalRequest(staffIdentity, requestId, decision): BotRentalRequestDto`.
- Consumes: Task 3 identity and Task 1 request model.

- [ ] **Step 1: Write failing availability and idempotency tests**

```ts
it('excludes a vehicle with overlapping confirmed rental or scheduled maintenance', async () => {
  const result = await listBotAvailability(identity, interval);
  expect(result.map((v) => v.id)).toEqual(['free-vehicle']);
});

it('returns the same request for a repeated company idempotency key', async () => {
  const first = await createBotRentalRequest(identity, input, 'tg-update-77');
  const second = await createBotRentalRequest(identity, input, 'tg-update-77');
  expect(second.id).toBe(first.id);
});

it('lets an authorized dispatcher approve once and rejects a conflicting request', async () => {
  const approved = await decideBotRentalRequest(dispatcherIdentity, 'request-1', 'APPROVE');
  expect(approved.status).toBe('APPROVED');
  await expect(
    decideBotRentalRequest(foreignDispatcher, 'request-1', 'REJECT'),
  ).rejects.toMatchObject({ status: 404 });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run src/modules/rentals/domain/availability.test.ts src/modules/bot-api/rental-requests.test.ts src/app/api/bot/v1/rental-requests/route.test.ts --maxWorkers=1`  
Expected: FAIL because maintenance intervals and request use-case are missing.

- [ ] **Step 3: Extend availability with bounded maintenance intervals**

Use half-open intervals `[startsAt, endsAt)` for rentals and the explicit `MaintenanceRecord.scheduledAt`/`scheduledEndsAt` window created in Task 1. A maintenance record without a complete window does not invent a duration; a vehicle already in `MAINTENANCE` remains unavailable through its current status.

- [ ] **Step 4: Implement request creation**

Input contract:

```ts
const requestSchema = z.object({
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  preferredVehicleId: z.string().cuid().nullable(),
  fulfillmentMode: z.enum(['OFFICE', 'DELIVERY']),
  deliveryAddress: z.string().trim().min(5).max(500).nullable(),
  comment: z.string().trim().max(1000).nullable(),
  rentalId: z.string().cuid().nullable(),
});
```

The Serializable transaction reloads identity/client/vehicle/rental, validates `startsAt < endsAt`, ensures extension belongs to the client, encrypts address/comment, checks current availability, creates one `BotRentalRequest`, writes a PII-free audit, and enqueues a dispatcher notification. Route requires `Idempotency-Key` matching `^[A-Za-z0-9_-]{8,128}$`.

The decision transaction accepts only an active `DISPATCHER`, `COMPANY_ADMIN` or `SUPER_ADMIN` in the request company. Approval reloads availability, creates/updates the linked Pilot+ rental draft, marks the request `APPROVED` and enqueues the client notification atomically. A conflict returns `409 AVAILABILITY_CHANGED`; rejection records a bounded non-PII reason and marks `REJECTED`. Repeating the same decision returns the existing result.

- [ ] **Step 5: Verify GREEN**

Run: `npx vitest run src/modules/rentals/domain/availability.test.ts src/modules/bot-api/rental-requests.test.ts src/app/api/bot/v1/rental-requests/route.test.ts --maxWorkers=1`  
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/rentals/domain/availability.* src/modules/bot-api/rental-requests.* src/app/api/bot/v1/availability src/app/api/bot/v1/rental-requests
git commit -m "feat(bot): accept conflict-safe rental requests"
```

---

### Task 5: Python bot foundation and Pilot+ API client

**Files:**

- Create: `bot/pyproject.toml`
- Create: `bot/.env.example`
- Create: `bot/config.py`
- Create: `bot/main.py`
- Create: `bot/services/pilot_api.py`
- Create: `bot/services/errors.py`
- Create: `bot/tests/test_config.py`
- Create: `bot/tests/test_pilot_api.py`
- Modify: `.gitignore`

**Interfaces:**

- Produces: `Settings`, `PilotApiClient`, `PilotApiError`.
- Consumes: Tasks 2–4 `/api/bot/v1` contracts.

- [ ] **Step 1: Write failing configuration and HTTP client tests**

```python
def test_settings_reject_missing_secrets(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    with pytest.raises(ValidationError):
        Settings()

async def test_client_sends_only_server_token_identity_and_idempotency(httpx_mock):
    await client.create_rental_request("123", payload, "tg-update-77")
    request = httpx_mock.get_request()
    assert request.headers["Authorization"] == "Bearer service-secret"
    assert request.headers["X-Telegram-User-Id"] == "123"
    assert request.headers["Idempotency-Key"] == "tg-update-77"
```

- [ ] **Step 2: Run pytest and verify RED**

Run: `python -m pytest bot/tests/test_config.py bot/tests/test_pilot_api.py -q`  
Expected: FAIL because the bot package does not exist.

- [ ] **Step 3: Create a minimal typed client and dispatcher startup**

Required settings:

```python
class Settings(BaseSettings):
    telegram_bot_token: SecretStr
    pilot_api_base_url: AnyHttpUrl
    pilot_bot_service_token: SecretStr
    redis_url: RedisDsn
    request_timeout_seconds: float = Field(default=8.0, ge=1.0, le=30.0)
```

`PilotApiClient` uses one `httpx.AsyncClient`, strict timeouts, bounded JSON responses, `raise_for_status`, safe error codes, and no token/body logging. Add `bot/.env` to `.gitignore`; commit only `bot/.env.example` with blank values.

- [ ] **Step 4: Verify GREEN**

Run: `python -m pytest bot/tests/test_config.py bot/tests/test_pilot_api.py -q`  
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add bot .gitignore
git commit -m "feat(bot): add Pilot API client foundation"
```

---

### Task 6: Centralized keyboards and `/start` role menus

**Files:**

- Create: `bot/keyboards/__init__.py`
- Create: `bot/keyboards/callbacks.py`
- Create: `bot/keyboards/common.py`
- Create: `bot/keyboards/client.py`
- Create: `bot/keyboards/staff.py`
- Create: `bot/keyboards/admin.py`
- Create: `bot/handlers/start.py`
- Create: `bot/formatters/common.py`
- Create: `bot/tests/test_keyboards.py`
- Create: `bot/tests/test_start_handler.py`
- Modify: `bot/main.py`

**Interfaces:**

- Produces: `client_main_menu()`, `driver_main_menu()`, `dispatcher_main_menu()`, `admin_main_menu()`.
- Produces callbacks prefixed `client:`, `rental:`, `staff:`, `admin:`.
- Consumes: Task 5 `PilotApiClient` and Task 2 link/profile API.

- [ ] **Step 1: Write failing keyboard ownership and role-menu tests**

```python
def test_all_markup_is_created_only_in_keyboards_package():
    offenders = scan_python_files_for_markup_outside("bot/keyboards")
    assert offenders == []

def test_client_menu_has_only_client_capabilities():
    labels = keyboard_labels(client_main_menu())
    assert labels == ["Новая аренда", "Мои аренды", "Продлить аренду", "Помощь"]
    assert "Все заявки" not in labels
```

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m pytest bot/tests/test_keyboards.py bot/tests/test_start_handler.py -q`  
Expected: FAIL because keyboards and handler do not exist.

- [ ] **Step 3: Implement callback constants, keyboard factories and deep-link start**

`/start <invite>` calls link API once, stores no invite token after response, fetches `/me`, escapes all names with `html.escape`, and renders the server-provided role menu. `/start` without invite resolves an existing identity or displays a safe «Попросите персональную ссылку» message.

No handler may import `InlineKeyboardButton`, `InlineKeyboardMarkup`, `ReplyKeyboardMarkup` or `KeyboardButton` from aiogram.

- [ ] **Step 4: Verify GREEN**

Run: `python -m pytest bot/tests/test_keyboards.py bot/tests/test_start_handler.py -q`  
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add bot/keyboards bot/handlers/start.py bot/formatters/common.py bot/main.py bot/tests
git commit -m "feat(bot): add linked role menus"
```

---

### Task 7: Client rentals, new request and extension FSM

**Files:**

- Create: `bot/states/rental.py`
- Create: `bot/handlers/rentals.py`
- Create: `bot/handlers/staff.py`
- Create: `bot/keyboards/rentals.py`
- Create: `bot/formatters/rentals.py`
- Create: `bot/tests/test_rental_handlers.py`
- Create: `bot/tests/test_rental_formatters.py`
- Modify: `bot/main.py`

**Interfaces:**

- Produces: `NewRentalForm`, `ExtensionForm`, rental router.
- Consumes: Task 5 API client, Task 6 centralized keyboards, Tasks 3–4 endpoints.

- [ ] **Step 1: Write failing FSM retention and submission tests**

```python
async def test_new_rental_retains_dates_vehicle_and_delivery_address_until_submit():
    await drive_new_rental_flow(
        starts_at="2026-09-01T09:00:00+03:00",
        ends_at="2026-09-05T09:00:00+03:00",
        vehicle_id="vehicle-1",
        mode="DELIVERY",
        address="Москва, улица Ленина, 10",
    )
    api.create_rental_request.assert_awaited_once_with(
        telegram_user_id="123",
        payload=expected_payload,
        idempotency_key=telegram_update_key,
    )

async def test_extension_can_only_select_own_active_rental():
    await press_extend("foreign-rental")
    assert safe_error_was_sent()
    api.create_rental_request.assert_not_awaited()

async def test_dispatcher_can_approve_the_exact_company_request_once():
    await press_staff_decision("request-1", "APPROVE")
    api.decide_rental_request.assert_awaited_once_with("123", "request-1", "APPROVE")
```

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m pytest bot/tests/test_rental_handlers.py bot/tests/test_rental_formatters.py -q`  
Expected: FAIL because rental FSM/handlers do not exist.

- [ ] **Step 3: Implement the button-first flow**

New rental states:

```python
class NewRentalForm(StatesGroup):
    starts_at = State()
    ends_at = State()
    vehicle = State()
    fulfillment = State()
    delivery_address = State()
    comment = State()
    confirm = State()
```

Validate Moscow date/time strictly, require future `startsAt < endsAt`, load availability only from Pilot+, request an address only for `DELIVERY`, show a final confirmation, and submit once with an idempotency key derived from Telegram update ID plus action name. Extension starts from an own active rental returned by API and requests only the new end date.

«Мои аренды» formats the Task 3 DTO and exposes document buttons only when `documentsReady` is true; clicking requests a fresh grant and sends the short-lived URL without storing it. `bot/handlers/staff.py` displays pending requests for server-provided staff capabilities and sends approve/reject decisions to the Task 4 decision route. All decision buttons are factories in `bot/keyboards/staff.py`.

- [ ] **Step 4: Verify GREEN**

Run: `python -m pytest bot/tests/test_rental_handlers.py bot/tests/test_rental_formatters.py -q`  
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add bot/states bot/handlers/rentals.py bot/handlers/staff.py bot/keyboards/rentals.py bot/keyboards/staff.py bot/formatters/rentals.py bot/main.py bot/tests
git commit -m "feat(bot): accept client rental requests"
```

---

### Task 8: Durable reminders and staff delivery loop

**Files:**

- Create: `src/modules/bot-api/notifications.ts`
- Create: `src/modules/bot-api/notifications.test.ts`
- Create: `src/app/api/bot/v1/notifications/claim/route.ts`
- Create: `src/app/api/bot/v1/notifications/[id]/ack/route.ts`
- Create: `src/app/api/bot/v1/notifications/routes.test.ts`
- Create: `bot/services/notifications.py`
- Create: `bot/formatters/notifications.py`
- Create: `bot/tests/test_notifications.py`
- Modify: `bot/main.py`

**Interfaces:**

- Produces: lease-based `claimNotificationJobs`, `ackNotificationJob`, `rescheduleNotificationJob`.
- Produces: Python `notification_worker(bot, api, stop_event)`.
- Consumes: Task 1 notification model and Task 5 API client.

- [ ] **Step 1: Write failing lease/idempotency tests**

```ts
it('claims a due job once and reclaims it only after lease expiry', async () => {
  expect(await claimNotificationJobs(now, workerA)).toHaveLength(1);
  expect(await claimNotificationJobs(now, workerB)).toHaveLength(0);
  expect(await claimNotificationJobs(afterLease, workerB)).toHaveLength(1);
});
```

```python
async def test_worker_acknowledges_only_after_telegram_send_succeeds():
    telegram.send_message.side_effect = [TimeoutError(), sent_message]
    await run_worker_twice()
    api.ack_notification.assert_awaited_once()
```

- [ ] **Step 2: Run focused TypeScript and Python tests and verify RED**

Run:

```powershell
npx vitest run src/modules/bot-api/notifications.test.ts src/app/api/bot/v1/notifications/routes.test.ts --maxWorkers=1
python -m pytest bot/tests/test_notifications.py -q
```

Expected: FAIL because notification lease/worker modules do not exist.

- [ ] **Step 3: Implement lease-bound claim/ack and worker**

Use the Task 1 `claimToken` and `leaseExpiresAt` fields. Claim at most 25 due jobs with conditional updates; ack/reschedule requires exact job ID, claim token and unexpired/current ownership. Retry with bounded exponential delays and terminal `ERROR` after five attempts. Payload DTOs contain only fields authorized for the target role.

- [ ] **Step 4: Add return reminder producer**

Create event key `rental-return:{rentalId}:{endsAtIso}:24h`. Enqueue client and staff-group jobs at most once when return is within 24 hours. Staff payload includes client display name, permitted phone, contract number, vehicle and Moscow return time; client payload excludes internal comments and staff data.

- [ ] **Step 5: Verify GREEN**

Run the two focused commands from Step 2.  
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/bot-api/notifications* src/app/api/bot/v1/notifications bot/services/notifications.py bot/formatters/notifications.py bot/tests/test_notifications.py bot/main.py
git commit -m "feat(bot): deliver durable rental reminders"
```

---

### Task 9: Local integration, VPS packaging and operational verification

**Files:**

- Create: `bot/Dockerfile`
- Create: `bot/docker-compose.bot.yaml`
- Create: `bot/deploy/pilot-plus-bot.service`
- Create: `bot/deploy/install.sh`
- Create: `docs/runbooks/telegram-bot.md`
- Create: `tests/telegram-bot-api.spec.ts`
- Modify: `compose.yaml`
- Modify: `compose.dev.yaml`

**Interfaces:**

- Produces: reproducible local bot service and systemd deployment for Ubuntu VPS.
- Consumes: all prior tasks.

- [ ] **Step 1: Write a failing local API smoke test**

```ts
test('linked client can list rentals and submit one request idempotently', async ({ request }) => {
  const first = await request.post('/api/bot/v1/rental-requests', { headers, data: payload });
  const second = await request.post('/api/bot/v1/rental-requests', { headers, data: payload });
  expect(first.status()).toBe(201);
  expect((await second.json()).id).toBe((await first.json()).id);
});
```

- [ ] **Step 2: Run smoke discovery and verify RED**

Run: `npx playwright test tests/telegram-bot-api.spec.ts --list`  
Expected: test is discovered; isolated runtime test remains RED until disposable fixtures are configured.

- [ ] **Step 3: Add non-root container and systemd packaging**

Docker image uses `python:3.12-slim`, creates an unprivileged `pilotbot` user, installs locked dependencies, exposes no ports in polling mode, uses `read_only: true`, `no-new-privileges`, a tmpfs `/tmp`, and healthchecks the Python process. systemd uses `EnvironmentFile=/etc/pilot-plus-bot.env`, `Restart=always`, `NoNewPrivileges=true`, `ProtectSystem=strict`, and `PrivateTmp=true`.

- [ ] **Step 4: Write deployment runbook**

Runbook must include:

1. wait for VPS `Активен` and verify SSH;
2. rotate the password already shared in chat;
3. add SSH key and disable password authentication only after key login succeeds;
4. install Docker/Compose or Python runtime;
5. create `/etc/pilot-plus-bot.env` with mode `0600`;
6. configure outbound HTTPS and Redis/Pilot+ endpoints;
7. start service and inspect PII-free logs;
8. rotate BotFather/service tokens;
9. rollback to the previous image;
10. backup requirements (business data remains in Pilot+).

- [ ] **Step 5: Run final verification**

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run build
python -m pytest bot/tests -q
npx prettier --check docs/runbooks/telegram-bot.md
git diff --check
```

Expected: every command exits 0. Run browser/E2E only against an explicitly disposable test database; do not migrate or seed a shared database.

- [ ] **Step 6: Commit**

```powershell
git add bot/Dockerfile bot/docker-compose.bot.yaml bot/deploy docs/runbooks/telegram-bot.md tests/telegram-bot-api.spec.ts compose.yaml compose.dev.yaml
git commit -m "chore(bot): package Telegram deployment"
```
