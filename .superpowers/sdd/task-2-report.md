# Отчёт Task 2: ClamAV и безопасная проверка документов

## Изменения

- В `compose.yaml` добавлен приватный сервис `clamav` в `pilot-network`, с persistent volume
  сигнатур, healthcheck и без публикации порта. В `compose.dev.yaml` порт опубликован только как
  `127.0.0.1:3310:3310`.
- Добавлен `docker/clamav/clamd.conf`: TCP-порт 3310, лимит потока 15 МБ и серверные таймауты.
- В `.env.example` добавлены только серверные `CLAMAV_HOST`, `CLAMAV_PORT` и
  `CLAMAV_TIMEOUT_MS`.
- Добавлен типизированный ClamAV INSTREAM-клиент. Он отправляет `zINSTREAM`, кадры с
  четырёхбайтовой длиной, завершающий нулевой кадр, ограничивает размер и возвращает
  discriminated union для `OK`, `FOUND`, ошибок лимита, некорректного ответа и недоступности.
- Добавлена проверка фактических сигнатур JPG, PNG, WebP и PDF; SVG и несовпадающее расширение
  отклоняются, максимальный размер — 15 МБ.
- Добавлен fail-closed `scanPendingUpload`: чистый файл переносится в private storage, заражённый
  удаляется из quarantine, а при любой недоступности/ошибке файл остаётся в quarantine. Возвращаемый
  audit-снимок содержит только SHA-256, verdict и сигнатуру угрозы.

## RED → GREEN

1. RED: `npx vitest run src/services/malware-scanner/clamav-client.test.ts src/modules/client-documents/file-validation.test.ts src/modules/client-documents/scan-upload.test.ts` завершился с кодом 1: три ожидаемых suite failure, поскольку `clamav-client`, `file-validation` и `scan-upload` ещё отсутствовали.
2. После минимальной реализации первый GREEN показал 13/15: тест SHA-256 содержал неверно вычисленное ожидаемое значение, а тест лимита использовал недоступный порт вместо тестового clamd. Fixture и изоляция протокола исправлены без изменения контрактов.
3. RED для server-only конфигурации: `npx vitest run src/services/malware-scanner/clamav-client.test.ts` завершился с кодом 1, потому что отсутствовала `clamAvOptionsFromEnvironment`.
4. GREEN: после добавления парсинга `CLAMAV_*` обязательный набор прошёл 3 файла и 17 тестов.

## Выполненные проверки

- `npx vitest run src/services/malware-scanner src/modules/client-documents` — успешно: 3 test files, 17/17 tests. Первый запуск в sandbox не смог прочитать `vitest.config.ts`; после разрешённого запуска вне sandbox команда прошла.
- `npm run typecheck` — успешно.
- `npx prettier --check compose.yaml compose.dev.yaml src/services/malware-scanner/types.ts src/services/malware-scanner/clamav-client.ts src/services/malware-scanner/clamav-client.test.ts src/modules/client-documents/file-validation.ts src/modules/client-documents/file-validation.test.ts src/modules/client-documents/scan-upload.ts src/modules/client-documents/scan-upload.test.ts` — успешно.
- `git diff --check` — успешно.
- `docker compose -f compose.yaml config --format json` — успешно: у `clamav` нет `ports`.
- `docker compose -f compose.yaml -f compose.dev.yaml config` — успешно: опубликован только `127.0.0.1:3310`.
- `docker compose -f compose.yaml -f compose.dev.yaml up -d clamav` — image pull не завершился: Docker получил 81.6 МБ из 112.8 МБ и завершился `unexpected EOF`. Контейнер не был запущен, EICAR-интеграция не выполнялась; PostgreSQL и общая БД не затрагивались.

## Self-review

- В новых кодовых файлах нет логирования содержимого, PII, storage key или абсолютных путей.
- Оригинальное имя файла используется исключительно для сверки расширения, а не для построения пути.
- При `FOUND` promote невозможен; quarantine удаляется до выдачи статуса `BLOCKED`.
- При network/timeout/ошибке scanner quarantine намеренно остаётся недоступным со статусом `ERROR`.
- Базовый Compose не публикует clamd на хост; loopback-публикация существует только в утверждённом development override.

## Concerns

