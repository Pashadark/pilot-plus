# Client Bot Welcome and Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в клиентский Telegram-бот Supa Pro утверждённые welcome-материалы, цветовую иерархию существующего меню, компактное состояние без аренды и единый формат уведомлений.

**Architecture:** Python-бот отвечает за профиль Telegram, локальные изображения, меню и устойчивую отправку media-сообщений. Next.js-модуль `bot-api` продолжает формировать факты уведомлений, но использует общий секционный formatter и явную аудиторию для текста действия. Состав меню и tenant-проверки не меняются.

**Tech Stack:** Python 3.12, aiogram 3.30, pytest, TypeScript 5, Vitest, Telegram Bot API.

## Global Constraints

- Единственное название продукта — **Supa Pro**; в русскоязычном тексте допустимо **СУПА ПРО**.
- Существующие шесть подписей клиентского меню и их порядок не менять.
- У кнопок Telegram доступны только `success`, `danger`, `primary` и стандартный стиль; жёлтый цвет не обещать.
- Изображение не заменяет текст: при ошибке загрузки всегда отправляются подпись и кнопки.
- Время событий выводить в `Europe/Moscow` с подписью `МСК`.
- Клиент получает только данные своей tenant-scoped действующей аренды.
- Текущий аватар `bot/assets/supapro-bot-avatar.png` не изменять; он показывает Supa Pro рядом с welcome-иллюстрацией в профиле Telegram.

---

### Task 1: Утверждённые ассеты и профиль Telegram

**Files:**

- Create: `bot/assets/client-welcome.png`
- Create: `bot/assets/client-rental-closed.png`
- Create: `bot/presentation.py`
- Modify: `bot/client_main.py`
- Create: `bot/tests/test_presentation.py`
- Create: `docs/runbooks/client-bot-telegram-profile.md`

**Interfaces:**

- Produces: `WELCOME_SHORT_DESCRIPTION: str`, `WELCOME_DESCRIPTION: str`, `configure_bot_presentation(bot) -> None`, `asset_path(name: str) -> Path`.
- Consumes: approved generated images and the existing unmodified Telegram avatar.

- [ ] **Step 1: Copy the two approved raster assets into the bot package**

Copy without changing the originals:

```powershell
Copy-Item -LiteralPath 'C:\Users\pasahdark\.codex\generated_images\019f6750-4141-7fb0-906c-a92740c37323\exec-8573d8c1-c4d2-455e-8a1e-5d213f6c8b98.png' -Destination 'bot\assets\client-welcome.png'
Copy-Item -LiteralPath 'C:\Users\pasahdark\.codex\generated_images\019f6750-4141-7fb0-906c-a92740c37323\exec-d9cf502e-647d-4777-a8cb-4e2ed2d55452.png' -Destination 'bot\assets\client-rental-closed.png'
```

- [ ] **Step 2: Write failing presentation tests**

```python
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from bot.presentation import (
    WELCOME_DESCRIPTION,
    WELCOME_SHORT_DESCRIPTION,
    asset_path,
    configure_bot_presentation,
)


def test_presentation_assets_and_copy_are_brand_safe():
    assert asset_path("client-welcome.png").is_file()
    assert asset_path("client-rental-closed.png").is_file()
    assert "Supa Pro" in WELCOME_SHORT_DESCRIPTION
    assert "СУПА ПРО" in WELCOME_DESCRIPTION
    assert len(WELCOME_SHORT_DESCRIPTION) <= 120
    assert len(WELCOME_DESCRIPTION) <= 512


@pytest.mark.asyncio
async def test_configure_bot_presentation_sets_both_descriptions():
    bot = AsyncMock()
    await configure_bot_presentation(bot)
    bot.set_my_short_description.assert_awaited_once_with(
        short_description=WELCOME_SHORT_DESCRIPTION,
        language_code="ru",
    )
    bot.set_my_description.assert_awaited_once_with(
        description=WELCOME_DESCRIPTION,
        language_code="ru",
    )
```

- [ ] **Step 3: Run the tests and verify failure**

Run: `bot\.venv\Scripts\python.exe -m pytest bot/tests/test_presentation.py -q`  
Expected: FAIL because `bot.presentation` does not exist.

- [ ] **Step 4: Implement presentation constants and startup configuration**

