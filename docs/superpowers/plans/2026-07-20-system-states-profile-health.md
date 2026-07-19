# Pilot+ System States, Profile, and Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить фирменные страницы ошибок, безопасный профиль администратора, health-check инфраструктуры и улучшения мобильной навигации Pilot+.

**Architecture:** Общие системные состояния живут в `shared`, профиль — в отдельном доменном модуле с Server Actions, проверки сервисов — в server-only модуле. Маршруты App Router только собирают готовые модули; ожидаемые ошибки возвращаются как типизированные значения, исключения рендера ловятся error boundaries.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Tailwind CSS v4, Prisma 6/PostgreSQL, Node `net`, Vitest, Playwright.

## Global Constraints

- Весь интерфейс и новые комментарии — на русском языке.
- Не включать экспериментальный `authInterrupts` только ради 403.
- Не передавать клиенту пароли, hashes, session tokens, строки подключения и адреса инфраструктуры.
- Все формы профиля требуют активную серверную сессию; email и пароль подтверждаются текущим паролем.
- Touch targets — не менее 44 px; светлая и тёмная темы используют существующие CSS variables.
- Не добавлять зависимости для Redis/MQTT: проверять TCP-доступность через server-only Node API.
- Новое поведение разрабатывается RED → GREEN → REFACTOR и фиксируется небольшими коммитами.

---

### Task 1: Общий компонент системного состояния

**Files:**

- Create: `src/shared/ui/SystemState.tsx`
- Create: `src/shared/ui/SystemState.test.tsx`
- Modify: `src/shared/ui/index.ts`

**Interfaces:**

- Produces: `SystemState({ code, tone, icon, title, description, primaryAction, secondaryAction, reference })`.
- Produces: `safeErrorReference(error): string | undefined`, возвращающий только непустой `digest`.

- [ ] **Step 1: Write the failing tests**

Проверить семантический heading, русское описание, оба action и отсутствие `error.message` в `safeErrorReference`:

```tsx
expect(safeErrorReference({ message: 'DATABASE_URL=secret', digest: 'abc-123' })).toBe('abc-123');
expect(safeErrorReference({ message: 'secret' })).toBeUndefined();
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npx vitest run src/shared/ui/SystemState.test.tsx`  
Expected: FAIL because `SystemState` does not exist.

- [ ] **Step 3: Implement the minimal shared UI**

Создать типы `SystemStateTone = 'primary' | 'warning' | 'danger'`, использовать существующие семантические цвета, `role="alert"` только для danger и CSS-иллюстрацию маршрута без новой зависимости.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/shared/ui/SystemState.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/shared/ui/SystemState.tsx src/shared/ui/SystemState.test.tsx src/shared/ui/index.ts
git commit -m "feat: add Pilot system state component"
```

### Task 2: 404, global 500, protected and vehicle boundaries

**Files:**

- Create: `src/app/not-found.tsx`
- Create: `src/app/global-error.tsx`
- Create: `src/app/(protected)/error.tsx`
- Modify: `src/app/(protected)/vehicles/error.tsx`
- Modify: `src/app/(protected)/vehicles/[id]/not-found.tsx`
- Create: `tests/system-states.spec.ts`

**Interfaces:**

- Consumes: `SystemState`, `safeErrorReference` from Task 1.
- Uses Next.js 16.2 `unstable_retry()` in error boundaries; `global-error.tsx` owns `html` and `body`.

- [ ] **Step 1: Write failing browser tests**

```ts
test('неизвестный маршрут показывает фирменную 404', async ({ page }) => {
  await page.goto('/такой-страницы-нет');
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'На главную' })).toBeVisible();
});
```

Добавить проверку несуществующего ID автомобиля и адаптивности 375 px.

- [ ] **Step 2: Verify RED**

Run: `npx playwright test tests/system-states.spec.ts --project=desktop --workers=1`  
Expected: FAIL on default Next.js 404.

- [ ] **Step 3: Implement route files**

404 получает код `404`, действия «На главную» и «Назад». Protected/vehicle boundary получает «Повторить» через `unstable_retry`. Global error импортирует `globals.css`, добавляет `<title>Ошибка — Pilot+</title>` и показывает только безопасный digest.

- [ ] **Step 4: Verify GREEN**

Run: `npx playwright test tests/system-states.spec.ts --workers=1`  
Expected: desktop and mobile PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app src/shared/ui tests/system-states.spec.ts
git commit -m "feat: add branded error pages"
```

