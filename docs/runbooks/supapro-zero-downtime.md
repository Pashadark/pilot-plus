# Supa Pro: обновления без отключения сайта

## Назначение

Веб-приложение работает в одном из двух слотов: `blue` на `127.0.0.1:3001` или `green` на `127.0.0.1:3002`. При выкладке неактивный слот собирается и запускается первым. Nginx получает новую точку назначения только после успешного HTTP canary и наличия Next.js deployment ID. Старый процесс останавливается после дренирования и уже не принимает пользовательский трафик.

## Постоянные серверные файлы

- `/etc/systemd/system/supapro-web@.service` — шаблон слота.
- `/etc/supapro-web-blue.env`, `/etc/supapro-web-green.env` — только номера портов.
- `/etc/supapro-build.env` — стабильный `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, права `0600`.
- `/etc/nginx/snippets/supapro-active-upstream.conf` — активный loopback upstream.
- `/opt/pilot-plus/shared/active-web-slot` — имя текущего слота.
- `/usr/local/sbin/supapro-zero-downtime-deploy` — проверяемый переключатель.

Секрет Server Actions нельзя менять при обычной выкладке и нельзя выводить в журналы. `NEXT_DEPLOYMENT_ID` для каждой сборки равен имени каталога релиза, если явно не задан `SUPAPRO_DEPLOYMENT_ID`.

## Выкладка

Перед переключением сохранить текущий релиз, сделать проверяемый дамп PostgreSQL и подготовить новый каталог внутри `/opt/pilot-plus/releases`.

```bash
current=$(readlink -f /opt/pilot-plus/current)
release=/opt/pilot-plus/releases/<release-name>
/usr/local/sbin/supapro-zero-downtime-deploy "$release"
systemctl is-active "supapro-web@$(cat /opt/pilot-plus/shared/active-web-slot)"
curl -fsS https://supapro.ru/login >/dev/null
```

Скрипт сам выполняет Prisma Client generation и production build, запускает неактивный слот, проверяет `/login`, проверяет deployment ID, тестирует Nginx, переключает трафик и выполняет внешний canary. Прежний слот останавливается после 130 секунд дренирования — это больше максимального 120-секундного ожидания потокового запроса карты.

Перед сборкой скрипт требует `postcss.config.mjs`, а перед переключением трафика проверяет наличие базовых Tailwind utilities в собранном CSS. Это защищает production от запуска релиза с «голой» HTML-разметкой при неполной упаковке исходников.

## Откат

Откат выполняется тем же способом: передать сохранённый предыдущий каталог релиза скрипту. Это также остаётся переключением без остановки активной версии.

```bash
/usr/local/sbin/supapro-zero-downtime-deploy "$current"
```

Если ошибка возникает до переключения Nginx, текущий сайт не меняется. Если внешний canary после переключения не проходит, скрипт восстанавливает прежний upstream и `/opt/pilot-plus/current`.

## Проверка инцидента

```bash
journalctl -u 'supapro-web@*' --since '30 minutes ago' --no-pager
tail -100 /var/log/nginx/error.log
systemctl show "supapro-web@$(cat /opt/pilot-plus/shared/active-web-slot)" \
  -p ActiveState -p MemoryCurrent -p NRestarts
```

Нормальное обновление не должно создавать `connect() failed (111: Connection refused)` для `supapro_backend` и не должно возвращать 502 во время переключения.
