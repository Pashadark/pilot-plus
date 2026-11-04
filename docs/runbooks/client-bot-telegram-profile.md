# Профиль клиентского Telegram-бота Supa Pro

## Что настраивается автоматически

При запуске `bot/client_main.py` бот обновляет русские `short description` и `description` через Telegram Bot API. Ошибка настройки профиля не останавливает polling и не раскрывает токен в логах.

## Изображение welcome до `/start`

Telegram Bot API не предоставляет метод публикации description picture. Поэтому изображение настраивается один раз через официальный BotFather:

1. Открыть `@BotFather` из аккаунта владельца бота.
2. Выбрать клиентского бота Supa Pro.
3. Открыть `Edit Bot` → `Edit Description Picture`.
4. Загрузить `bot/assets/client-welcome.png` без обрезки и фильтров.
5. Открыть карточку бота с другого Telegram-аккаунта и проверить изображение до нажатия `/start`.

Аватар должен оставаться исходным `bot/assets/supapro-bot-avatar.png`. Его запрещено перерисовывать, перекрашивать, обрезать или заменять сгенерированным знаком.

## Проверка

```powershell
bot\.venv\Scripts\python.exe -m pytest bot/tests/test_presentation.py -q
```
