# Pilot+ Simple Admin Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить безопасный серверный вход и выход первого администратора Pilot+ по email и паролю без публичной регистрации.

**Architecture:** Prisma хранит пользователей, хеши непрозрачных сессий и состояние ограничения попыток входа. Серверный DAL проверяет cookie и пользователя непосредственно в каждом защищённом layout, а Server Actions выполняют вход и выход. Криптография изолирована в `src/services/auth`, прикладные правила и интерфейс — в `src/modules/auth`.

**Tech Stack:** Next.js 16.2 App Router, React 19 Server Actions, TypeScript 5, Prisma 6/PostgreSQL, Node.js `crypto`, Tailwind CSS 4, Vitest, Playwright.

## Global Constraints

- Перед реализацией прочитать `docs/PROJECT_GUIDE.md`, `docs/superpowers/specs/2026-07-17-simple-admin-login-design.md`, `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` и skill `security-best-practices`.
- Все видимые тексты, сообщения об ошибках, документация и новые комментарии в коде — на русском языке.
- Минимальная длина пароля — 12 символов; пароль хешируется `scrypt` с новой солью и сравнивается `timingSafeEqual`.
- Сессионный токен — 32 случайных байта; в PostgreSQL хранится только SHA-256-хеш.
- Cookie называется `pilot-session`, имеет `HttpOnly`, `SameSite=Lax`, `Path=/`, семь дней жизни и `Secure` в production.
- Пять последовательных ошибок блокируют email на 15 минут; клиент всегда получает одинаковую ошибку входа.
- Публичной регистрации, восстановления пароля, 2FA, социальных провайдеров и интерфейса ролей в этой версии нет.
- `/login` публичен; `/` и `/ui-kit` защищены серверной проверкой.
- Не изменять и не добавлять в Git пользовательский `debug.log`; не коммитить `.env` и секреты.

---

## File Map

- `src/database/prisma/schema.prisma` — модели `User`, `Session`, `LoginThrottle` и enum `UserRole`.
- `src/database/prisma/seed.ts` — идемпотентное создание первого администратора из env.
- `src/database/prisma/client.ts` — существующий единственный экземпляр Prisma Client.
- `src/services/auth/password.ts` — хеширование и проверка паролей.
- `src/services/auth/session-token.ts` — генерация исходного токена и SHA-256-хеша.
- `src/services/auth/session.ts` — создание, чтение и отзыв серверной сессии и cookie.
- `src/modules/auth/types.ts` — безопасный DTO пользователя и состояние формы.
- `src/modules/auth/validation.ts` — нормализация и проверка входа.
- `src/modules/auth/throttle.ts` — блокировка и сброс неудачных попыток.
- `src/modules/auth/dal.ts` — `getCurrentUser()` и `requireAdmin()`.
- `src/modules/auth/actions.ts` — Server Actions `loginAction()` и `logoutAction()`.
- `src/modules/auth/LoginForm.tsx` — доступная клиентская форма с `useActionState`.
- `src/modules/auth/LoginPage.tsx` — композиция страницы входа.
- `src/app/login/page.tsx` — публичный маршрут входа.
- `src/app/(protected)/layout.tsx` — единая серверная защита рабочих маршрутов.
- `src/app/(protected)/page.tsx` — перенесённый без изменения дашборд.
- `src/app/(protected)/ui-kit/page.tsx` — перенесённый без изменения UI Kit.
- `src/shared/components/app-shell/Header.tsx` — кнопка выхода в существующем меню профиля.
- `vitest.config.ts`, `src/**/*.test.ts` — быстрые проверки доменной и серверной логики.
- `tests/auth.spec.ts` — браузерные сценарии гостя, входа, выхода и адаптивности.
- `.env.example`, `README.md`, `docs/PROJECT_GUIDE.md` — воспроизводимый запуск auth без секретов.

### Task 1: Криптографические примитивы и тестовый раннер

**Files:**

- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/services/auth/password.ts`
- Create: `src/services/auth/password.test.ts`
- Create: `src/services/auth/session-token.ts`
- Create: `src/services/auth/session-token.test.ts`

**Interfaces:**

- Produces: `hashPassword(password: string): Promise<string>`
- Produces: `verifyPassword(password: string, encodedHash: string): Promise<boolean>`
- Produces: `createSessionToken(): { token: string; tokenHash: string }`
- Produces: `hashSessionToken(token: string): string`

- [ ] **Step 1: Добавить Vitest и seed runtime**

Run: `npm install --save-dev vitest tsx`

В `package.json` добавить scripts:

```json
"test:unit": "vitest run",
"test:unit:watch": "vitest",
"db:seed": "tsx src/database/prisma/seed.ts"
```

Expected: `npm ls vitest tsx` завершается с кодом 0.

- [ ] **Step 2: Настроить Vitest и написать падающие криптографические тесты**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

В `password.test.ts` проверить: два хеша одного пароля различны, верный пароль принимается, неверный отклоняется, повреждённая строка возвращает `false`. В `session-token.test.ts` проверить: два токена различны, каждый декодируется минимум в 32 байта, `tokenHash` содержит 64 hex-символа и совпадает с `hashSessionToken(token)`.

Run: `npm run test:unit -- src/services/auth/password.test.ts src/services/auth/session-token.test.ts`

Expected: FAIL, потому что модули ещё не существуют.

- [ ] **Step 3: Реализовать минимальные криптографические функции**

Использовать формат хеша `scrypt$16384$8$1$<salt-base64url>$<hash-base64url>`, `randomBytes(16)` для соли, `scrypt(..., { N: 16384, r: 8, p: 1 })`, ключ длиной 64 байта и `timingSafeEqual` только после проверки одинаковой длины буферов. Для сессии использовать `randomBytes(32).toString('base64url')` и `createHash('sha256').update(token).digest('hex')`.

Run: `npm run test:unit -- src/services/auth/password.test.ts src/services/auth/session-token.test.ts`

Expected: PASS, 2 test files.

- [ ] **Step 4: Проверить типы и зафиксировать задачу**

Run: `npm run typecheck`

Expected: exit 0.

```bash
git add package.json package-lock.json vitest.config.ts src/services/auth
git commit -m "feat: add auth cryptography primitives"
```

### Task 2: Схема Prisma и идемпотентный seed администратора

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/seed.ts`
- Create: `src/database/prisma/seed.test.ts`
- Create: `.env.example`

**Interfaces:**

- Consumes: `hashPassword(password: string): Promise<string>`
- Produces: `seedAdmin(env: NodeJS.ProcessEnv, db: Pick<PrismaClient, 'user'>): Promise<{ email: string; created: boolean }>`

- [ ] **Step 1: Написать падающие тесты seed**

Тестировать экспортируемую `seedAdmin` через fake `user.upsert`: нормализация `Admin@Example.COM` в `admin@example.com`; отсутствие каждой обязательной env-переменной; пароль короче 12 символов; отсутствие открытого пароля в `create`/`update`; повторный вызов использует один и тот же уникальный email и заменяет хеш.

Run: `npm run test:unit -- src/database/prisma/seed.test.ts`

Expected: FAIL, `seedAdmin` ещё не существует.

- [ ] **Step 2: Расширить Prisma-схему**

```prisma
enum UserRole {
  ADMIN
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String
  passwordHash String
  role         UserRole  @default(ADMIN)
  isActive     Boolean   @default(true)
  sessions     Session[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

model LoginThrottle {
  email         String    @id
  failedAttempts Int      @default(0)
  lastFailedAt   DateTime?
  lockedUntil    DateTime?
}
```

Run: `npx prisma format && npx prisma generate`

Expected: Prisma schema formatted and client generated successfully.

- [ ] **Step 3: Реализовать seed и безопасный env-шаблон**

`seedAdmin` обязан проверить непустые email/name/password, длину пароля, нормализовать email через `trim().toLowerCase()`, вызвать `hashPassword`, затем `user.upsert({ where: { email }, create: ..., update: { name, passwordHash, role: 'ADMIN', isActive: true } })`. CLI-блок вызывает `seedAdmin(process.env, prisma)`, печатает только нормализованный email и всегда выполняет `$disconnect()` в `finally`.

`.env.example`:

```dotenv
DATABASE_URL="postgresql://pilot:change-me@localhost:5432/pilot_plus?schema=public"
PILOT_ADMIN_EMAIL="admin@example.com"
PILOT_ADMIN_PASSWORD="replace-with-at-least-12-characters"
PILOT_ADMIN_NAME="Администратор Pilot+"
```

Run: `npm run test:unit -- src/database/prisma/seed.test.ts`

Expected: PASS.

- [ ] **Step 4: Создать и проверить миграцию на тестовой PostgreSQL**

Run: `npx prisma migrate dev --name add_auth_models`

Expected: новая папка `src/database/prisma/migrations/*_add_auth_models`, migration applied.

Run: `npm run db:seed`

Expected: администратор создан/обновлён; пароль в выводе отсутствует.

- [ ] **Step 5: Зафиксировать модель данных**

```bash
git add .env.example package.json src/database/prisma src/database/generated/prisma
git commit -m "feat: add admin auth data model and seed"
```

