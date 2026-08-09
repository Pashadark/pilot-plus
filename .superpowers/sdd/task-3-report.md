# Task 3 — Client Documents: RBAC, tenant isolation, upload and download

## Status

Завершено. Реализованы серверные действия загрузки/замены документов и фото клиента,
tenant-safe чтение и CLEAN-only download route. Все входящие файлы проходят единый
quarantine → ClamAV → promotion pipeline; фото дополнительно нормализуется Sharp только
после CLEAN verdict.

Миграции и seed к общей БД не применялись. Старые client-core migrations не изменялись.
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
- Storage/DB compensation является best-effort при редком одновременном отказе обоих
  слоёв. Долгосрочно полезен durable reconciliation worker/runbook для abandoned
  quarantine/final objects.
- Build проходит, но сохраняет существующие предупреждения Next.js о нескольких
  lockfiles/workspace root и широком NFT trace. Prisma также предупреждает о будущем
  переносе package configuration в `prisma.config.ts`.
