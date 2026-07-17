# Pilot+ — текущее состояние и handoff

**Дата снимка:** 17 июля 2026 года  
**Создатель и владелец:** Павел Седов (Pashadark)  
**Репозиторий:** `Pashadark/pilot-plus`  
**Рабочая ветка:** `feature/simple-admin-login`  
**Назначение файла:** дать следующему разработчику или AI-агенту точное состояние проекта без восстановления контекста из переписки.

## 1. Что это за проект

Pilot+ — будущая коммерческая платформа управления автопарком и транспортной телематикой. Главный продуктовый экран строится вокруг карты: текущее положение автомобилей, состояние парка, события, поиск, фильтры и карточка выбранной машины. Сейчас транспортные данные демонстрационные; реальный MQTT → worker → PostgreSQL/Redis → SSE/WebSocket поток ещё не построен.

Интерфейс основан на визуальном направлении Mosaic, но карта, бизнес-сценарии, компоненты и дизайн-токены принадлежат Pilot+. Bootstrap не используется. Tailwind CSS 4 выбран осознанно вместе с модульной архитектурой и собственной UI-библиотекой.

## 2. Главные документы

Перед любыми изменениями прочитать полностью:

1. `AGENTS.md` — обязательные правила репозитория и Next.js 16.
2. `docs/PROJECT_GUIDE.md` — каноническое описание продукта, архитектуры и roadmap.
3. `docs/superpowers/specs/2026-07-17-simple-admin-login-design.md` — утверждённый security-дизайн текущей авторизации.
4. `docs/superpowers/plans/2026-07-17-simple-admin-login.md` — детальный план и проверки.

## 3. Реально реализовано

### Интерфейс

- Next.js 16.2 App Router, React 19.2, TypeScript strict, Tailwind CSS 4.
- Адаптивный dashboard в стиле Pilot+/Mosaic.
- MapLibre GL и OpenStreetMap prototype tiles.
- Desktop shell: sidebar, header, breadcrumbs, theme switch, profile menu.
- Mobile-first полноэкранная карта, плавающие поиск/фильтры, нижняя панель автомобиля.
- Светлая/тёмная тема через семантические CSS variables.
- Собственная библиотека в `src/shared/ui` и витрина `/ui-kit`.
- Публичный адаптивный экран `/login`, клавиатурная навигация, inline errors, loading state.

### Авторизация

- Модели Prisma: `User`, `Session`, `LoginThrottle`; роль первой версии — только `ADMIN`.
- Пароль: минимум 12 символов, Node.js `scrypt`, новая 16-байтовая соль, 64-байтовый ключ, `timingSafeEqual`.
- Session token: `randomBytes(32)`, клиент получает base64url token, БД хранит SHA-256 hex.
- Cookie `pilot-session`: HttpOnly, SameSite=Lax, Path=/, 7 дней, Secure в production.
- `/` и `/ui-kit` защищены серверным `src/app/(protected)/layout.tsx`.
- `/login` перенаправляет уже авторизованного администратора на `/`.
- Выход отзывает серверную запись сессии и очищает cookie.
- Пять последовательных ошибок блокируют email на 15 минут; клиент получает единое сообщение без user enumeration.
- Seed идемпотентно создаёт/обновляет администратора из трёх переменных окружения.

### Локальная инфраструктура

- `compose.yaml`: PostgreSQL 17/PostGIS 3.5 на `5433`, Redis 8 на `6379`, Mosquitto на `1883`/`9001`.
- Миграция `20260717101500_add_auth_models` успешно применена локально через `prisma migrate deploy`.
- Docker Desktop и контейнер `pilot-postgres` были запущены при последней проверке.

## 4. Состояние локального администратора

Первый локальный администратор создан 17 июля 2026 года командой `npm run db:seed`. Его email, имя и пароль хранятся только в локальном `.env`; пароль не записан в Git, документацию или Notion.

Реальный браузерный сценарий подтверждён через Playwright CLI на чисто перезапущенном dev-server:

```text
/login → ввод корректных данных → / → профиль → Выйти → /login
```

Dashboard открылся после входа, меню профиля показало действие выхода, выход отозвал серверную сессию и вернул публичную форму. Для другого компьютера, CI или новой БД нужно задать собственные `PILOT_ADMIN_EMAIL`, `PILOT_ADMIN_PASSWORD`, `PILOT_ADMIN_NAME` в локальном окружении и повторить seed.

## 5. Подтверждённые проверки

На снимке ветки подтверждены:

