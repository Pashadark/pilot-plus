# Pilot+ UI-kit and Domain Pages Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Объединить актуальную функциональную ветку с пользовательским UI-kit, восстановить автопарк и добавить четыре адаптивные продуктовые страницы с общей оболочкой Pilot+.

**Architecture:** Сначала обе линии изменений сохраняются отдельными коммитами и объединяются в существующем worktree. Монолитный UI-kit декомпозируется по доменным границам; маршруты собирают модули через AppShell, а демонстрационные данные остаются типизированными fixtures.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Prisma/PostgreSQL, Vitest, Playwright.

## Global Constraints

- Не удалять и не перезаписывать пользовательские изменения.
- Интерфейс и комментарии — на русском языке.
- Сохранить header, sidebar, breadcrumbs, тему, уведомления и профиль.
- Использовать локальные фотографии автопарка, не одиночное внешнее демо-фото.
- Новые бизнес-данные явно обозначать fixtures.
- Не добавлять зависимости без необходимости.

### Task 1: Безопасно объединить линии разработки

**Files:** пользовательские `next.config.ts`, `src/app/(protected)/ui-kit/sections.tsx`; незавершённый security-пакет актуального worktree.

- [ ] Зафиксировать пользовательские файлы отдельным WIP-коммитом без `debug.log` и секретов.
- [ ] Проверить и зафиксировать незавершённые изменения актуального worktree.
- [ ] Перенести пользовательский WIP-коммит в актуальный worktree и разрешить конфликты без потери функциональности.
- [ ] Выполнить `git diff --check` и проверить `/vehicles` на уровне маршрутов.

### Task 2: Исправить P0 UI-kit

**Files:** `src/app/(protected)/ui-kit/sections.tsx`, необходимые существующие shared/ui contracts, `tests/ui-kit.spec.ts`.

- [ ] Добавить падающие проверки для runtime-рендера и ключевых секций.
- [ ] Исправить несовместимые props `Badge`, `Avatar`, `Progress`, `FieldShell`, статусы и React lint-ошибки.
- [ ] Исправить ESLint ignore для вложенного `.worktrees/**`, не скрывая ошибки source-кода.
- [ ] Разделить чрезмерно длинные строки/блоки настолько, насколько нужно для поддерживаемости P0.
- [ ] Проверить все 20 секций desktop/mobile.

### Task 3: Восстановить и проверить автопарк

**Files:** существующие vehicle routes/modules/tests.

- [ ] Запустить credentialed `/vehicles` E2E и воспроизвести проблему.
- [ ] Исправить только подтверждённую причину после объединения.
- [ ] Проверить 130 автомобилей, локальные фото, фильтрацию и detail page desktop/mobile.

### Task 4: Создать доменные страницы

**Files:** `src/modules/wash/**`, `maintenance/**`, `clients/**`, `users/**`; `src/app/(protected)/wash/page.tsx`, `maintenance/page.tsx`, `clients/page.tsx`, `users/page.tsx`.

- [ ] Извлечь типизированные fixtures и небольшие компоненты из UI-kit.
- [ ] Собрать `/wash` со статистикой, списком/таблицей, календарём и формой-заглушкой.
- [ ] Собрать `/maintenance` с прогрессом ТО, предупреждениями и расписанием.
- [ ] Собрать `/clients` с заказами, статусами и адаптивными карточками.
- [ ] Собрать `/users` с профилями, ролями и правами, явно как demo fixtures.
- [ ] Добавить loading/empty/error-friendly структуру и responsive E2E.

### Task 5: Header, sidebar и интеграция

**Files:** `src/shared/components/app-shell/**`, `navigation.ts`, shell tests.

- [ ] Добавить новые маршруты, `/profile` и `/system` в навигацию без дубликатов.
- [ ] Сохранить desktop/mobile header с breadcrumbs, поиском, уведомлениями, темой и профилем.
- [ ] Проверить focus trap, Escape, touch targets и отсутствие horizontal overflow.

### Task 6: Документация и финальная проверка

- [ ] Обновить `README.md` и `docs/PROJECT_GUIDE.md` фактическим состоянием.
- [ ] Выполнить scoped Prettier, lint, typecheck и unit tests.
- [ ] Выполнить credentialed Playwright для auth, dashboard, UI-kit, vehicles и новых страниц desktop/mobile.
- [ ] Выполнить production build.
- [ ] Провести финальный code review, исправить Important findings и отправить ветку в существующий draft PR.

