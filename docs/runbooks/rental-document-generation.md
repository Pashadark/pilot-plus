# Генерация пары договора DOCX/PDF

Генерация запускается только для `CONFIRMED` аренды и берёт значения только из immutable snapshot.
Один DOCX создаётся из snapshot, тот же массив байтов передаётся LibreOffice для PDF. Оба результата
сначала проходят приватный ClamAV pipeline, затем в одной Serializable транзакции создаются две
`RentalDocumentVersion` одной версии. При ошибке конвертации, сканирования или транзакции quarantine
и уже promoted private artifacts удаляются; частичной доступной версии не возникает.

Каждая попытка до первого storage write создаёт `RentalDocumentGeneration` со статусом `PENDING` и
уникальными quarantine/final keys. После двух promotions запись становится `PROMOTED`; та же
Serializable transaction сохраняет metadata и переводит её в `COMMITTED`. Неудача переходит в `ERROR`.
Lease ограничивает зависшую работу 15 минутами: внешний scheduler `npm run client-documents:reconcile`
удаляет только expired `PENDING`/`PROMOTED` keys, bounded retry выполняет до трёх раз. Никогда не
очищайте `COMMITTED` запись вручную через filesystem.

Перед filesystem cleanup reconciler атомарно переводит exact expired строку в `CLEANING` с уникальным
`claimToken`. Если generator успел renew/promote/commit, claim возвращает `0`, а file operations не
запускаются. После claim только worker с тем же token вправе завершить cleanup. Generator CAS для renew,
promotion и commit требует `claimToken = null`, поэтому не может продолжить работу после cleanup claim.

## Runtime prerequisites

- В image процесса приложения установлен LibreOffice Writer. Используйте фиксированный абсолютный
  `RENTAL_DOCUMENT_CONVERTER_EXECUTABLE`: `/usr/bin/soffice` в Linux image или утверждённый absolute
  Windows path. Не передавайте путь, имя DOCX или параметры из HTTP/UI в executable или аргументы.
- `PRIVATE_STORAGE_ROOT`, ClamAV и ACL соответствуют
  [runbook reconciliation](client-document-upload-reconciliation.md). Storage остаётся private;
  contract artifacts не кладутся в `public`, `.next` или shared temp directory.
- Конвертер ограничен 45 секундами, 15 MiB input/output и 64 KiB stdout/stderr. Ошибки для пользователя
  не содержат stdout, stderr, временных путей, contract data или PII.

`rental-document-runtime` — opt-in Compose profile для Linux smoke test. Это не сетевой document API:
приложение запускает `soffice` как дочерний процесс без shell и с отдельным временным профилем для
каждой конвертации.

```powershell
docker compose -f compose.yaml -f compose.dev.yaml --profile rental-documents build rental-document-runtime
docker compose -f compose.yaml -f compose.dev.yaml --profile rental-documents run --rm rental-document-runtime
```

Команда запускает `RUN_RENTAL_DOCUMENT_CONVERTER_INTEGRATION=1` и проверяет, что DOCX из реального
snapshot даёт `%PDF-`. Перед production rollout дополнительно сгенерируйте тестовую пару в staging,
скачайте оба защищёнными маршрутами и визуально проверьте страницы PDF через Poppler: номер, номер
автомобиля, даты и итог должны совпадать с DOCX. Не используйте production или shared DB для smoke
test и не применяйте миграции этой процедурой.

## Failure response

Если LibreOffice не установлен, timeout, output cap или PDF header validation срабатывают, генерация
возвращает безопасную ошибку и не создаёт metadata pair. Проверьте executable внутри image, свободное
место/`tmpfs`, ClamAV и private storage ACL; не включайте debug-логи с bytes, аргументами процесса,
storage keys или персональными данными. После исправления повторите генерацию: уже complete pair
идемпотентно возвращает существующую версию, а параллельные попытки сходятся к одной версии.

При `P2002` или неясном результате Serializable commit генератор повторно читает exact complete
`DOCX`+`PDF` pair этого rental. Только complete pair возвращается как идемпотентный успех; собственные
generation-scoped keys проигравшей попытки удаляются, поэтому они не могут затронуть чужую пару.
