# Авито → заявки

## Поток
Авито отправляет webhook на закрытый URL. Приёмник сохраняет только идентификаторы в `AvitoInboxEvent`. `pilot-plus-avito.service` читает исходное сообщение через официальный API, проверяет аккаунт, входящее направление и `AVITO_ENABLED_AT`, затем атомарно создаёт/дополняет заявку, аудит и Telegram outbox.

Текст и телефон хранятся существующим AES-GCM механизмом. Один чат = одна заявка. Последующие сообщения добавляются в комментарий, не меняют статус/назначение/контакт, установленный менеджером. Распознавание — локальные правила, не внешняя AI-модель; неоднозначное требует проверки. Исторические сообщения не импортируются. Входящее новое сообщение в старом чате принимается.

## Секреты и сервис
- `/etc/pilot-plus-avito.env`, root:root 0600; не выводить содержимое.
- `AVITO_CLIENT_ID`, `AVITO_CLIENT_SECRET`, `AVITO_ACCOUNT_ID`, `AVITO_COMPANY_ID`, `AVITO_USER_ID`, `AVITO_ENABLED_AT`, `AVITO_WEBHOOK_SECRET`.
- Web service drop-in: `/etc/systemd/system/pilot-plus.service.d/avito.conf`.
- `systemctl status pilot-plus-avito`; журнал содержит только безопасные коды/внутренние ID.
- Прокси не пишет URL приёмника в access log. Не включать запросы этого пути в аналитические логи.

## Ограничения и ошибки
Нет отправки клиентам, отметки прочтения, изменения объявлений/брони. Не более одного сетевого вызова в секунду в единственном worker. HTTP429 учитывает Retry-After и откладывает очередь. HTTP400/401/402/403 останавливает worker с exit78 без бесконечных попыток; после проверки ключей/подписки оператор запускает сервис вручную. Другие ошибки — экспоненциальная задержка, максимум 10 попыток; FAILED не удаляются.

Очередь ограничена 1000 необработанными событиями; тело callback — 16KiB. Большие переписки требуют ручного продолжения после лимита комментария 500000 символов. Поиск конкретного сообщения ограничен 1100 последними сообщениями чата. Не запускать несколько экземпляров worker. Транзакции serializable и стабильные ID защищают от дублей при повторном запуске.

## Проверка
Сначала dry-run чтения одной записи без записи в БД. Затем новое реальное входящее сообщение после подключения: событие DONE, одна заявка source=Авито, существующее BotNotificationJob переходит SENT. Повторная доставка не создаёт другую заявку/уведомление. Без реального входящего сообщения сквозная доставка не считается подтверждённой.

## Отключение и откат
`systemctl stop pilot-plus-avito` останавливает обработку; сообщения остаются в очереди. Отписывать только наш точный URL через официальный unsubscribe, не чужие интеграции. Предыдущий релиз `/opt/pilot-plus/releases/20260923-toll-cards` сохранён, backup БД `/opt/pilot-plus/backups/pre-avito-20260924.dump`. При откате приложения также остановить worker и отключить наш webhook; таблицу/заявки не удалять. Не менять ENABLED_AT при обычном рестарте: это потеряет ожидающие новые обращения.
# Assistant preview (24.09.2026)

The assistant extension is gated by `AVITO_ASSISTANT_ENABLED_AT`. Without a valid timestamp the original read-only intake runs unchanged. With a timestamp, only new messages on the 11 approved, active, owned rental ads enter encrypted dialogue state. Sales and unknown ads are excluded. `AVITO_SEND_ENABLED` defaults to false and must stay false until an owner-controlled new chat verifies the outgoing API contract. Do not test using an existing customer's conversation.

The preview collects explicit model, full numeric dates with year and time, total planned mileage and phone. Unsupported/ambiguous wording remains missing for manager clarification. Phones arriving later fill an empty lead phone only, never overwrite one entered by a manager. Fleet matching reads the real tenant inventory, confirmed/active rentals and maintenance; it does not reserve a vehicle.

Manager reminders are single-per-waiting-episode at 15 minutes. A fresh authoritative history scan precedes enqueue. Assistant messages do not close waiting; human messages pause questions. Unknown send outcomes block further sends and defer reminders until manually reconciled, to avoid confusing a bot reply with a human reply. No blind retry of SENDING/UNKNOWN jobs. Review these states after every incident.

Protected tables: `AvitoDialogue.contentEncrypted`, `AvitoOutgoing.textEncrypted`. Do not print decrypted conversation data. Disable sending with `AVITO_SEND_ENABLED=false` and restart `pilot-plus-avito`; intake and reminders continue. Clear the assistant activation variable only to return to original intake behavior. Rollback uses the preserved previous release without dropping new tables.

Required live acceptance still outstanding: owner's new rental conversation, first automatic question, customer answers across several messages, human handover and Telegram reminder delivery. Unit tests are not evidence that a customer message was actually delivered. Official web documentation was inaccessible from the research tool; verify the send endpoint using the controlled conversation before general activation.