```python
from pathlib import Path


WELCOME_SHORT_DESCRIPTION = (
    "Помощник клиента Supa Pro: аренда, договор, залог, штрафы и предупреждения в поездке."
)
WELCOME_DESCRIPTION = (
    "СУПА ПРО помогает во время аренды: показывает договор, залог и штрафы, "
    "напоминает о сроках, предупреждает о скорости, резком разгоне и торможении "
    "и помогает быстро связаться с менеджером. Важные сообщения приходят "
    "автоматически, чтобы поездка была безопаснее и понятнее."
)


def asset_path(name: str) -> Path:
    return Path(__file__).resolve().parent / "assets" / name


async def configure_bot_presentation(bot) -> None:
    await bot.set_my_short_description(
        short_description=WELCOME_SHORT_DESCRIPTION,
        language_code="ru",
    )
    await bot.set_my_description(description=WELCOME_DESCRIPTION, language_code="ru")
```

Call `await configure_bot_presentation(bot)` in `bot/client_main.py` before polling. A failure must be logged as `bot_presentation_setup_failed=<ExceptionName>` and must not stop polling.

- [ ] **Step 5: Document the Telegram-only image step**

Create `docs/runbooks/client-bot-telegram-profile.md` with the exact BotFather action for publishing `bot/assets/client-welcome.png` as the description picture. State that the avatar remains `bot/assets/supapro-bot-avatar.png` and must not be redrawn.

- [ ] **Step 6: Run presentation tests**

Run: `bot\.venv\Scripts\python.exe -m pytest bot/tests/test_presentation.py bot/tests/test_client_entrypoint.py -q`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add bot/assets/client-welcome.png bot/assets/client-rental-closed.png bot/presentation.py bot/client_main.py bot/tests/test_presentation.py docs/runbooks/client-bot-telegram-profile.md
git commit -m "feat: add Supa Pro client bot presentation"
```

### Task 2: Цветовая иерархия существующего клиентского меню

**Files:**

- Modify: `bot/keyboards/client.py`
- Modify: `bot/tests/test_keyboards.py`
- Modify: `bot/tests/test_customer_menu.py`

**Interfaces:**

- Produces: unchanged `client_main_menu() -> InlineKeyboardMarkup` labels and callbacks; new `unresolved_rental_actions() -> InlineKeyboardMarkup`.

- [ ] **Step 1: Write failing button-style tests**

```python
def test_client_menu_keeps_labels_and_uses_semantic_colors():
    rows = client_main_menu().inline_keyboard
    assert rows[0][0].text == "🚗 Моя аренда"
    assert rows[0][0].style == "success"
    assert rows[0][1].style is None
    assert rows[1][0].style is None
    assert rows[1][1].style is None
    assert rows[2][0].style is None
    assert rows[2][1].text == "💬 Связаться с менеджером"
    assert rows[2][1].style == "danger"


def test_unresolved_rental_actions_are_clear_and_colored():
    rows = unresolved_rental_actions().inline_keyboard
    assert [(button.text, button.style) for row in rows for button in row] == [
        ("💬 Связаться с менеджером", "danger"),
        ("🔄 Проверить ещё раз", "primary"),
    ]
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `bot\.venv\Scripts\python.exe -m pytest bot/tests/test_keyboards.py bot/tests/test_customer_menu.py -q`  
Expected: FAIL because the main button is still `primary` and the new keyboard is missing.

- [ ] **Step 3: Implement minimal keyboard changes**

Set only `🚗 Моя аренда` to `style="success"`, remove `style="success"` from `📅 Продлить`, set `💬 Связаться с менеджером` to `style="danger"`, and add:

```python
def unresolved_rental_actions() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="💬 Связаться с менеджером",
            callback_data=COMMON_HELP,
            style="danger",
        )],
        [InlineKeyboardButton(
            text="🔄 Проверить ещё раз",
            callback_data="client:menu",
            style="primary",
        )],
    ])
```

- [ ] **Step 4: Run keyboard tests**

