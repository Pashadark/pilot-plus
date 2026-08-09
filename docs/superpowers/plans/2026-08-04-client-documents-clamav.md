# Pilot+ Client Documents and ClamAV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить приватные версионируемые документы клиентов с drag-and-drop, закрытым хранилищем и обязательной проверкой ClamAV.

**Architecture:** Файл сначала записывается в quarantine через server-only storage adapter, проверяется magic bytes и ClamAV, затем атомарно перемещается в private storage. Браузер никогда не получает filesystem path; download route повторно проверяет session, permission и company boundary. Метаданные и scan status находятся в PostgreSQL.

**Tech Stack:** Next.js 16.2, React 19.2, Prisma 6.16, PostgreSQL 17, Node streams/crypto, Docker Compose, ClamAV, Sharp, React Icons, Vitest, Playwright.

**Approved specification:** `docs/superpowers/specs/2026-08-09-client-documents-clamav-design.md`.

## Global Constraints

- Выполнять после `2026-08-04-company-clients-core.md`.
- Клиентское ядро уже объединено в `main`; существующие миграции `20260804170000`–`20260804172000` не изменять.
- Разрешённые файлы: JPG, PNG, WebP, PDF; максимум 15 МБ и 20 активных документов на клиента.
- Пользовательские SVG, HTML, архивы и executable запрещены.
- `SUPER_ADMIN`, `COMPANY_ADMIN`, `DISPATCHER` загружают/заменяют; `VIEWER` только читает; `DRIVER` не имеет доступа.
- `clamd` не публикует порт хосту; при недоступности scanner файл остаётся недоступным.
- Не использовать VirusTotal для клиентских документов.
- Все тексты/комментарии на русском; каждый маршрут имеет skeleton/error/empty state.

---

### Task 1: Добавить document schema и storage contracts

**Files:**

- Modify: `src/database/prisma/schema.prisma`
- Create: `src/database/prisma/migrations/20260804180000_add_client_documents/migration.sql`
- Modify: `src/database/prisma/schema.test.ts`
- Create: `src/modules/client-documents/types.ts`
- Create: `src/services/storage/private-storage.ts`
- Create: `src/services/storage/local-private-storage.ts`
- Create: `src/services/storage/local-private-storage.test.ts`
- Modify: `.env.example`

**Interfaces:**

- Produces: `PrivateStorage.putQuarantine/read/remove/promote/open`; `ClientDocument`, `ClientDocumentVersion`.

- [ ] **Step 1: Написать RED schema/storage tests**

```ts
await storage.putQuarantine('upload-1', bytes);
await expect(storage.openPrivate('upload-1')).rejects.toThrow();
await storage.promote('upload-1', 'companies/c1/clients/u1/documents/d1/v1');
expect(await readAll(storage.openPrivate(finalKey))).toEqual(bytes);
```

- [ ] **Step 2: Добавить модели и миграцию**

```prisma
enum ClientDocumentCategory { PASSPORT DRIVER_LICENSE CONTRACT POWER_OF_ATTORNEY MEDICAL OTHER }
enum DocumentScanStatus { UPLOADING PENDING CLEAN BLOCKED ERROR ARCHIVED }

model ClientDocument {
  id String @id @default(cuid())
  companyId String
  clientId String
  category ClientDocumentCategory
  title String
  numberEncrypted String?
  issuedAt DateTime?
  expiresAt DateTime?
  status DocumentScanStatus @default(UPLOADING)
  currentVersion Int @default(1)
  createdByUserId String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  archivedAt DateTime?
  versions ClientDocumentVersion[]
  @@index([companyId, clientId, status])
}
```

Миграция также добавляет `VIEW`, `DOWNLOAD`, `SCAN` в `AuditAction` и `CLIENT_DOCUMENT` в
`AuditEntityType`. Version хранит opaque storage key, original name, verified MIME, bytes, SHA-256, scan engine,
signature version, verdict и timestamps. Relations используют company/client cascade rules без
публичных URL.

- [ ] **Step 3: Реализовать path-safe local adapter**

Все resolved paths обязаны оставаться внутри `PRIVATE_STORAGE_ROOT`; original filename никогда не
используется как path. Promote выполняется rename в пределах volume.

- [ ] **Step 4: Проверить и commit**

Run: `npx prisma format && npx prisma generate && npx vitest run src/database/prisma/schema.test.ts src/services/storage/local-private-storage.test.ts && npm run typecheck`

```powershell
git add src/database/prisma src/modules/client-documents src/services/storage .env.example
git commit -m "feat: add private client document storage"
```

### Task 2: Добавить ClamAV service и безопасную scan pipeline

**Files:**

- Modify: `compose.yaml`
- Create: `docker/clamav/clamd.conf`
- Create: `src/services/malware-scanner/types.ts`
- Create: `src/services/malware-scanner/clamav-client.ts`
- Create: `src/services/malware-scanner/clamav-client.test.ts`
- Create: `src/modules/client-documents/file-validation.ts`
- Create: `src/modules/client-documents/file-validation.test.ts`
- Create: `src/modules/client-documents/scan-upload.ts`
- Create: `src/modules/client-documents/scan-upload.test.ts`

**Interfaces:**

- Produces: `scanStream(stream): Promise<ScanVerdict>`; `validateUploadedFile`; `scanPendingUpload`.

- [ ] **Step 1: Написать RED file/ClamAV protocol tests**