### Task 3: Серверная модель профиля и валидация

**Files:**

- Create: `src/modules/profile/types.ts`
- Create: `src/modules/profile/validation.ts`
- Create: `src/modules/profile/validation.test.ts`
- Modify: `src/services/auth/session.ts`
- Modify: `src/services/auth/session.test.ts`

**Interfaces:**

- Produces: `parseProfileInput(formData): ProfileValidationResult`.
- Produces: `parsePasswordInput(formData): PasswordValidationResult`.
- Produces: `deleteOtherSessions(userId, currentTokenHash): Promise<void>`.
- Produces: `getAuthenticatedSession()` with safe user and current session ID/hash available only server-side.

- [ ] **Step 1: Write failing validation tests**

Проверить trim имени, lowercase email, обязательный текущий пароль, минимум 12 символов нового пароля, несовпадающее подтверждение и запрет одинакового текущего/нового пароля.

```ts
expect(parsePasswordInput(form('старый пароль', 'короткий', 'короткий'))).toMatchObject({
  ok: false,
  state: { fieldErrors: { newPassword: 'Новый пароль должен содержать не менее 12 символов' } },
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/modules/profile/validation.test.ts src/services/auth/session.test.ts`  
Expected: FAIL because profile validation/session helper is missing.

- [ ] **Step 3: Implement validation and session helper**

Не хранить пароль в возвращаемом error-state. Удалять другие сессии через `deleteMany({ where: { userId, id: { not: currentSessionId } } })`.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run src/modules/profile/validation.test.ts src/services/auth/session.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/profile src/services/auth/session.ts src/services/auth/session.test.ts
git commit -m "feat: add profile validation and session controls"
```

### Task 4: Server Actions и страница профиля

**Files:**

- Create: `src/modules/profile/actions.ts`
- Create: `src/modules/profile/actions.test.ts`
- Create: `src/modules/profile/ProfilePage.tsx`
- Create: `src/modules/profile/ProfileForms.tsx`
- Create: `src/app/(protected)/profile/page.tsx`
- Modify: `src/shared/components/app-shell/Sidebar.tsx`
- Modify: `src/shared/components/app-shell/MobileNavigation.tsx`
- Modify: `src/shared/components/app-shell/ShellFrame.tsx`
- Create: `tests/profile.spec.ts`

**Interfaces:**

- Consumes validation/session APIs from Task 3.
- Produces: `updateProfileAction(previous, formData): Promise<ProfileActionState>`.
- Produces: `changePasswordAction(previous, formData): Promise<ProfileActionState>`.

- [ ] **Step 1: Write failing action tests**

Проверить неверный текущий пароль, занятый email, успешную транзакцию, очистку throttle и удаление других сессий. Prisma и password service мокировать по существующему шаблону `modules/auth/actions.test.ts`.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/modules/profile/actions.test.ts`  
Expected: FAIL because actions are missing.

- [ ] **Step 3: Implement minimal actions**

При конфликте Prisma `P2002` возвращать «Этот email уже используется». После успешного обновления вызывать `revalidatePath('/profile')`. Текущий пароль проверять до транзакции одинаковым нейтральным сообщением.

- [ ] **Step 4: Verify action GREEN**

Run: `npx vitest run src/modules/profile/actions.test.ts`  
Expected: PASS.

- [ ] **Step 5: Write failing profile E2E**

Проверить открытие `/profile`, реальные данные текущего администратора, сохранение имени, ошибку текущего пароля и отсутствие horizontal overflow на 375 px.

- [ ] **Step 6: Implement profile UI and real sidebar user**