Run: `bot\.venv\Scripts\python.exe -m pytest bot/tests/test_keyboards.py bot/tests/test_customer_menu.py -q`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bot/keyboards/client.py bot/tests/test_keyboards.py bot/tests/test_customer_menu.py
git commit -m "feat: color client bot menu actions"
```

### Task 3: Компактное media-состояние без определённой аренды

**Files:**

- Create: `bot/messages/client_states.py`
- Create: `bot/messages/__init__.py`
- Modify: `bot/handlers/start.py`
- Modify: `bot/handlers/customer.py`
- Modify: `bot/tests/test_client_authorization.py`
- Modify: `bot/tests/test_customer_handlers.py`

**Interfaces:**

- Produces: `UNRESOLVED_RENTAL_TEXT: str`, `send_unresolved_rental(message) -> None`.
- Consumes: `asset_path("client-rental-closed.png")` and `unresolved_rental_actions()`.

- [ ] **Step 1: Write failing delivery and fallback tests**

```python
@pytest.mark.asyncio
async def test_unresolved_rental_sends_compact_photo_with_actions():
    message = AsyncMock()
    await send_unresolved_rental(message)
    message.answer_photo.assert_awaited_once()
    kwargs = message.answer_photo.await_args.kwargs
    assert kwargs["caption"] == UNRESOLVED_RENTAL_TEXT
    assert kwargs["parse_mode"] == "HTML"
    assert kwargs["reply_markup"].inline_keyboard[0][0].style == "danger"


@pytest.mark.asyncio
async def test_unresolved_rental_falls_back_to_text():
    message = AsyncMock()
    message.answer_photo.side_effect = RuntimeError("telegram media failed")
    await send_unresolved_rental(message)
    message.answer.assert_awaited_once()
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bot\.venv\Scripts\python.exe -m pytest bot/tests/test_client_authorization.py bot/tests/test_customer_handlers.py -q`  
Expected: FAIL because `bot.messages.client_states` does not exist.

- [ ] **Step 3: Implement the shared state sender**

```python
from aiogram.types import FSInputFile

from bot.keyboards.client import unresolved_rental_actions
from bot.presentation import asset_path


UNRESOLVED_RENTAL_TEXT = (
    "🔒 <b>Аренда не определена</b>\n\n"
    "👤 <b>Профиль</b>\n└ Телефон подтверждён\n\n"
    "📍 <b>Статус</b>\n└ Не удалось однозначно определить действующую аренду.\n\n"
    "⚡ <b>Действие</b>\n"
    "└ Свяжитесь с менеджером — он проверит договор и привязку автомобиля."
)


async def send_unresolved_rental(message) -> None:
    markup = unresolved_rental_actions()
    try:
        await message.answer_photo(
            photo=FSInputFile(asset_path("client-rental-closed.png")),
            caption=UNRESOLVED_RENTAL_TEXT,
            parse_mode="HTML",
            reply_markup=markup,
        )
    except Exception:
        await message.answer(UNRESOLVED_RENTAL_TEXT, parse_mode="HTML", reply_markup=markup)
```

Use the sender for `MANAGER_REVIEW_REQUIRED` and for a confirmed client profile with no active/confirmed rental. Do not expose another client's rental during retry.

- [ ] **Step 4: Run focused client tests**

Run: `bot\.venv\Scripts\python.exe -m pytest bot/tests/test_client_authorization.py bot/tests/test_customer_handlers.py bot/tests/test_customer_menu.py -q`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bot/messages bot/handlers/start.py bot/handlers/customer.py bot/tests/test_client_authorization.py bot/tests/test_customer_handlers.py
git commit -m "feat: add unresolved rental bot state"
```

### Task 4: Единый секционный formatter для GPS-уведомлений по аудитории

**Files:**

- Modify: `src/modules/bot-api/telegram-message.ts`
- Modify: `src/modules/bot-api/operational-alerts.ts`
- Modify: `src/modules/bot-api/operational-alerts.test.ts`
- Modify: `src/modules/bot-api/telegram-message.test.ts`

**Interfaces:**

- Produces: `OperationalAlertAudience = 'CLIENT' | 'MANAGER' | 'SUPER_ADMIN'`; `formatOperationalAlertForAudience(input, audience) -> string`.
- Preserves: `formatOperationalAlert(input) -> string` as the manager-compatible wrapper.

- [ ] **Step 1: Add failing audience-format tests**