### Task 3: Валидация, ограничение попыток и серверные сессии

**Files:**

- Create: `src/modules/auth/types.ts`
- Create: `src/modules/auth/validation.ts`
- Create: `src/modules/auth/validation.test.ts`
- Create: `src/modules/auth/throttle.ts`
- Create: `src/modules/auth/throttle.test.ts`
- Create: `src/services/auth/session.ts`
- Create: `src/services/auth/session.test.ts`

**Interfaces:**

- Produces: `type SafeUser = { id: string; email: string; name: string; role: 'ADMIN' }`
- Produces: `type LoginState = { status: 'idle' | 'error'; message?: string; fieldErrors?: { email?: string; password?: string } }`
- Produces: `parseLoginInput(formData: FormData): { ok: true; email: string; password: string } | { ok: false; state: LoginState }`
- Produces: `isLoginLocked(email: string, now?: Date): Promise<boolean>`
- Produces: `recordLoginFailure(email: string, now?: Date): Promise<void>`
- Produces: `clearLoginFailures(email: string): Promise<void>`
- Produces: `createSession(userId: string): Promise<void>`, `readSession(): Promise<SafeUser | null>`, `deleteSession(): Promise<void>`

- [ ] **Step 1: Написать падающие тесты валидации и throttle**

Проверить trim/lowercase email, отказ для невалидного email и пустого пароля, отсутствие пароля в результате ошибки. Для throttle использовать подменённый Prisma adapter: попытки 1–4 не блокируют; пятая ставит `lockedUntil = now + 15 минут`; успешный вход удаляет запись; истёкшая блокировка не действует.

Run: `npm run test:unit -- src/modules/auth/validation.test.ts src/modules/auth/throttle.test.ts`

Expected: FAIL, функции ещё не существуют.

- [ ] **Step 2: Реализовать валидацию и throttle**

Валидация возвращает локальные сообщения `Введите корректный email` и `Введите пароль`, не возвращая исходный пароль. `recordLoginFailure` выполняет атомарный Prisma transaction: читает запись, сбрасывает устаревшую серию после 15 минут без ошибок, увеличивает счётчик и на пятой ошибке задаёт блокировку. `clearLoginFailures` использует `deleteMany`, чтобы отсутствие строки не было ошибкой.

Run: `npm run test:unit -- src/modules/auth/validation.test.ts src/modules/auth/throttle.test.ts`

Expected: PASS.

- [ ] **Step 3: Написать падающие тесты сессии**

Через mock `cookies()` и Prisma проверить: создание сохраняет только hash и выставляет все cookie-атрибуты; чтение отклоняет отсутствующую, истёкшую, неактивную и не-ADMIN сессию; успешное чтение возвращает только `SafeUser`; удаление отзывает запись и cookie; битая cookie не приводит к исключению наружу.

Run: `npm run test:unit -- src/services/auth/session.test.ts`

Expected: FAIL, модуль сессии ещё не существует.

- [ ] **Step 4: Реализовать серверную сессию**

Экспортировать `SESSION_COOKIE_NAME = 'pilot-session'` и `SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000`. Использовать `await cookies()` согласно Next.js 16.2. `readSession` ищет `tokenHash`, включает user, удаляет истёкшую запись, принимает только `isActive && role === 'ADMIN'` и не возвращает `passwordHash`. `deleteSession` хеширует cookie до удаления записи и очищает cookie с теми же `path`/`sameSite`/`secure` параметрами.

Run: `npm run test:unit -- src/services/auth/session.test.ts`

Expected: PASS.

- [ ] **Step 5: Зафиксировать серверный auth core**

Run: `npm run test:unit && npm run typecheck`

Expected: all unit tests PASS; typecheck exit 0.

```bash
git add src/modules/auth src/services/auth
git commit -m "feat: add login validation throttling and sessions"
```

### Task 4: Server Actions, DAL и защита маршрутов

**Files:**

- Create: `src/modules/auth/dal.ts`
- Create: `src/modules/auth/actions.ts`
- Create: `src/modules/auth/actions.test.ts`
- Create: `src/app/(protected)/layout.tsx`
- Move: `src/app/page.tsx` → `src/app/(protected)/page.tsx`
- Move: `src/app/ui-kit/page.tsx` → `src/app/(protected)/ui-kit/page.tsx`

**Interfaces:**

- Consumes: `parseLoginInput`, throttle functions, `verifyPassword`, session functions.
- Produces: `getCurrentUser(): Promise<SafeUser | null>`
- Produces: `requireAdmin(): Promise<SafeUser>`; redirects to `/login` if absent.
- Produces: `loginAction(previousState: LoginState, formData: FormData): Promise<LoginState>`
- Produces: `logoutAction(): Promise<never>`

