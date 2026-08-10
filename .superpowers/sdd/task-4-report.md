# Task 4 — UI Pilot+ для документов клиента

## Статус

Task 4 реализована в изолированном worktree `client-documents-clamav`. Карточка клиента получила
доступную панель документов и загрузку локального фото. UI использует существующие семантические
токены Pilot+, русские подписи, системные иконки и серверные правила tenant/RBAC. Общие миграции и
seed не применялись.

## Реализовано

- `DocumentDropzone` поддерживает видимый нативный file input, drag-and-drop как дополнение,
  проверку формата/размера, прогресс и локальную ошибку.
- `DocumentCard` показывает формат, имя, дату, размер и статус текстом с иконкой, поэтому состояние
  не передаётся одним цветом. Предпросмотр и скачивание существуют только для `CLEAN`.
- `DocumentsPanel` содержит счётчик лимита 20 документов, пустое/read-only состояние, загрузку,
  замену, архивирование и тосты успеха/ошибки.
- `SUPER_ADMIN`, `COMPANY_ADMIN` и `DISPATCHER` могут загружать и заменять; архивирование доступно
  только `SUPER_ADMIN` и `COMPANY_ADMIN`; `VIEWER` видит read-only UI; `DRIVER` не получает данные.
- Архивирование выполнено Serializable tenant-scoped Server Action с audit-записью и атомарным
  запретом при незавершённой версии или активном recovery lease.
- Локальное фото клиента отдаётся новым защищённым маршрутом `/clients/[id]/photo`, проверяющим
  компанию и допустимый storage key. Оно имеет приоритет над messenger/fallback, а при отсутствии
  или ошибке загрузки используется доступная SVG-заглушка.
- Маршрут скачивания поддерживает `?preview=1` для inline-предпросмотра и по-прежнему обслуживает
  только `CLEAN` через атомарную серверную проверку. Preview пишет только аудит `VIEW`, обычное
  скачивание — только `DOWNLOAD`.
- Для `/clients/[id]` добавлены skeleton с зарезервированной геометрией и локальный error boundary
  Next.js 16.2 с `unstable_retry`.
- Все интерактивные элементы имеют видимые подписи/focus, touch target не меньше 44 px; сетка и
  действия рассчитаны на 375/390 px без горизонтального переполнения; motion учитывает
  `prefers-reduced-motion`.

## TDD: RED

До реализации были добавлены тесты компонентов и серверных границ.

```powershell
npx vitest run src/modules/client-documents/components/DocumentDropzone.test.tsx `
  src/modules/client-documents/components/DocumentCard.test.tsx `
  src/modules/client-documents/components/DocumentsPanel.test.tsx
```

Результат: три suites завершились RED, потому что компонентов ещё не существовало.

Отдельные RED-прогоны зафиксировали отсутствующие контрактные части: `archiveClientDocumentAction`,
inline-disposition для preview, защищённый маршрут фото, преобразование приватного `photoPath` в
URL, `canArchiveClient`, панель документов на странице и route loading/error states.

## TDD: GREEN

После реализации все focused-тесты компонентов, actions/access, DTO, download/photo routes,
страницы, фото и route states прошли. Финальный полный unit-прогон:

```powershell
npm run test:unit
```

Результат: `122` файла, `639` тестов, код `0`.

## Playwright-набор

Добавлен `tests/client-documents.spec.ts` с UUID-scoped fixtures и точечной очисткой только данных
и storage текущего тестового tenant. Набор покрывает:

- безопасный JPG через drag-and-drop и безопасный PDF через file picker;
- загрузку фото, замену и архивирование;
- EICAR внутри валидного PDF;
- скачивание и проверку байтов;
- изоляцию второго tenant и отказ для `DRIVER`, включая прямой download URL;
- mobile 390 px, touch targets и отсутствие overflow;
- `PENDING` и skeleton навигации.

Runtime-прогон не получил результата из-за инфраструктурной остановки:

```powershell
npx playwright test tests/client-documents.spec.ts --workers=1
```

Через приблизительно `842 s` команда была внешне прервана без единой строки stdout/stderr.
`test-results` и `playwright-report` не созданы; listeners на портах 3000–3002 и новые процессы
Playwright/Chromium после остановки отсутствовали. Это не PASS и не test failure: процесс не
оставил признаков запуска браузерного runtime. Повторный длительный запуск не выполнялся. Общая БД
не мигрировалась и не seed-илась; для фактического E2E нужен уже подготовленный изолированный test DB
и работающая инфраструктура Playwright/ClamAV.