Server Component загружает safe user. Client forms используют `useActionState`, существующие `Input`, `Button`, `Card` и `useToast`. Sidebar получает user через props и ведёт на `/profile`.

- [ ] **Step 7: Verify UI GREEN**

Run: `npx playwright test tests/profile.spec.ts --workers=1`  
Expected: desktop and mobile PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/modules/profile src/app src/shared/components/app-shell tests/profile.spec.ts
git commit -m "feat: add secure administrator profile"
```

### Task 5: Одноразовые toast входа и выхода

**Files:**

- Modify: `src/modules/auth/actions.ts`
- Modify: `src/modules/auth/actions.test.ts`
- Modify: `src/modules/auth/LoginPage.tsx`
- Create: `src/shared/providers/FlashToast.tsx`
- Modify: `src/shared/providers/ToastProvider.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `tests/auth.spec.ts`

**Interfaces:**

- Produces a short-lived HttpOnly `pilot-flash` cookie with enum value `login-success | logout-success`.
- `FlashToast` receives a server-decoded safe enum, shows exactly one toast, then does not repeat on navigation.

- [ ] **Step 1: Write failing unit/browser tests**

Проверить установку enum-cookie, отсутствие произвольного текста и toast «Вы вошли в Pilot+» / «Вы вышли из системы».

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/modules/auth/actions.test.ts` and `npx playwright test tests/auth.spec.ts --workers=1`  
Expected: toast assertions FAIL.

- [ ] **Step 3: Implement flash flow**

Cookie: HttpOnly, SameSite=Lax, Secure in production, maxAge 60 seconds. Декодировать её на сервере в root layout и удалить до передачи enum в client component.

- [ ] **Step 4: Verify GREEN**

Run the same unit and E2E commands.  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/modules/auth src/shared/providers src/app/layout.tsx tests/auth.spec.ts
git commit -m "feat: add authentication flash toasts"
```

### Task 6: Health-check PostgreSQL, Redis и MQTT

**Files:**

- Create: `src/modules/system-health/types.ts`
- Create: `src/modules/system-health/check-service.ts`
- Create: `src/modules/system-health/check-service.test.ts`
- Create: `src/modules/system-health/get-system-health.ts`
- Create: `src/modules/system-health/get-system-health.test.ts`
- Create: `src/modules/system-health/SystemHealthPage.tsx`
- Create: `src/app/(protected)/system/page.tsx`
- Modify: `src/shared/components/app-shell/navigation.ts`
- Create: `tests/system-health.spec.ts`

**Interfaces:**

- Produces: `ServiceHealth = { key; label; status; message; latencyMs; checkedAt }`.
- Produces: `checkTcpService({ host, port, timeoutMs }): Promise<ServiceHealthStatus>`.
- Produces: `getSystemHealth(): Promise<ServiceHealth[]>` using `Promise.all`.

- [ ] **Step 1: Write failing unit tests**

Использовать локальный ephemeral `net.Server` для healthy; закрытый порт для unavailable; отсутствующую config для unconfigured; fake timers для timeout.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/modules/system-health`  
Expected: FAIL because module is missing.

- [ ] **Step 3: Implement server-only health module**

PostgreSQL проверять `prisma.$queryRawUnsafe('SELECT 1')` без пользовательского ввода. TCP-сокеты всегда уничтожать в `finally`. Публичный объект не содержит host/port/error stack.

- [ ] **Step 4: Verify unit GREEN**

Run: `npx vitest run src/modules/system-health`  
Expected: PASS.

- [ ] **Step 5: Write failing E2E**

Проверить три подписанные карточки, текстовый статус, время проверки и mobile layout.

- [ ] **Step 6: Implement protected system page**

Добавить ссылку «Состояние системы» в навигацию, карточки с иконкой и status badge. Страница должна отрисоваться даже при недоступных Redis/MQTT.

- [ ] **Step 7: Verify E2E GREEN**

Run: `npx playwright test tests/system-health.spec.ts --workers=1`  
Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/modules/system-health src/app src/shared/components/app-shell/navigation.ts tests/system-health.spec.ts
git commit -m "feat: add infrastructure health page"
```

