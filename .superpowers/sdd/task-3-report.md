# Task 3 — Client Documents: RBAC, tenant isolation, upload and download

## Status

Завершено. Реализованы серверные действия загрузки/замены документов и фото клиента,
tenant-safe чтение и CLEAN-only download route. Все входящие файлы проходят единый
quarantine → ClamAV → promotion pipeline; фото дополнительно нормализуется Sharp только
после CLEAN verdict.

Миграции и seed к общей БД не применялись. Старые client-core migrations не изменялись.

## Third external fix-wave: lease/promotion and photo acknowledgement races

### RED evidence

Focused RED до реализации: `9 failed, 22 passed` в 3 файлах. Тесты
воспроизвели:

- CLEAN promotion после утраты scan lease;
- потерю acknowledgement после committed photo transaction;
- недоступную tenant-scoped DB reread при уже promoted final photo;
- отсутствие durable photo upload lease;
- отсутствие `hasMore` и обработку за пределами bounded page;
- отсутствие `revalidatePath` для recovered idempotent document success.

### GREEN implementation

- `scanPendingUpload` запрашивает conditional DB heartbeat непосредственно перед
  CLEAN promotion. Потеря ownership оставляет файл fail-closed и не продвигает его.
- Defensive document compensation при уже committed ERROR удаляет свой
  проигравший promoted key, а storage failure сохраняет retry lease.
- `ClientPhotoUpload` добавлен отдельной add-only migration как durable
  upload/cleanup lease. Строка создаётся до storage write.
- Photo final transaction атомарно меняет `Client.photoPath` и durable status.
  При acknowledgement loss action делает tenant-scoped reread: exact committed final
  сохраняется и возвращает success. Если reread недоступен, final не
  удаляется; его судьбу решает expired durable lease.
- Photo reconciliation сначала conditional-claims expired row, затем повторно
  читает tenant-scoped current photo. Committed final никогда не удаляется;
  source/normalized/previous artifacts очищаются. Незакоммиченный
  final удаляется. Ошибка storage оставляет bounded retry lease.
- Document и photo reconciliation читают `batchSize + 1`, обрабатывают только
  bounded page и возвращают `hasMore`. CLI выходит с code 2 и безопасным
  русским указанием повторить запуск.
- Recovery audit содержит только SHA/verdict/reason и не содержит path,
  filename, bytes или PII.

Новые файлы:

- `src/database/prisma/migrations/20260810170000_add_client_photo_upload_leases/migration.sql`
- `src/modules/client-documents/server/reconcile-stale-photo-uploads.ts`
- `src/modules/client-documents/server/reconcile-stale-photo-uploads.test.ts`

### Verification third wave

```text
focused Vitest
Test Files  5 passed (5)
Tests       46 passed (46)

npm run test:unit -- --pool=forks --maxWorkers=1
Test Files  117 passed (117)
Tests       603 passed (603)

npm run typecheck
exit 0

npm run lint
exit 0 — 0 errors; 2 existing no-img-element warnings outside this fix-wave

npx prisma format --schema src/database/prisma/schema.prisma
formatted successfully

npx prisma generate --schema src/database/prisma/schema.prisma
generated successfully

git diff --check
exit 0
```

`prettier --check`, `prisma validate` и production build были переданы controller для
отдельного запуска: два tool-run с этими командами были прерваны без output и
не дали доказательств PASS/FAIL. Миграции и seed к общей БД не применялись;
старые migrations и `.superpowers/sdd/task-1-report.md` не изменялись этой задачей.

### Final internal review fixes

Независимый review нашёл `Critical 0 / Important 2 / Minor 1` до commit:

- Sharp мог пережить lease между source scan и normalized final promotion;
- исторически committed cleanup row после новой замены нельзя было
  отличить от uncommitted final;
- архивация клиента могла исключить artifacts из будущей cleanup-выборки.

Исправлено: добавлен второй tenant/status-guarded heartbeat непосредственно
перед normalized promotion; nullable `committedAt` записывается атомарно с
`Client.photoPath`; cleanup работает и для архивных tenant-scoped клиентов.
Исторически committed final не помечается ERROR; если он больше не current, он и
его previous/source artifacts очищаются без риска удалить текущее фото.

```text
post-review focused Vitest
Test Files  3 passed (3)
Tests       38 passed (38)

post-review npm run typecheck
exit 0

post-review git diff --check
exit 0
```
Незакоммиченный пользовательский `.superpowers/sdd/task-1-report.md` сохранён и не входит
в Task 3 commit.

## TDD evidence

### Initial RED

Сначала добавлены auth/action/route/query/schema/storage тесты. Первые запуски падали по
ожидаемым причинам: отсутствовали actions, server queries, download route, persistent
`uploadId` migration и `removePrivate` в storage contract.

Проверенные RED-контракты:

- upload/replace разрешены только SUPER_ADMIN, COMPANY_ADMIN и DISPATCHER;
- VIEWER может только читать/скачивать, DRIVER не имеет доступа;
- tenant и client/document relation повторно проверяются на сервере;
- download разрешён только текущей CLEAN версии своей компании;
- лимит 20 активных документов и idempotency по `uploadId`;
- безопасные русские ошибки не содержат path, filename, bytes или PII;
- фото использует тот же scanner и Sharp normalization только после CLEAN.

### Review RED

После первого self-review добавлены regression-тесты, которые дали 10 ожидаемых
падений: promotion до DB/audit commit, orphan photo при rollback, отсутствие ClamAV DB
version, rolling-incompatible NOT NULL migration, преждевременная смена currentVersion,
неполное RFC 5987 escaping и невалидная календарная дата. Отдельный query regression
падал, потому что во время replacement прежняя CLEAN currentVersion не находилась.

Для date normalization выполнен отдельный контрольный RED с временно снятой round-trip
проверкой: `2026-02-31` ошибочно принималась; после восстановления проверки тест GREEN.

### GREEN

После минимальных исправлений:

```text
npx vitest run <8 focused Task 3 files>
Test Files  8 passed (8)
Tests       76 passed (76)
```

Полная unit-регрессия:

```text
npm run test:unit
Test Files  114 passed (114)
Tests       578 passed (578)
```

Повторный независимый code review после исправлений:

```text
Critical: 0
Important: 0
Verdict: Ready
Reviewer focused verification: 66/66, typecheck, git diff --check
```

## Реализация

- `actions.ts`: upload/replace document и client photo, RBAC, tenant checks,
  Serializable limit/idempotency transactions, атомарные DB + audit mutations и
  storage compensation.
- `server/queries.ts`: tenant-safe list/read DTO без storage paths; при replacement
  предыдущая CLEAN currentVersion остаётся доступной до успешного final commit.
- download route: повторная tenant/CLEAN/current проверка внутри audit transaction,
  безопасный RFC 5987 filename и private streaming.
- scan pipeline: scanner metadata получается отдельной clamd `VERSION` командой;
  engine и DB `signatureVersion` не смешиваются с malware threat signature.
- photo pipeline: CLEAN source продвигается из quarantine, затем Sharp создаёт
  нормализованный WebP; при DB/audit failure финальный файл удаляется.
- document finalization: promotion отслеживается; при final transaction failure файл и
  созданная pending version компенсируются, retry не остаётся навсегда PENDING.
- replacement: currentVersion/status меняются только в успешной CLEAN final transaction;
  BLOCKED/ERROR replacement не лишает пользователя предыдущего CLEAN документа.
- `ClientDocumentVersion.uploadId` хранится как nullable unique поле. Новая версия
  приложения dual-write заполняет его; migration безопасна для rolling deployment.
- Next Server Actions body limit установлен в 16 MiB при прикладном лимите файла 15 MiB.

## Files

Созданы:

- `src/modules/client-documents/actions.ts`
- `src/modules/client-documents/actions.test.ts`
- `src/modules/client-documents/server/queries.ts`
- `src/modules/client-documents/server/queries.test.ts`
- `src/app/(protected)/clients/[id]/documents/[documentId]/download/route.ts`
- `src/app/(protected)/clients/[id]/documents/[documentId]/download/route.test.ts`
- `src/database/prisma/migrations/20260810120000_add_client_document_upload_id/migration.sql`

Изменены:

- `next.config.ts`
- `src/database/prisma/schema.prisma`
- `src/database/prisma/schema.test.ts`
- `src/modules/client-documents/scan-upload.ts`
- `src/modules/client-documents/scan-upload.test.ts`
- `src/modules/client-documents/types.ts`
- `src/services/malware-scanner/types.ts`
- `src/services/malware-scanner/clamav-client.ts`
- `src/services/malware-scanner/clamav-client.test.ts`
- `src/services/storage/private-storage.ts`
- `src/services/storage/local-private-storage.ts`
- `src/services/storage/local-private-storage.test.ts`

## Verification

```text
npm run lint
exit 0 — 0 errors; 2 existing no-img-element warnings outside Task 3
```

```text
npm run typecheck
exit 0
```

```text
npx prisma validate
The schema ... is valid
```

```text
npm run build
Next.js 16.2.10 — compiled, typechecked and generated successfully
```

```text
git diff --check
exit 0
```

Ни `prisma migrate`, ни seed не запускались.

## Security and invariants

- SUPER_ADMIN/COMPANY_ADMIN/DISPATCHER: upload и replace.
- VIEWER: read/download only. DRIVER: no access.
- Все tenant решения принимаются по server session/access context, не по FormData.
- Cross-company client/document/version выдаёт одинаковый безопасный not-found/denied
  результат без утечки существования объекта.
- Download только для exact current CLEAN version.
- Audit не содержит filename, storage key/path, bytes или клиентские PII.
- Active document limit считается внутри Serializable transaction.
- `uploadId` валидируется как UUID v4 и обеспечивает persistent idempotency.
- Неуспешный replacement сохраняет предыдущую CLEAN currentVersion.