## Изменённые области

- `src/modules/client-documents`: типы, queries, actions, три UI-компонента и unit-тесты.
- `src/modules/clients`: capability, DTO фото, `ClientPhoto`, `ClientDetailPage` и тесты.
- `src/app/(protected)/clients/[id]`: page, loading/error, download preview и защищённый photo route.
- `tests/client-documents.spec.ts`.
- `docs/PROJECT_GUIDE.md`.

`.superpowers/sdd/task-1-report.md` не редактировался этой задачей и не включается в коммит.

## Исправления после review

Read-only review выявил три Important-риска. Для каждого сначала был подтверждён RED, затем focused
прогон `3` файлов / `36` тестов стал GREEN:

1. Архивирование могло пересечься с незавершённой replacement-версией после promotion. Операция
   переведена на Serializable transaction и выполняется только при отсутствии версий с
   `scanVerdict = null` либо активным `scanLeaseExpiresAt`, поэтому незавершённая версия не
   исключается из recovery.
2. Ошибка защищённого photo route оставляла сломанный `<img>`. `ClientPhoto` запоминает только
   упавший source и переключается на доступный `ClientPlaceholder`; новый URL снова пробуется.
3. Preview и download одновременно писали `VIEW` и `DOWNLOAD`. Явный `?preview=1` теперь выбирает
   inline + `VIEW`, а attachment — `DOWNLOAD`; tenant/CLEAN и повторная атомарная проверка не
   изменены.

Повторный review подтвердил: прежние замечания закрыты, новых Critical/Important в этих участках
нет.

## Исправления после внешнего review

Внешний review выявил stale-image риск и два слабых места E2E. RED-прогон дал `19 failed` в шести
suites; после исправлений тот же focused-набор завершился `6 passed`, `42 passed`:

1. `DocumentCard` добавляет `currentVersion` в preview URL и React key. Route принимает только
   положительную числовую ревизию, а оба tenant/CLEAN чтения требуют именно эту текущую версию.
   Устаревший URL после replacement получает 404 и не открывает storage.
2. DTO клиента строит `/clients/{id}/photo?v={revision}` из base36 `updatedAt`. Токен не содержит
   storage key, путь или hash. Photo route валидирует его и отдаёт файл только при совпадении с
   текущей ревизией; смена URL сбрасывает зафиксированную в `ClientPhoto` ошибку источника.
3. Длинное исходное имя переносится через `break-all` и `min-w-0`; mobile fixture использует имя
   без пробелов и по-прежнему проверяет отсутствие overflow на 390 px.
4. CLEAN fixtures cross-tenant/DRIVER E2E теперь действительно записывают PDF-байты через
   `LocalPrivateStorage` и атомарно promote в private storage. Поэтому 404/403 не может случайно
   пройти из-за отсутствующего файла; cleanup удаляет только
   `<PRIVATE_STORAGE_ROOT>/private/companies/{test-company-id}` после проверки границы root.

`npx playwright test tests/client-documents.spec.ts --list` успешно обнаруживает восемь
project-сценариев. Полный browser runtime не повторялся после зафиксированной инфраструктурной
остановки. Повторный read-only review новых исправлений: approved, Critical/Important не найдено.

## Полная проверка

| Команда                                                          | Результат                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run lint`                                                   | PASS, 0 ошибок; 1 существующее warning в `src/shared/ui/DataDisplay.tsx` |
| `npm run typecheck`                                              | PASS, код `0`                                                            |
| `npm run test:unit`                                              | PASS: 122 файла, 639 тестов                                              |
| `npm run build`                                                  | PASS, Next.js 16.2.10, 17/17 static pages                                |
| `npx playwright test tests/client-documents.spec.ts --workers=1` | INFRA BLOCKED: ~842 s, нет output/artifacts/runtime                      |
| `npx prettier --check <файлы Task 4>`                            | PASS, код `0`                                                            |
| `git diff --check`                                               | PASS, код `0`, вывода нет                                                |

Build сохраняет известные предупреждения репозитория о нескольких lockfiles/workspace root и
широком NFT trace через сгенерированный Prisma client. Новых зависимостей нет.

## Риски и handoff

- Browser-сценарии написаны, но не подтверждены runtime-прогоном из-за описанного infra blocker.
- Сканирование EICAR зависит от доступного ClamAV worker и подготовленной мигрированной test DB.
- UI не выдаёт preview/download для `PENDING`, `BLOCKED` или `ERROR` и не раскрывает внутренние
  storage key либо технические детали антивируса.