- [ ] **Step 1: Написать падающие тесты Server Actions**

Проверить: невалидные поля не обращаются к БД; неизвестный email, неверный пароль, inactive user и lock возвращают одно сообщение `Не удалось войти. Проверьте данные и попробуйте позже.`; успешный ADMIN очищает throttle, создаёт сессию и вызывает только `redirect('/')`; logout вызывает `deleteSession()` до `redirect('/login')`. Мок redirect должен бросать sentinel, чтобы тест не проглатывал переход.

Run: `npm run test:unit -- src/modules/auth/actions.test.ts`

Expected: FAIL, actions ещё не существуют.

- [ ] **Step 2: Реализовать actions и DAL**

`actions.ts` начинается с `'use server'`. `loginAction` не принимает user id, role или redirect URL из формы. После нормализации сначала проверяет lock, затем `prisma.user.findUnique({ where: { email } })`; независимо от причины отказа вызывает единый ответ, а для неверных данных — `recordLoginFailure`. Успех требует `isActive`, `role === 'ADMIN'` и валидный пароль, затем последовательно `clearLoginFailures`, `createSession`, `redirect('/')`.

`getCurrentUser` вызывает `readSession`; `requireAdmin` вызывает `redirect('/login')` при `null`.

Run: `npm run test:unit -- src/modules/auth/actions.test.ts`

Expected: PASS.

- [ ] **Step 3: Сгруппировать защищённые маршруты без изменения URL**

```tsx
// src/app/(protected)/layout.tsx
import { requireAdmin } from '@/modules/auth/dal';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
```

Перенести страницы через `git mv`; импорты и JSX дашборда/UI Kit оставить прежними. Route Group не меняет `/` и `/ui-kit`.

Run: `npm run typecheck && npm run test:unit`

Expected: exit 0 and all tests PASS.

- [ ] **Step 4: Зафиксировать защищённую серверную границу**

```bash
git add src/app src/modules/auth
git commit -m "feat: protect Pilot routes with admin session"
```

### Task 5: Адаптивная страница входа и выход из профиля

**Files:**

- Create: `src/modules/auth/LoginForm.tsx`
- Create: `src/modules/auth/LoginPage.tsx`
- Create: `src/app/login/page.tsx`
- Modify: `src/shared/components/app-shell/Header.tsx`
- Test: `tests/auth.spec.ts`

**Interfaces:**

- Consumes: `loginAction`, `logoutAction`, `getCurrentUser`, existing `Button`, `Input`, `Card` and feedback primitives.

- [ ] **Step 1: Написать падающие браузерные проверки публичного экрана**

В `tests/auth.spec.ts` добавить сценарии: гость на `/` и `/ui-kit` получает `/login`; экран имеет heading `Вход в Pilot+`, поля `Email`/`Пароль`, кнопку `Войти`; submit с пустыми полями доступно сообщает ошибки; ширина контента не превышает viewport 375 px; Tab проходит email → пароль → кнопку; светлая и тёмная темы сохраняют читаемый текст. Для auth-сценариев использовать отдельную тестовую БД и seed из `webServer` env, не вшивать пароль в test source.

Run: `npm run test:e2e -- tests/auth.spec.ts --project=desktop`

Expected: FAIL, `/login` ещё не реализован.

- [ ] **Step 2: Собрать страницу входа из существующей дизайн-системы**

`LoginForm.tsx` — Client Component с `useActionState(loginAction, { status: 'idle' })`; `Input` получает `name="email"`, `type="email"`, `autoComplete="username"`, `required`; password получает `name="password"`, `type="password"`, `autoComplete="current-password"`, `required`; `Button` имеет `type="submit"`, `loading={pending}` и текст `Войти`. Общая серверная ошибка выводится через существующий feedback primitive с `role="alert"` и `aria-live="polite"`.

`LoginPage.tsx` использует токены Pilot+/Mosaic: компактная Card, логотип/название, описание `Управление автопарком и телематикой`, без регистрации и ложных ссылок. Контейнер — `min-h-dvh`, safe-area padding и `w-full max-w-md`.

`src/app/login/page.tsx` вызывает `getCurrentUser()` и `redirect('/')` для действующей сессии, иначе возвращает `<LoginPage />`.

Run: `npm run test:e2e -- tests/auth.spec.ts --project=desktop`

Expected: публичные и redirect-проверки PASS.

- [ ] **Step 3: Добавить настоящий выход в существующее меню профиля**