## Concerns / follow-up

Блокирующих замечаний нет.

- `uploadId` намеренно nullable для совместимости rolling deployment. После выката всех
  инстансов нужен отдельный контролируемый backfill, затем отдельная будущая миграция
  `SET NOT NULL`; эта Task 3 migration этого не делает.
- Durable reconciliation реализован, но его периодический запуск остаётся обязанностью
  внешнего production scheduler согласно runbook; встроенной cron-зависимости нет.
- Build проходит, но сохраняет существующие предупреждения Next.js о нескольких
  lockfiles/workspace root и широком NFT trace. Prisma также предупреждает о будущем
  переносе package configuration в `prisma.config.ts`.

## Исправления по external review — crash/race boundaries

### RED

До production-изменений добавлены regression-тесты на три Important и Minor boundaries:

```text
npx vitest run <actions, queries, reconciliation, storage, schema>
Test Files  5 failed (5)
Tests       9 failed | 40 passed (49)
```

Падения подтвердили:

- replacement принимал исходный PENDING и мог создать v2 до CLEAN v1;
- проигравшая finalization удаляла persistent idempotency row;
- putQuarantine + audit/finalize failure оставляли незавершённое состояние;
- P2034 не повторялся;
- download не проверял verdict exact current version;
- CLEAN photo audit терялся при ошибке Sharp;
- отсутствовали scan lease migration, age-based storage cleanup и reconciliation module.

Отдельный controlled RED для upper bound P2034 при временном лимите 4 дал ожидаемое
`expected 3 calls, got 4`; после возврата production-лимита 3 тест стал GREEN.

После первого исправления independent review нашёл ambiguous-COMMIT boundary. RED
симулировал применённый final transaction с потерянным acknowledgement: action ошибочно
возвращал generic error и мог удалить committed CLEAN object. Дополнительные RED отдельно
подтвердили отсутствие SHA в recovery audit и безопасного actionable CLI formatter.

### GREEN implementation

- Replacement создаётся только внутри Serializable transaction, только для документа со
  статусом CLEAN, exact current `scanVerdict=CLEAN` и без другой pending version.
- Final document switch guard включает прежнюю CLEAN currentVersion и status CLEAN.
- Compensation сначала transactionally claims только собственную `scanVerdict=null`
  версию в ERROR под document/company/client guards. Storage удаляется только при
  успешном claim. При `count=0` committed result перечитывается; committed CLEAN
  сохраняется и возвращается как idempotent success.
- putQuarantine failure проходит через тот же finalize/claim-before-cleanup protocol.
- Serializable P2034 повторяется не более трёх раз до любого storage write.
- `scanLeaseExpiresAt` добавлен nullable add-only migration. Новые UPLOADING/PENDING
  версии получают configurable lease; legacy rolling rows без lease используют createdAt.
- `npm run client-documents:reconcile` bounded batch переводит stale row fail-closed в
  ERROR, не переключает CLEAN replacement, пишет tenant-scoped system SCAN audit с SHA и
  повторяет неудавшуюся storage cleanup по retry lease.
- Age sweep удаляет только внутренние orphan `scan-*`/`normalized-*`, не штатные ERROR
  quarantine uploads. Runbook фиксирует запуск, порог 15 минут (границы 5 минут–24 часа)
  и exit codes.
- Download требует CLEAN и у документа, и у exact current version.
- CLEAN photo scan аудируется до Sharp normalization/promotion.
- CLI failure message содержит безопасные проверки `DATABASE_URL`,
  `PRIVATE_STORAGE_ROOT`, прав storage и доступности БД, но не caught path/secret.

Созданы дополнительно:

- `src/database/prisma/migrations/20260810150000_add_client_document_scan_lease/migration.sql`
- `src/modules/client-documents/server/recovery-policy.ts`
- `src/modules/client-documents/server/recovery-policy.test.ts`
- `src/modules/client-documents/server/reconcile-stale-uploads.ts`
- `src/modules/client-documents/server/reconcile-stale-uploads.test.ts`
- `scripts/reconcile-client-document-uploads.ts`
- `docs/runbooks/client-document-upload-reconciliation.md`

### Final verification after external review fixes

```text
npm run test:unit
Test Files  116 passed (116)
Tests       597 passed (597)
```

```text
npm run typecheck
exit 0

npm run lint
exit 0 — 0 errors; 2 existing no-img-element warnings outside Task 3

npx prisma validate
The schema ... is valid

npm run build
Next.js 16.2.10 — compiled, typechecked and generated successfully

npx prettier --check <Task 3 files>
All matched files use Prettier code style!

git diff --check
exit 0
```

Финальный независимый review: Critical 0, Important 0, Minor 0, verdict Ready.

Миграции и seed к общей БД не применялись. Старые client-core migrations не изменялись.
