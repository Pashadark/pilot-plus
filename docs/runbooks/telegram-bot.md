# Telegram-бот Pilot+: установка на VPS

## Перед установкой

1. Дождитесь статуса VPS «Активен» в Aéza и запишите публичный IPv4.
2. Сначала проверьте вход по ключу `ssh -i ~/.ssh/pilot_plus_aeza_ed25519 root@SERVER_IP`.
3. Смените пароль root, который ранее был отправлен в чат: `passwd`.
4. Только после успешного входа по ключу отключите `PasswordAuthentication` и повторно проверьте SSH в отдельном терминале.
5. Разрешите входящие подключения только SSH; бот использует исходящий HTTPS и не открывает порт.

## Установка

Установите Docker Engine и Compose plugin из официального репозитория Docker для Ubuntu. Клонируйте Pilot+ в `/opt/pilot-plus`. Создайте `/etc/pilot-plus-bot.env`:

```dotenv
TELEGRAM_BOT_TOKEN=
PILOT_API_BASE_URL=https://pilot.example.com
PILOT_BOT_SERVICE_TOKEN=
REDIS_URL=redis://redis:6379/1
PILOT_STAFF_CHAT_ID=
REQUEST_TIMEOUT_SECONDS=8
```

Не коммитьте этот файл. Установите права и запустите:

```bash
chmod 600 /etc/pilot-plus-bot.env
cd /opt/pilot-plus
sudo sh bot/deploy/install.sh
systemctl status pilot-plus-bot
docker compose -f bot/docker-compose.bot.yaml logs --tail=100 telegram-bot
```

Логи не должны содержать токены, документы, телефоны, адреса или паспортные данные.

## Обновление и откат

Перед обновлением запишите текущий commit. Получите проверенный commit и перезапустите service. Для отката вернитесь на записанный commit и снова выполните `systemctl restart pilot-plus-bot`. Бизнес-данные находятся только в PostgreSQL Pilot+, Redis содержит временное FSM-состояние и не требует резервного копирования.

После компрометации перевыпустите BotFather token и `PILOT_BOT_SERVICE_TOKEN`, обновите `/etc/pilot-plus-bot.env`, затем перезапустите service.