```typescript
it.each([
  ['CLIENT', 'Снизьте скорость и продолжайте движение безопасно'],
  ['MANAGER', 'Связаться с водителем и потребовать снизить скорость'],
  ['SUPER_ADMIN', 'Проверить обработку события ответственным менеджером'],
] as const)('formats speeding for %s in the shared block layout', (audience, action) => {
  const message = formatOperationalAlertForAudience(speedingInput, audience);
  expect(message).toContain('⚡ <b>Превышение скорости</b>');
  expect(message).toContain('🚗 <b>Авто</b>');
  expect(message).toContain('👤 <b>Клиент</b>');
  expect(message).toContain('📍 <b>Событие</b>');
  expect(message).toContain(`⚡ <b>Действие</b>\n└ ${action}`);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/bot-api/operational-alerts.test.ts src/modules/bot-api/telegram-message.test.ts`  
Expected: FAIL because `formatOperationalAlertForAudience` is missing.

- [ ] **Step 3: Implement audience-aware actions through the shared formatter**

Add:

```typescript
export type OperationalAlertAudience = 'CLIENT' | 'MANAGER' | 'SUPER_ADMIN';

const speedingActions: Record<OperationalAlertAudience, string> = {
  CLIENT: 'Снизьте скорость и продолжайте движение безопасно',
  MANAGER: 'Связаться с водителем и потребовать снизить скорость',
  SUPER_ADMIN: 'Проверить обработку события ответственным менеджером',
};
```

Build the title, `Авто`, `Клиент`, `Событие`, and `Действие` blocks with `telegramSection()` and `formatTelegramMessage()`. Keep `formatOperationalAlert(input)` delegating to `formatOperationalAlertForAudience(input, 'MANAGER')` so existing callers remain compatible. Apply the same audience rule to `HARSH_ACCELERATION` and `HARSH_BRAKING`; do not change thresholds or event facts.

- [ ] **Step 4: Run formatter tests**

Run: `npx vitest run src/modules/bot-api/operational-alerts.test.ts src/modules/bot-api/telegram-message.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/bot-api/telegram-message.ts src/modules/bot-api/operational-alerts.ts src/modules/bot-api/operational-alerts.test.ts src/modules/bot-api/telegram-message.test.ts
git commit -m "refactor: unify GPS bot message layout"
```

### Task 5: End-to-end regression and delivery verification

**Files:**

- Modify: `bot/tests/test_notifications.py`
- Modify: `src/modules/bot-api/gps-event-notifications.test.ts`
- Modify: `docs/PROJECT_GUIDE.md`

**Interfaces:**

- Verifies the existing notification claim/ack flow, tenant isolation, stable event keys, and role-safe formatting.

- [ ] **Step 1: Add regression tests**

Python assertions:

```python
assert notification_target(client_job) == 5370970341
assert notification_target(cross_company_job) raises ValueError
```

TypeScript assertions:

```typescript
expect(result).toEqual({ staffQueued: true, clientQueued: true });
expect(createMany).toHaveBeenCalledWith(
  expect.objectContaining({
    data: [expect.objectContaining({ eventKey: `gps-event:client:${eventId}` })],
    skipDuplicates: true,
  }),
);
```

- [ ] **Step 2: Run the full bot suite**

Run: `bot\.venv\Scripts\python.exe -m pytest bot/tests -q`  
Expected: PASS.

- [ ] **Step 3: Run the relevant TypeScript suite**

Run: `npx vitest run src/modules/bot-api/operational-alerts.test.ts src/modules/bot-api/telegram-message.test.ts src/modules/bot-api/gps-event-notifications.test.ts src/modules/bot-api/notifications.test.ts`  
Expected: PASS.

- [ ] **Step 4: Run static checks**

Run: `npm run typecheck`  
Expected: PASS.

Run: `npm run lint`  
Expected: PASS.

- [ ] **Step 5: Update the project guide**

Document that the client bot now owns Telegram presentation, semantic button colors, compact unresolved-rental media state, and shared role-aware GPS message formatting. Do not claim the BotFather description picture is live until it is actually published.

- [ ] **Step 6: Commit**

```bash
git add bot/tests/test_notifications.py src/modules/bot-api/gps-event-notifications.test.ts docs/PROJECT_GUIDE.md
git commit -m "test: verify client bot presentation flow"
```
