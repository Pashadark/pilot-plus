# Выкладка контура «клиент → договор → выдача»

Этот регламент предназначен для production-сервера Pilot+ и не разрешает запускать E2E-тесты или seed-команды на боевой базе. Все команды выполняются из отдельного релиза; каталог `current` переключается только после успешной сборки и миграции.

## 1. Предварительная проверка

```bash
set -euo pipefail
cd /opt/pilot-plus
readlink -f current
systemctl is-active pilot-plus
systemctl is-active pilot-plus-glonasssoft-worker
df -h / /opt/pilot-plus
du -sh /opt/pilot-plus/shared/private 2>/dev/null || true
```

Зафиксировать путь текущего релиза: он понадобится для быстрого отката приложения. Убедиться, что свободного места достаточно как минимум для новой сборки, дампа PostgreSQL и копии приватного хранилища.

## 2. Обязательная резервная копия

Создать каталог с отметкой времени и сделать дамп в custom-формате PostgreSQL:

```bash
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="/opt/pilot-plus/backups"
mkdir -p "$backup_dir"
docker exec pilot-postgres pg_dump -U pilot -d pilot \
  --format=custom --no-owner --no-acl \
  >"$backup_dir/pilot-$stamp.dump"
docker exec -i pilot-postgres pg_restore --list \
  <"$backup_dir/pilot-$stamp.dump" >/dev/null
tar -C /opt/pilot-plus/shared -czf \
  "$backup_dir/private-$stamp.tar.gz" private
test -s "$backup_dir/pilot-$stamp.dump"
test -s "$backup_dir/private-$stamp.tar.gz"
ls -lh "$backup_dir/pilot-$stamp.dump" "$backup_dir/private-$stamp.tar.gz"
```

Выкладка запрещена, если дамп или архив приватных файлов не созданы и не прошли проверки выше.

## 3. Системные зависимости

```bash
test -x /usr/bin/soffice
/usr/bin/soffice --version
docker inspect --format='{{.State.Health.Status}}' pilot-clamav
docker exec pilot-clamav clamdscan --version
```

LibreOffice нужен для PDF договора, ClamAV — для проверки клиентских документов. Вывод путей и команд не должен попадать в пользовательский интерфейс; в `/system` показывается только состояние компонентов.

## 4. Подготовка нового релиза

Пример для уже загруженного каталога `/opt/pilot-plus/releases/<RELEASE>`:

```bash
release="/opt/pilot-plus/releases/<RELEASE>"
cd "$release"
ln -sfn /opt/pilot-plus/shared/private private
npm ci
set -a
. /etc/pilot-plus.env
set +a
npx prisma generate --schema src/database/prisma/schema.prisma
npm run build
install -d -o pilot-plus -g pilot-plus -m 0755 "$release/.next/cache"
```

Не запускать `npm run db:seed`, тестовые импорты и любые команды, изменяющие существующие договоры или клиентов.

## 5. Миграция и переключение

```bash
previous="$(readlink -f /opt/pilot-plus/current)"
cd "$release"
npx prisma migrate deploy --schema src/database/prisma/schema.prisma
npx prisma generate --schema src/database/prisma/schema.prisma
ln -sfn "$release" /opt/pilot-plus/current
systemctl restart pilot-plus
systemctl restart pilot-plus-glonasssoft-worker
systemctl is-active pilot-plus
systemctl is-active pilot-plus-glonasssoft-worker
```

Сохранить значение `previous` в журнале выкладки.

## 6. Проверка после выкладки

```bash
curl -fsSI https://supapro.ru/login
curl -fsSI https://supapro.ru/system || true
cd /opt/pilot-plus/current
npm run rentals:readiness-report
journalctl -u pilot-plus -n 100 --no-pager
journalctl -u pilot-plus-glonasssoft-worker -n 100 --no-pager
```

Затем авторизованным суперпользователем выполнить один контролируемый smoke-сценарий на тестовом договоре:

1. Создать или открыть специально подготовленного клиента.
2. Загрузить паспорт и водительское удостоверение, дождаться статуса проверки.
3. Создать и подтвердить договор.
4. Дождаться готовности DOCX и PDF, скачать PDF.
5. Записать оплату аренды и залог.
6. Зафиксировать подписи клиента и компании.
7. Провести выдачу и обновить страницу — статус и введённые данные должны сохраниться.
8. Проверить `/system`: приложение, база, хранилище, очередь, ClamAV и LibreOffice должны иметь ожидаемый статус.

Нельзя использовать в smoke-сценарии реальный активный договор, менять его даты или закрывать его.

## 7. Откат приложения

При ошибке приложения переключить симлинк на сохранённый предыдущий релиз:

```bash
ln -sfn "$previous" /opt/pilot-plus/current
systemctl restart pilot-plus
systemctl restart pilot-plus-glonasssoft-worker
systemctl is-active pilot-plus
systemctl is-active pilot-plus-glonasssoft-worker
curl -fsSI https://supapro.ru/login
```

Не выполнять destructive down migrations. Применённая расширяющая миграция остаётся в базе и должна быть совместима с предыдущим приложением.

Восстановление PostgreSQL из дампа допустимо только отдельным решением при подтверждённой несовместимости данных. Перед восстановлением остановить приложение и worker, сделать дополнительный аварийный дамп текущего состояния и документировать потерю записей, появившихся после резервной копии.

## 8. E2E только на одноразовой среде

Полный браузерный тест запускается исключительно с отдельной одноразовой PostgreSQL-базой и отдельным приватным хранилищем:

```bash
PILOT_RENTALS_E2E=1 npx playwright test \
  tests/clients.spec.ts tests/rentals.spec.ts --workers=1
```

Перед запуском проверить, что `DATABASE_URL`, `PRIVATE_STORAGE_ROOT` и URL приложения не указывают на production. На production этот тест не запускается.
