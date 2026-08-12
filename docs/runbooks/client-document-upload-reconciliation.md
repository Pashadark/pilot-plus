# Reconciliation загрузок документов и фото клиентов

Worker обслуживает fail-closed lifecycle документов, replacement, фото и durable upload permits.
Непроверенный файл никогда не выдаётся пользователю: `ERROR` остаётся в quarantine для bounded
повторной проверки, а после исчерпания retries или retention безопасно удаляется. Archive сразу
пытается удалить все private/quarantine artifacts документа и оставляет durable cleanup lease при
ошибке. Фото обрабатывается по тому же tenant-scoped принципу.

## Production prerequisites

- `DATABASE_URL` указывает на применённую штатным deployment-процессом схему.
- `PRIVATE_STORAGE_ROOT` — абсолютный server-owned каталог вне repo, `public`, `.next` и `.git`.
  Unix mode/ACL разрешает доступ только пользователю приложения; на Windows задайте эквивалентный
  NTFS ACL. Каталог включён в encrypted backup, disk-usage и inode monitoring.
- Production app и ClamAV подключены к внутренней `pilot-network`; app использует
  `CLAMAV_HOST=clamav`, `CLAMAV_PORT=3310`. Base `compose.yaml` не публикует clamd на host.
- Внешний scheduler запускает ровно эту версию кода с теми же server-only env и storage mount.

Для host development запустите инфраструктуру точной командой:

```powershell
docker compose -f compose.yaml -f compose.dev.yaml up -d
```

Development override и только он публикует clamd на `127.0.0.1:3310`.

## Schedule и liveness

Первый запуск после миграции обязателен до открытия загрузок: он сверяет legacy-фото и документы
с фактическим приватным хранилищем. Пока `reconciledAt` не заполнен, новые загрузки компании
отклоняются fail-closed и не обходят квоту.

Запускайте worker каждые 5–10 минут:

```powershell
npm run client-documents:reconcile
```

Успешно завершившийся проход пишет безопасную строку
`CLIENT_DOCUMENT_RECONCILIATION_OK {"completedAt":"...",...}` без путей, PII и env. Собирайте её
централизованно и алертите, если нет новой строки более 20 минут. Алерт также обязателен при трёх
последовательных exit `1`, любом exit `2` дольше двух retry windows, росте `cleanupPending` или
свободном месте storage менее 20%.

Exit codes:

- `0` — page завершена, `hasMore=false`, cleanup/retry backlog отсутствует;
- `2` — есть следующая page, ожидающий retry scan или storage cleanup; повторите сразу для page либо
  после retry lease;
- `1` — запуск не завершён; проверьте БД, ClamAV, mount и ACL, не выводя значения env в тикет/лог.

Параллельные процессы безопасны: PostgreSQL conditional claims и leases не дают двум worker удалить
активный artifact. Отдельный permit reconciler удаляет crash-orphan, возникший до создания durable
version/photo row, но сохраняет permit, если ownership row уже существует.

## Quarantine policy

- `CLIENT_DOCUMENT_STALE_UPLOAD_MINUTES=15` — upload/scan/cleanup lease, допустимо 5 минут–24 часа;
- `CLIENT_DOCUMENT_SCAN_RETRY_MAX=3` — максимум retry scan, допустимо 0–10;
- `CLIENT_DOCUMENT_QUARANTINE_RETENTION_HOURS=24` — абсолютный retention, допустимо 1–168 часов;
- retry delay начинается с 5 минут и bounded exponential backoff не превышает 1 час;
- после max retries или retention worker удаляет quarantine snapshot, scan artifacts и ошибочно
  созданный private object; если storage недоступен, cleanup остаётся leased и поднимает exit `2`.

Каждый впервые восстановленный stale upload и каждый retry verdict получает системный `SCAN` audit
только с безопасными `sha256`, verdict, reason и version. Имена файлов, storage keys, bytes, ответы
ClamAV и PII в audit не пишутся. Просмотр защищённой фотографии атомарно повторно проверяет tenant и
revision и пишет `VIEW` audit только с opaque revision.

## Capacity controls и monitoring

Permit создаётся в PostgreSQL до чтения file bytes и обращения к scanner. Defaults:

- окно 10 минут: 20 попыток на пользователя, 100 на компанию;
- concurrent ACTIVE permits: 2 на пользователя, 6 на компанию;
- tenant quota: 1024 MiB;
- файл: максимум 15 MiB; клиент: максимум 20 активных документов.

Настройки: `CLIENT_UPLOAD_RATE_WINDOW_MINUTES`, `CLIENT_UPLOAD_RATE_USER_MAX`,
`CLIENT_UPLOAD_RATE_COMPANY_MAX`, `CLIENT_UPLOAD_CONCURRENT_USER_MAX`,
`CLIENT_UPLOAD_CONCURRENT_COMPANY_MAX`, `CLIENT_PRIVATE_STORAGE_QUOTA_MB`. Quota суммирует
tenant private usage и ACTIVE reservations quarantine. Replacement сохраняет текущую CLEAN-версию,
поэтому обе версии учитываются. Фото резервирует до 30 MiB, поскольку source и нормализованный WebP
могут кратковременно существовать одновременно.

Для безопасного DB-monitoring используйте агрегаты без `uploadId`, имён или storage keys:

```sql
SELECT "companyId", count(*) AS active_permits,
       coalesce(sum("reservedBytes"), 0) AS reserved_bytes,
       min("leaseExpiresAt") AS oldest_lease
FROM "ClientUploadPermit"
WHERE status IN ('ACTIVE', 'RECONCILING')
GROUP BY "companyId";

SELECT count(*) AS expired_active_permits
FROM "ClientUploadPermit"
WHERE status IN ('ACTIVE', 'RECONCILING') AND "leaseExpiresAt" < now();

SELECT count(*) AS cleanup_backlog
FROM "ClientDocumentVersion"
WHERE "cleanupPending" = true;
```

Следите также за tenant/root disk bytes отдельным filesystem exporter. Предупреждайте при 70% quota,
блокируйте новые uploads на 100% (делает приложение) и расследуйте расхождение физического usage с
агрегатами permits. Не публикуйте результаты с tenant id во внешние публичные dashboards.

## Deploy и проверки

Перед deploy сделайте backup и на staging выполните обычный `npx prisma migrate deploy`. Миграция
`20260810190000_harden_client_upload_lifecycle` rolling-safe: добавляет nullable/defaulted lifecycle
поля и таблицу permits, а также удаляет только избыточный `ClientDocument_clientId_fkey`; составной
tenant FK остаётся.

Проверьте всю историю на заранее созданной пустой одноразовой PostgreSQL/PostGIS БД:

```powershell
$env:FRESH_MIGRATION_DATABASE_URL="postgresql://pilot:local-only@127.0.0.1:5433/pilot_fresh?schema=public"
$env:FRESH_MIGRATION_CONFIRM="DISPOSABLE"
npm run db:migrate:fresh:verify
```

URL обязан отличаться от `DATABASE_URL`. Скрипт не делает reset/drop и не предназначен для общей,
staging или production БД.

Live contract с локальным clamd запускается отдельно от unit suite:

```powershell
$env:RUN_CLAMAV_INTEGRATION="1"
npx vitest run src/services/malware-scanner/clamav-live.integration.test.ts
```

Тест отправляет harmless PDF и стандартный EICAR test file. Без флага он committed, но skipped.
После проверки остановите development Compose теми же файлами:

```powershell
docker compose -f compose.yaml -f compose.dev.yaml down
```
