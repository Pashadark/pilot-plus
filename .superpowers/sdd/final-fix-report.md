# Pilot+ Client Documents + ClamAV — final fix report

**Дата:** 10 августа 2026

**Ветка:** `codex/client-documents-clamav`

## Итог

- `ERROR` остаётся fail closed в quarantine. Версия получает durable retry lease, bounded retries
  (по умолчанию 3), absolute retention (24 часа, максимум 7 суток), безопасный повторный ClamAV scan
  и secure cleanup после expiry. Obsolete replacement не может откатить более новую CLEAN-версию.
- Archive атомарно ставит cleanup lease всем версиям, сразу удаляет private/quarantine artifacts и
  оставляет retry ownership при storage error. Активные permits освобождаются только после cleanup.
- Добавлен durable PostgreSQL `ClientUploadPermit`: per-user/company rate limits, bounded concurrent
  scans и tenant quota проверяются до `arrayBuffer`/scan для нового документа, replacement и фото.
  Serializable claims и отдельный orphan-permit reconciler покрывают несколько процессов/crash.
- Tenant quota включает private usage и ACTIVE/RECONCILING quarantine reservations. Для фото
  резервируется максимум 30 MiB на одновременные source + normalized WebP; лимит входного файла
  остаётся 15 MiB, лимит клиента — 20 активных документов.
- Storage root fail closed для repo root, `public`, `.next`, `.git`, `node_modules`, `src`; production
  repo-local root запрещён без явного override. Добавлен cross-process lock и root-anchored
  `/.pilot-private-storage/` ignore.
- Списки/скачивание читают только exact current version. Photo route после открытия stream атомарно
  повторно проверяет tenant/revision/storage key и пишет безопасный `VIEW` audit без path/PII.
- `DocumentCard` получил live status, `aria-controls`, именованный region и перевод фокуса в форму.
- Новая rolling-safe миграция удаляет только избыточный `ClientDocument_clientId_fkey`; составной
  tenant FK остаётся. Добавлены lifecycle columns, permits table и indexes без изменения старых
  миграций.
- README, PROJECT_GUIDE, `.env.example` и runbook фиксируют точную host-dev Compose-команду,
  production network contract без host-порта clamd, ACL/storage policy, capacity monitoring,
  scheduler liveness и fresh migration procedure.
- Добавлены gated live ClamAV test (harmless PDF + EICAR) и guarded fresh-migration deploy script.

## TDD

RED был зафиксирован до implementation:

- storage root/usage/multi-adapter — 6 ожидаемых падений;
- resource controls — отсутствующий модуль;
- current-version queries, photo audit/revalidation и DocumentCard disclosure — 4 ожидаемых
  падения;
- orphan permit reconciler — отсутствующий модуль.

GREEN focused после исправлений:

```text
12 test files passed, 117 tests passed, live test skipped without explicit gate
```

Дополнительно покрыты ERROR retry CLEAN, retry ERROR, expiry removal, obsolete replacement,
archive cleanup, cleanup retry, multi-process conditional claim, P2034 retry и guarded fresh DB URL.

## Финальная проверка

```text
npm run test:unit
125 files passed, 1 gated live file skipped
675 tests passed, 1 skipped

RUN_CLAMAV_INTEGRATION=1 + local healthy clamd
1 live integration test passed (harmless PDF + EICAR)

npm run lint
exit 0; одно существующее warning @next/next/no-img-element в DataDisplay.tsx

npm run typecheck
exit 0

npm run build
exit 0; Next.js 16.2.10 compiled, TypeScript passed, 17/17 static pages

npm run format:check
exit 0

npx prettier --check docs/PROJECT_GUIDE.md docs/runbooks/client-document-upload-reconciliation.md
exit 0

npx prisma format
exit 0

npx prisma generate
exit 0

DATABASE_URL=<non-secret local validation URL> npx prisma validate
exit 0

docker compose -f compose.yaml -f compose.dev.yaml config --quiet
exit 0

git diff --check
exit 0
```

Полный Playwright suite не запускался и не заявляется. Fresh migration deploy не применялся:
одноразовая БД не была предоставлена, а применение миграций к общей БД запрещено задачей.
Вместо этого guard/helper покрыт 5 unit tests, а runbook содержит точную disposable-DB процедуру.
Seed не запускался.

## Известные предупреждения

- Next build сообщает о нескольких lockfiles в основном repo/worktree и автоматически выбранном
  workspace root.
- Turbopack NFT trace сохраняет предупреждение из generated Prisma client. Build успешен.
- Lint сохраняет одно прежнее warning об `<img>` в `src/shared/ui/DataDisplay.tsx`; ошибок нет.

`.superpowers/sdd/task-1-report.md` является посторонним незакоммиченным изменением и намеренно не
редактировался, не stage-ился и не включается в commit.