Подключить `logoutAction` к форме `<form action={logoutAction}>`; кнопка `Выйти` должна быть keyboard-accessible, использовать существующий стиль menu item и не закрываться декоративным `onClick` до отправки Server Action.

Run: `npm run typecheck && npm run lint`

Expected: exit 0.

- [ ] **Step 4: Проверить мобильный интерфейс и зафиксировать UI**

Run: `npm run test:e2e -- tests/auth.spec.ts --project=mobile`

Expected: PASS; no horizontal overflow at 375×812.

```bash
git add src/app/login src/modules/auth src/shared/components/app-shell/Header.tsx tests/auth.spec.ts
git commit -m "feat: add responsive admin login and logout"
```

### Task 6: Полная интеграция, документация и готовность к передаче

**Files:**

- Modify: `playwright.config.ts`
- Modify: `README.md`
- Modify: `docs/PROJECT_GUIDE.md`
- Modify: `tests/auth.spec.ts`

**Interfaces:**

- Consumes: complete seed, session, actions and UI flow from Tasks 1–5.

- [ ] **Step 1: Изолировать E2E auth окружение**

Настроить Playwright webServer env через уже заданные CI/local переменные: `DATABASE_URL`, `PILOT_ADMIN_EMAIL`, `PILOT_ADMIN_PASSWORD`, `PILOT_ADMIN_NAME`. В `globalSetup` применять миграции, seed и очищать только auth-сессии/throttle тестовой базы. Добавить явную защиту: setup завершается ошибкой, если URL базы не содержит согласованный маркер тестовой БД `pilot_plus_test`.

Run: `npm run test:e2e -- tests/auth.spec.ts`

Expected: desktop and mobile PASS.

- [ ] **Step 2: Завершить полные auth-сценарии**

Добавить проверки с env-учётными данными: правильный вход создаёт `pilot-session` с `httpOnly` и `sameSite=Lax`; неверный пароль показывает общее сообщение; пять ошибок блокируют вход; после контролируемого сброса throttle правильный вход открывает heading `Панель управления`; `Выйти` возвращает на `/login`; повторный запрос `/` снова закрыт. Проверка исходного токена выполняется только через браузерный cookie API, значение не печатается.

Run: `npm run test:e2e -- tests/auth.spec.ts`

Expected: all auth scenarios PASS in both projects.

- [ ] **Step 3: Обновить русскую документацию**

В `README.md` и `docs/PROJECT_GUIDE.md` документировать: реальный установленный auth stack; копирование `.env.example` в `.env`; создание отдельной PostgreSQL БД; `npx prisma migrate dev`; `npm run db:seed`; `npm run dev`; отсутствие регистрации; правила секретов; команды unit/E2E. Не помещать реальные email, пароль, cookie или DATABASE_URL в документацию.

Run: `npx prettier --check README.md docs/PROJECT_GUIDE.md`

Expected: оба Markdown-файла отформатированы, exit 0.

- [ ] **Step 4: Выполнить полную проверку проекта**

Run in order:

```bash
npm run test:unit
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: все команды до `git status` завершаются с кодом 0; Playwright показывает все проекты PASS; `git status --short` содержит только ожидаемые файлы задачи и сохранённый пользовательский `?? debug.log`.

- [ ] **Step 5: Проверить безопасность перед коммитом**

Run: `git diff --cached -- . ':!package-lock.json' | rg -n "PILOT_ADMIN_PASSWORD=|pilot-session=|postgresql://[^\"]+:[^\"]+@|password\s*:\s*['\"][^'\"]+"`

Expected: no output. Отдельно проверить, что `.env` игнорируется: `git check-ignore .env` выводит `.env`.

- [ ] **Step 6: Зафиксировать готовую вертикаль**

```bash
git add README.md docs/PROJECT_GUIDE.md playwright.config.ts tests/auth.spec.ts
git commit -m "docs: document secure Pilot admin access"
```

Run: `git log -6 --oneline && git status --short`

Expected: шесть логических auth-коммитов видны в истории; рабочее дерево чисто кроме `?? debug.log`.

## Definition of Done

- Seed воспроизводимо создаёт или обновляет одного администратора и не раскрывает пароль.
- Пароль, сессия и throttle соответствуют утверждённой спецификации и покрыты unit-тестами.
- Гость не получает `/` и `/ui-kit`; администратор входит и выходит через серверную сессию.
- `/login` адаптивен на 375 px, доступен с клавиатуры и работает в обеих темах.
- Unit, lint, typecheck, format, production build и весь Playwright проходят.
- Секреты, открытые пароли и исходные токены отсутствуют в Git и логах.
