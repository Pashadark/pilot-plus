# Живая карта GLONASSSoft: эксплуатация

## Назначение

`pilot-plus-glonasssoft-worker` раз в две секунды запрашивает одним пакетом последние позиции связанных автомобилей, идемпотентно сохраняет новые точки и публикует tenant-событие в Redis. Открытая карта получает свежий снимок через `/api/map/live`.

## Обязательная конфигурация

В `/etc/pilot-plus.env` с правами `0600`, владельцем `pilot-plus`, задаются `DATABASE_URL`, `CLIENT_DATA_ENCRYPTION_KEY`, `REDIS_HOST` и `REDIS_PORT`. Учётные данные GLONASSSoft остаются зашифрованными в `TelematicsIntegration`. Секреты запрещено помещать в unit-файл, Git или журнал.

## Установка

```bash
sudo install -o root -g root -m 0644 deploy/pilot-plus-glonasssoft-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pilot-plus-glonasssoft-worker
sudo systemctl status pilot-plus-glonasssoft-worker --no-pager
```

## Проверка

Логи не содержат учётных данных:

```bash
sudo journalctl -u pilot-plus-glonasssoft-worker -n 50 --no-pager
```

В PostgreSQL `lastAttemptAt` должен обновляться примерно раз в две секунды, `lastSuccessAt` — после успешного ответа. Когда Sputnik Vision получает новую точку, `MAX(recordedAt)` для `provider='GLONASSSOFT'` должен увеличиться. В браузере запрос `/api/map/live` остаётся открытым и получает последующие события `snapshot`; скорость и положение меняются без перезагрузки.

## Сбой и откат

При ошибке провайдера последняя позиция не удаляется, а worker продолжает попытки. Если `lastSuccessAt` старше одной минуты, требуется оповещение. Для отката остановить только worker: `sudo systemctl disable --now pilot-plus-glonasssoft-worker`; сайт продолжит показывать последний сохранённый снимок. После устранения причины выполнить `sudo systemctl restart pilot-plus-glonasssoft-worker`.