- Docker image pull оборвался во внешней сети, поэтому живой EICAR тест нужно повторить после успешной загрузки `clamav/clamav:1.4`.
- Стандартный Prettier не поддерживает `.env.example`; файл проверен визуально вместе с diff, а исходники и Compose прошли явную Prettier-проверку.
- `.superpowers/sdd/task-1-report.md` уже был изменён до начала Task 2 и намеренно не включается в этот commit.

## Исправление финального review

### Причина и RED

- `ClamAvClient` создавал независимые ожидания `drain` и response: `close` во время backpressure
  не завершал writer, а ранний ответ daemon не отменял чтение input stream. `scan-upload` открывал
  quarantine-файл отдельно для SHA-256 и scan, поэтому между этими операциями был возможен swap.
- RED: `npx vitest run src/services/malware-scanner/clamav-client.test.ts src/modules/client-documents/scan-upload.test.ts src/services/storage/local-private-storage.test.ts` завершился с кодом 1: отсутствовал `reserveQuarantine`, pipeline не использовал snapshot, ранний verdict продолжал запрашивать второй chunk, а timeout оставлял TCP-соединение открытым.

### Реализация

- Клиент ClamAV теперь использует один наблюдаемый lifecycle response/timeout/close/error. Response
  сразу отменяет input stream; `close` и `error` завершают pending backpressure. Ранний `CLEAN`
  считается protocol error и не может разрешить файл до полной отправки.
- `PrivateStorage` получил `reserveQuarantine`, возвращающий `QuarantineSnapshot`. Локальный adapter
  атомарно перемещает quarantine-файл под внутренний случайный ключ и не допускает подмену того же
  `uploadId` до `release`, `remove` или `promote`, сохраняя прежние проверки trusted root и path.
- Pipeline хеширует и сканирует только два открытия одного зарезервированного immutable snapshot,
  затем либо promote/remove, либо release обратно в quarantine.
- Для `npm run dev` `.env.example` использует `CLAMAV_HOST=127.0.0.1`; в комментарии указано
  контейнерное `CLAMAV_HOST=clamav` без публикации порта base Compose.

### GREEN и проверки

- `npx vitest run src/services/malware-scanner/clamav-client.test.ts src/modules/client-documents/file-validation.test.ts src/modules/client-documents/scan-upload.test.ts src/services/storage/local-private-storage.test.ts` — 4 test files, 31/31 tests успешно.
- `npm run typecheck` — успешно.

## Вторая волна исправлений review

### Причина и RED

- При ошибке соединения scanner возвращал `unavailable`, не закрывая входной `Readable`; на Windows
  это могло оставить handle snapshot открытым до `release`. Кроме того, возврат `false` из
  `socket.write(zero frame)` означал backpressure после принятия байтов в буфер, но считался
  неотправленным terminal frame. `getExtension` принимал bare имя `pdf` как расширение.
- RED: `npx vitest run src/services/malware-scanner/clamav-client.test.ts src/modules/client-documents/file-validation.test.ts src/modules/client-documents/scan-upload.test.ts` завершился с кодом 1: bare `pdf` проходил validation, `release` получал ещё открытый stream после connect failure, а valid `CLEAN` после принятого zero frame переходил в `unavailable`.

### Реализация

- `scanStream` теперь во всех exit paths уничтожает входной stream и ожидает его `close` до
  возврата verdict. Поэтому `scanPendingUpload` освобождает snapshot только после снятия handle.
- Terminal zero frame помечается отправленным сразу после `socket.write`, затем `socket.end`
  ставится в очередь независимо от return value backpressure; valid daemon response остаётся
  `CLEAN`.
- Расширение принимается только как непустой фактический suffix после точки, а не как bare name.

### GREEN и проверки

- `npx vitest run src/services/malware-scanner/clamav-client.test.ts src/modules/client-documents/file-validation.test.ts src/modules/client-documents/scan-upload.test.ts` — 3 test files, 28/28 tests успешно.
- Финальный focused-набор с `src/services/storage/local-private-storage.test.ts` — 4 test files, 37/37 tests успешно.
- `npm run typecheck` — успешно.
- Контроллер отдельно проверил доступный локальный ClamAV: safe fixture `CLEAN`, EICAR `infected` — 2/2.

### Operational concern

- In-memory reservation намеренно не пытается автоматически восстановить stale `scan-*` после
  crash/restart: имя snapshot не содержит исходный ключ, а эвристическая очистка может удалить
  проверяемый файл. Для безопасного recovery нужен отдельный durable reservation record и
  согласованный worker/runbook; это выходит за scope Task 2 и не добавляется без миграции.
