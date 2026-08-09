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