```text
npm run test:unit                         30/30 PASS
npm run lint                              PASS
npm run typecheck                         PASS
npm run test:e2e:auth                     8/8 PASS (desktop + mobile)
npm run build                             PASS с одним Prisma NFT warning
npx prisma validate                       PASS
npx prisma generate                       PASS
npx prisma migrate deploy                 PASS, migration applied
npm run db:seed                           PASS, local admin created
Playwright CLI real login/logout          PASS
```

Production build предупреждает, что импорт `src/database/generated/prisma/index.js` приводит к слишком широкому NFT trace. Это не ломает текущий build, но перед deployment нужно стабилизировать Prisma generation/import и убрать дублирующий generated-каталог.

Полный исторический Playwright-набор dashboard/UI Kit **ещё не адаптирован к обязательной авторизации**. Нельзя считать его зелёным, пока global setup не создаёт отдельную тестовую БД, seed и storage state администратора. Auth-набор запускается с одним worker: при восьми параллельных workers локальный Next dev-server один раз отдал error page двум тестам, а последовательный контрольный прогон стабильно дал 8/8.

## 6. Коммиты текущего auth-среза

```text
f4ba0d8 feat: add responsive admin login and logout
ed4035c feat: protect Pilot routes with admin session
4c6fd7d feat: add login validation throttling and sessions
93cb661 feat: add admin auth data model and seed
8b4fd64 test: cover minimum admin password length
9257381 feat: add auth cryptography primitives
ee3d7a7 docs: plan secure admin login implementation
f75850d docs: define secure admin login
```

## 7. Важные файлы авторизации

```text
src/app/login/page.tsx
src/app/(protected)/layout.tsx
src/modules/auth/actions.ts
src/modules/auth/dal.ts
src/modules/auth/LoginForm.tsx
src/modules/auth/LoginPage.tsx
src/modules/auth/throttle.ts
src/modules/auth/validation.ts
src/services/auth/password.ts
src/services/auth/session-token.ts
src/services/auth/session.ts
src/database/prisma/schema.prisma
src/database/prisma/seed.ts
src/database/prisma/migrations/20260717101500_add_auth_models/migration.sql
tests/auth.spec.ts
```

## 8. Известные проблемы и риски

### P0 — закончить текущую вертикаль

1. Добавить безопасный Playwright global setup/test DB/auth storage state.
2. Автоматизировать проверку успешного входа, cookie attributes, выхода и пятиступенчатой блокировки без хранения секретов в test source.
3. Выполнить весь `npm run test:e2e`, а не только `tests/auth.spec.ts`.

### P1 — стабилизация основы

1. Устранить два generated-каталога Prisma и NFT build warning.
2. Перенести устаревающую `package.json#prisma` конфигурацию в актуальный Prisma config перед Prisma 7.
3. Настроить GitHub Actions: unit, lint, typecheck, format, build, e2e с PostgreSQL service.
4. Добавить восстановление/смену пароля, приглашения и реальную RBAC только после отдельного дизайна.

### Продуктовый P0 из Notion

После завершения auth остаётся задача уведомлений о замене масла: интервал 7000 км, фильтры, сервисная карточка/история и предупреждение на карте. Её нельзя смешивать с текущим auth-коммитом.

## 9. Команды восстановления контекста

```powershell
git status --short
git branch --show-current
git log -12 --oneline
npm install
docker compose up -d postgres
npx prisma migrate deploy
npm run test:unit
npm run lint
npm run typecheck
npm run test:e2e:auth
npm run build
```

Сначала проверить `git status`. Пользовательский `debug.log` специально не отслеживается и не должен удаляться или попадать в коммиты.

## 10. Что не делать

- Не выводить `.env`, пароль, исходный session token или `DATABASE_URL` в ответы и логи.
- Не добавлять публичную регистрацию: она явно отложена.
- Не считать клиентское скрытие элементов защитой; источник истины — серверная сессия/DAL.
- Не заменять Tailwind или текущую дизайн-систему новым UI-фреймворком.
- Не создавать пустые модули заранее; продолжать вертикальными проверяемыми сценариями.
- Не принимать исторический список зависимостей за установленный стек.
- Перед изменением Next.js читать локальные документы `node_modules/next/dist/docs/`.

## 11. Состояние Git при передаче

Ожидаемая ветка: `feature/simple-admin-login`. После handoff-коммита рабочее дерево должно содержать только пользовательский `?? debug.log`. Все остальные изменения должны быть закоммичены и отправлены на GitHub.