### Task 7: Mobile breadcrumbs, scroll-to-top и shortcuts

**Files:**

- Modify: `src/shared/components/app-shell/Header.tsx`
- Modify: `src/shared/components/app-shell/ShellFrame.tsx`
- Modify: `src/shared/components/app-shell/MobileNavigation.tsx`
- Create: `src/shared/components/app-shell/ScrollToTopButton.tsx`
- Create: `src/shared/hooks/useGlobalShortcuts.ts`
- Create: `src/shared/hooks/useGlobalShortcuts.test.ts`
- Modify: `tests/ui-kit.spec.ts`
- Modify: `tests/dashboard.spec.ts`

**Interfaces:**

- Produces: `ScrollToTopButton` with 400 px visibility threshold.
- Produces: `useGlobalShortcuts({ focusSearch, closeOverlay, toggleTheme })` ignoring input, textarea, select and contenteditable targets.

- [ ] **Step 1: Write failing shortcut tests**

Проверить `T`, `F`, `/`, `Escape`; отдельно убедиться, что обработчики не вызываются при вводе в `input`.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/shared/hooks/useGlobalShortcuts.test.ts`  
Expected: FAIL because hook is missing.

- [ ] **Step 3: Implement shortcut hook**

Подписка на `keydown` создаётся один раз и снимается в cleanup. Для `/` вызывать `preventDefault()` только когда доступен search callback.

- [ ] **Step 4: Verify hook GREEN**

Run same Vitest command.  
Expected: PASS.

- [ ] **Step 5: Add failing mobile E2E assertions**

Проверить видимые breadcrumbs на 375 px, появление кнопки после scroll, возврат к `scrollY === 0`, `T` theme toggle и отсутствие overflow.

- [ ] **Step 6: Implement shell improvements**

Breadcrumbs сделать горизонтально прокручиваемыми. Кнопка использует `behavior: prefers-reduced-motion ? 'auto' : 'smooth'`. Подключить shortcuts на уровне ShellFrame.

- [ ] **Step 7: Verify E2E GREEN**

Run: `npx playwright test tests/dashboard.spec.ts tests/ui-kit.spec.ts --workers=1`  
Expected: desktop and mobile PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/shared tests/dashboard.spec.ts tests/ui-kit.spec.ts
git commit -m "feat: improve mobile navigation and shortcuts"
```

### Task 8: Документация и полная регрессия

**Files:**

- Modify: `README.md`
- Modify: `docs/PROJECT_GUIDE.md`

**Interfaces:**

- Documents new routes `/profile`, `/system`, error conventions, environment keys `REDIS_HOST`, `REDIS_PORT`, `MQTT_HOST`, `MQTT_PORT` and actual test commands.

- [ ] **Step 1: Update documentation**

Отметить реализованные пункты и отдельно оставить RBAC, production monitoring и PWA в roadmap, а не выдавать их за готовые.

- [ ] **Step 2: Run formatting and static checks**

```powershell
npx prettier --check "src/**/*.{ts,tsx,css}" "tests/**/*.ts" "*.{json,md,ts,mjs,yaml}"
npm run lint
npm run typecheck
```

Expected: PASS, либо отдельно зафиксированный уже существовавший format debt без новых нарушений.

- [ ] **Step 3: Run unit and browser regression**

```powershell
npm run test:unit
npx playwright test tests/auth.spec.ts tests/system-states.spec.ts tests/profile.spec.ts tests/system-health.spec.ts tests/dashboard.spec.ts tests/ui-kit.spec.ts tests/vehicles.spec.ts --workers=1
```

Expected: all tests PASS.

- [ ] **Step 4: Run production build**

Run: `npm run build`  
Expected: successful Next.js production build; known worktree/Prisma trace warnings may remain, no new warning introduced by this stage.

- [ ] **Step 5: Commit**

```powershell
git add README.md docs/PROJECT_GUIDE.md
git commit -m "docs: record profile and system states"
```
