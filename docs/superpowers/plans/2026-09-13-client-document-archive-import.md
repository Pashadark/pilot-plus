# Client Document Archive Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Безопасно и идемпотентно импортировать доступные фотографии паспорта, регистрации и ВУ в существующие production-карточки клиентов и сформировать отчёт о недостающих документах.

**Architecture:** Одноразовый TypeScript-импортёр принимает проверенный JSON-манифест, в dry-run сверяет клиентов, категории, сигнатуры и SHA-256, а в apply создаёт `ClientDocument`/`ClientDocumentVersion` и переносит файлы через `LocalPrivateStorage`. Вся неоднозначность разрешается до apply; production-операция выполняется от пользователя приложения после резервной копии.

**Tech Stack:** TypeScript 5, Prisma 6.16, PostgreSQL 17, Sharp, ClamAV, `LocalPrivateStorage`, Vitest 3.

## Global Constraints

- Не изменять анкетные поля клиентов.
- Не создавать клиентов и не применять нечёткое сопоставление имён.
- Не импортировать договоры, документы автомобилей, ОСАГО и каталог `Не_опознано`.
- Не создавать повтор по SHA-256.
- Не помечать файл `CLEAN` до проверки сигнатуры, декодирования и ClamAV.
- Не выводить содержимое персональных документов и секреты окружения в журналы.

---

### Task 1: Проверенный манифест

**Files:**
- Create: `.codex-tmp/client-document-import-20260913/manifest.json`
- Create: `.codex-tmp/client-document-import-20260913/classification-report.json`

**Interfaces:**
- Consumes: два распакованных архива и production-список клиентов.
- Produces: записи `{clientId, clientName, category, title, sourcePath}` и явный список пропусков.

- [ ] Визуально классифицировать файлы по содержимому, исключив договоры и документы автомобиля.
- [ ] Сверить имя на документе с точным клиентом production-базы.
- [ ] Записать манифест без персональных реквизитов документа.
- [ ] Проверить отсутствие повторяющихся путей и неоднозначных клиентов.

### Task 2: Идемпотентный импортёр

**Files:**
- Create: `scripts/import-client-document-archives.ts`
- Create: `src/modules/client-documents/server/archive-import.ts`
- Test: `src/modules/client-documents/server/archive-import.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: JSON-манифест и корень распакованных файлов.
- Produces: dry-run/apply JSON-отчёт с `created`, `duplicate`, `missing`, `unmatched`, `invalid`.

- [ ] Написать failing unit-тест точного сопоставления, SHA-256 дедупликации и отчёта о пропусках.
- [ ] Запустить `npx vitest run src/modules/client-documents/server/archive-import.test.ts` и подтвердить ожидаемое падение.
- [ ] Реализовать чистые функции нормализации манифеста и построения плана импорта.
- [ ] Реализовать CLI: проверка изображения, ClamAV, приватное сохранение и транзакционная запись `CLEAN`.
- [ ] Повторно запустить точечный тест и `npm run typecheck`.
- [ ] Зафиксировать только файлы импортёра, теста и документации.

### Task 3: Dry-run и production apply

**Files:**
- Read: `.codex-tmp/client-document-import-20260913/manifest.json`
- Produce: `.codex-tmp/client-document-import-20260913/dry-run-report.json`
- Produce: `.codex-tmp/client-document-import-20260913/apply-report.json`

**Interfaces:**
- Consumes: проверенный импортёр, архивы и production environment.
- Produces: новые документы в карточках и проверяемый отчёт.

- [ ] Выполнить dry-run и остановиться при любом неоднозначном совпадении.
- [ ] Создать резервную копию production-БД и приватных каталогов затрагиваемых клиентов.
- [ ] Передать только манифест, изображения и импортёр на VPS.
- [ ] Запустить apply от пользователя `pilot-plus`.
- [ ] Повторить dry-run: все созданные файлы должны перейти в `duplicate`, новых `created` быть не должно.
- [ ] Проверить чтение каждого файла от имени `pilot-plus` и наличие `CLEAN`-версии в БД.

### Task 4: Итоговый аудит

**Files:**
- Produce: `.codex-tmp/client-document-import-20260913/final-audit.json`

**Interfaces:**
- Consumes: production `ClientDocument` и исходный список каталогов.
- Produces: пользовательский список наличия и недостающих типов по клиенту.

- [ ] Сверить для каждого найденного клиента три требуемых типа: основной разворот, регистрация, ВУ.
- [ ] Отдельно перечислить отсутствующие, неоднозначные и нераспознанные материалы.
- [ ] Выполнить `npm run test:unit`, `npm run typecheck`, `npm run lint -- --quiet` и `git diff --check`.