```ts
expect(detectAllowedFile(jpegBytes)).toEqual({ mime: 'image/jpeg', extension: 'jpg' });
expect(() => detectAllowedFile(svgBytes)).toThrow('Тип файла не поддерживается.');
expect(parseClamResponse('stream: Eicar-Signature FOUND\0')).toEqual({
  kind: 'infected',
  threat: 'Eicar-Signature',
});
```

- [ ] **Step 2: Добавить private Docker service**

`clamav` находится только в `pilot-network`, имеет healthcheck и persistent signature volume; секция
`ports` отсутствует. App использует `CLAMAV_HOST=clamav`, `CLAMAV_PORT=3310` только на сервере.

- [ ] **Step 3: Реализовать INSTREAM client с limits/timeouts**

Поток отправляется chunk frames протокола clamd, максимум 15 МБ, timeout конфигурируется. Ответы
`OK`, `FOUND`, size limit и network error преобразуются в точный discriminated union.

- [ ] **Step 4: Реализовать fail-closed pipeline**

`CLEAN` → promote + CLEAN; `FOUND` → remove + BLOCKED; scanner unavailable → оставить quarantine +
ERROR/PENDING. Audit содержит hash/verdict/signature, но не содержимое.

- [ ] **Step 5: Проверить EICAR и commit**

Run: `docker compose up -d clamav && npx vitest run src/services/malware-scanner src/modules/client-documents && npm run typecheck`
Expected: safe fixture CLEAN, EICAR BLOCKED, clamd port отсутствует в published ports.

```powershell
git add compose.yaml docker/clamav src/services/malware-scanner src/modules/client-documents
git commit -m "feat: scan client documents with clamav"
```

### Task 3: Добавить upload/download actions с tenant authorization

**Files:**

- Create: `src/modules/client-documents/actions.ts`
- Create: `src/modules/client-documents/actions.test.ts`
- Create: `src/modules/client-documents/server/queries.ts`
- Create: `src/modules/client-documents/server/queries.test.ts`
- Create: `src/app/(protected)/clients/[id]/documents/[documentId]/download/route.ts`
- Create: `src/app/(protected)/clients/[id]/documents/[documentId]/download/route.test.ts`

`CLIENT_DOCUMENT` и действия `VIEW`, `DOWNLOAD`, `SCAN` добавляются только новой миграцией Task 1.
Уже применённые миграции клиентского ядра не редактируются.

- [ ] **Step 1: Написать authorization RED tests**

Проверить cross-company upload/download, DRIVER/VIEWER mutation denial, PENDING/BLOCKED download denial,
20-document limit, duplicate retry by upload id и dispatcher replacement.

- [ ] **Step 2: Реализовать upload action**

Action сначала проверяет `MANAGE_CLIENTS` и доступный client, затем metadata/file validation, создаёт
UPLOADING row с idempotency key и запускает scan pipeline. Ошибка возвращает русский state без
раскрытия storage path.

Тем же pipeline отдельный `uploadClientPhotoAction` принимает JPG/PNG/WebP, сканирует файл,
нормализует его через Sharp и только после CLEAN атомарно заменяет `Client.photoPath`.

- [ ] **Step 3: Реализовать download route**

Route читает session и `VIEW_CLIENTS`, выбирает документ по разрешённому companyId и `status=CLEAN`,
пишет audit VIEW/DOWNLOAD и stream response с `Content-Disposition` и `nosniff`.

- [ ] **Step 4: Проверить и commit**

Run: `npx vitest run src/modules/client-documents "src/app/(protected)/clients/[id]/documents" && npm run typecheck`

```powershell
git add src/modules/client-documents "src/app/(protected)/clients/[id]/documents" src/database/prisma
git commit -m "feat: authorize client document workflows"
```

### Task 4: Реализовать drag-and-drop UI, preview и regression

**Files:**

- Create: `src/modules/client-documents/components/DocumentDropzone.tsx`
- Create: `src/modules/client-documents/components/DocumentCard.tsx`
- Create: `src/modules/client-documents/components/DocumentsPanel.tsx`
- Create tests beside components.
- Modify: `src/modules/clients/components/ClientDetailPage.tsx`
- Modify: `src/app/(protected)/clients/[id]/loading.tsx`
- Create: `tests/client-documents.spec.ts`
- Modify: `docs/PROJECT_GUIDE.md`

- [ ] **Step 1: Написать RED UI tests**

Проверить drag/drop и picker, JPG/PDF React icons plus text, upload progress, CLEAN/BLOCKED/PENDING
states, replacement, archive, client photo, SVG fallback, keyboard operation и русские errors.

- [ ] **Step 2: Реализовать доступный dropzone**

Нативный input остаётся доступным. Drag events — enhancement. `accept` не считается security.
Иконка файла имеет соседнюю подпись. Preview отображается только после CLEAN. Загруженная client
photo подключается к `ClientPhoto` и имеет приоритет над messenger avatar и SVG fallback.

- [ ] **Step 3: Добавить Playwright**

Проверить safe JPG/PDF, EICAR denial, cross-tenant/driver denial, download, mobile 390 px и skeleton.

- [ ] **Step 4: Полная проверка и commit**

Run: `npm run lint && npm run typecheck && npm run test:unit && npx playwright test tests/client-documents.spec.ts --workers=1 && npm run build && git diff --check`

```powershell
git add src/modules/client-documents src/modules/clients "src/app/(protected)/clients" tests/client-documents.spec.ts docs/PROJECT_GUIDE.md
git commit -m "feat: add client document workspace"
```
