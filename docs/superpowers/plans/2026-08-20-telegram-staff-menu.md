# Telegram Staff Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead inline staff button with a persistent seven-section Telegram reply menu whose every action responds and remains tenant-authorized through Pilot+ API identity resolution.

**Architecture:** `bot/keyboards/staff.py` owns all staff labels and reply markup. A focused `bot/handlers/staff.py` router re-resolves the Telegram identity through Pilot+ for every staff action, returns live data when a protected API exists, returns explicit Russian preparation copy otherwise, and acknowledges the legacy inline callback. `bot/main.py` registers this router after existing stateful rental handlers so it can provide safe navigation fallback without stealing FSM messages.

**Tech Stack:** Python 3.12, aiogram 3.30, pytest 8, pytest-asyncio, Docker Compose, Redis FSM, protected Next.js Pilot+ API.

## Global Constraints

- The bot accesses Pilot+ only through the protected HTTP API and never connects directly to PostgreSQL.
- All keyboard definitions and button labels live under `bot/keyboards`.
- The staff reply menu labels are exactly `Заявки`, `Аренды`, `Календарь`, `Клиенты`, `Автопарк`, `Штрафы`, and `Помощь`.
- Inline keyboards remain only for entity-bound contextual actions.
- Every callback is acknowledged and every visible reply-menu action returns a Russian response.
- Staff identity and role are re-resolved before staff content is returned; linked clients cannot use staff handlers.
- No client PII is logged.

---

### Task 1: Persistent staff keyboard

**Files:**
- Modify: `bot/keyboards/staff.py`
- Modify: `bot/tests/test_keyboards.py`

**Interfaces:**
- Produces: constants `STAFF_REQUESTS_TEXT`, `STAFF_RENTALS_TEXT`, `STAFF_CALENDAR_TEXT`, `STAFF_CLIENTS_TEXT`, `STAFF_FLEET_TEXT`, `STAFF_FINES_TEXT`, `STAFF_HELP_TEXT`.
- Produces: `STAFF_MENU_LABELS: frozenset[str]` and `staff_main_menu() -> ReplyKeyboardMarkup`.

- [ ] **Step 1: Write the failing keyboard test**

```python
from aiogram.types import ReplyKeyboardMarkup
from bot.keyboards.staff import STAFF_MENU_LABELS, staff_main_menu

def test_staff_menu_is_persistent_reply_keyboard_with_all_sections():
    markup = staff_main_menu()
    assert isinstance(markup, ReplyKeyboardMarkup)
    assert markup.resize_keyboard is True
    labels = [button.text for row in markup.keyboard for button in row]
    assert labels == ["Заявки", "Аренды", "Календарь", "Клиенты", "Автопарк", "Штрафы", "Помощь"]
    assert STAFF_MENU_LABELS == frozenset(labels)
```

- [ ] **Step 2: Run the test and verify RED**

Run: `python -m pytest bot/tests/test_keyboards.py -q`

Expected: FAIL because `staff_main_menu()` returns `InlineKeyboardMarkup` and the label exports do not exist.

- [ ] **Step 3: Implement the minimal keyboard**

```python
from aiogram.types import KeyboardButton, ReplyKeyboardMarkup

STAFF_REQUESTS_TEXT = "Заявки"
STAFF_RENTALS_TEXT = "Аренды"
STAFF_CALENDAR_TEXT = "Календарь"
STAFF_CLIENTS_TEXT = "Клиенты"
STAFF_FLEET_TEXT = "Автопарк"
STAFF_FINES_TEXT = "Штрафы"
STAFF_HELP_TEXT = "Помощь"
STAFF_MENU_LABELS = frozenset(
    {
        STAFF_REQUESTS_TEXT,
        STAFF_RENTALS_TEXT,
        STAFF_CALENDAR_TEXT,
        STAFF_CLIENTS_TEXT,
        STAFF_FLEET_TEXT,
        STAFF_FINES_TEXT,
        STAFF_HELP_TEXT,
    }
)

def staff_main_menu() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=STAFF_REQUESTS_TEXT), KeyboardButton(text=STAFF_RENTALS_TEXT)],
            [KeyboardButton(text=STAFF_CALENDAR_TEXT), KeyboardButton(text=STAFF_CLIENTS_TEXT)],
            [KeyboardButton(text=STAFF_FLEET_TEXT), KeyboardButton(text=STAFF_FINES_TEXT)],
            [KeyboardButton(text=STAFF_HELP_TEXT)],
        ],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Выберите раздел Pilot+",
    )
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `python -m pytest bot/tests/test_keyboards.py -q`

Expected: all keyboard tests PASS.

- [ ] **Step 5: Commit**

```bash
git add bot/keyboards/staff.py bot/tests/test_keyboards.py
git commit -m "feat(bot): add persistent staff keyboard"
```

### Task 2: Authorized staff menu handlers

**Files:**
- Create: `bot/handlers/staff.py`
- Create: `bot/tests/test_staff_handlers.py`
- Modify: `bot/main.py`

**Interfaces:**
- Consumes: `STAFF_MENU_LABELS` and the seven label constants from Task 1.
- Consumes: `pilot_api.profile(telegram_user_id: str) -> dict`.
- Produces: `router`, registered after `rentals_router` in `bot/main.py`.
- Produces: async `require_staff(message_or_callback, pilot_api) -> bool` internal authorization helper.

- [ ] **Step 1: Write failing tests for authorization and all actions**

```python
@pytest.mark.asyncio
async def test_each_staff_label_returns_a_message_for_staff():
    api = FakeApi({"kind": "STAFF", "displayName": "Павел Седов"})
    for label in STAFF_MENU_LABELS:
        message = FakeMessage(text=label, telegram_id=185185047)
        await staff_menu_action(message, api)
        assert message.answers

@pytest.mark.asyncio
async def test_client_cannot_use_staff_menu():
    api = FakeApi({"kind": "CLIENT", "displayName": "Клиент"})
    message = FakeMessage(text=STAFF_REQUESTS_TEXT, telegram_id=42)
    await staff_menu_action(message, api)
    assert message.answers == ["Этот раздел доступен только сотрудникам Pilot+."]

@pytest.mark.asyncio
async def test_legacy_staff_callback_is_acknowledged():
    callback = FakeCallback(telegram_id=185185047)
    await legacy_staff_requests(callback, FakeApi({"kind": "STAFF"}))
    assert callback.answered is True
    assert callback.message.answers
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `python -m pytest bot/tests/test_staff_handlers.py -q`

Expected: FAIL because `bot.handlers.staff` does not exist.

- [ ] **Step 3: Implement exact-label routing and safe responses**

Create a router with:

```python
SECTION_RESPONSES = {
    STAFF_REQUESTS_TEXT: "Заявки клиентов пока готовятся. Новые заявки будут появляться здесь.",
    STAFF_RENTALS_TEXT: "Раздел аренды в Telegram готовится. Все договоры доступны в Pilot+.",
    STAFF_CALENDAR_TEXT: "Календарь в Telegram готовится. Расписание доступно в Pilot+.",
    STAFF_CLIENTS_TEXT: "Раздел клиентов в Telegram готовится. Карточки доступны в Pilot+.",
    STAFF_FLEET_TEXT: "Автопарк в Telegram готовится. Машины доступны в Pilot+.",
    STAFF_FINES_TEXT: "Штрафы в Telegram готовятся. Актуальный список доступен в Pilot+.",
    STAFF_HELP_TEXT: "Pilot+ поможет с заявками, арендами, клиентами, автопарком и штрафами.",
}
```

`staff_menu_action` must call `pilot_api.profile(str(message.from_user.id))`; on API failure answer `Не удалось связаться с Pilot+. Попробуйте ещё раз.`; on non-staff answer `Этот раздел доступен только сотрудникам Pilot+.`; on staff answer the exact mapped text and attach `staff_main_menu()`.

`legacy_staff_requests` must authorize the same way, send the requests response, and always call `callback.answer()`. Add a final plain-message fallback that re-resolves identity, returns the staff menu hint only for staff, and otherwise does not expose staff content.

- [ ] **Step 4: Register the router**

In `bot/main.py`:

```python
from bot.handlers.staff import router as staff_router

dispatcher.include_router(start_router)
dispatcher.include_router(rentals_router)
dispatcher.include_router(staff_router)
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `python -m pytest bot/tests/test_staff_handlers.py bot/tests/test_keyboards.py bot/tests/test_rental_handlers.py -q`

Expected: all focused tests PASS.

- [ ] **Step 6: Run the complete bot test suite**

Run: `python -m pytest bot/tests -q`

Expected: all tests PASS with no warnings or errors.

- [ ] **Step 7: Commit**

```bash
git add bot/handlers/staff.py bot/tests/test_staff_handlers.py bot/main.py
git commit -m "fix(bot): handle every staff menu action"
```

### Task 3: Deployment and real-path verification

**Files:**
- Modify only if verification exposes a defect: `bot/docker-compose.bot.yaml`, `bot/deploy/pilot-plus-bot.service`
- Test: VPS `/opt/pilot-plus/bot` deployment and Telegram Bot API health.

**Interfaces:**
- Consumes: committed bot source and `/etc/pilot-plus-bot.env`.
- Produces: healthy `bot-telegram-bot-1` container running the new keyboard and handlers.

- [ ] **Step 1: Run local static verification**

Run: `python -m compileall -q bot && python -m pytest bot/tests -q`

Expected: exit 0 and all bot tests PASS.

- [ ] **Step 2: Package only committed bot files**

Run: `git archive --format=tar.gz -o ../../.codex-tmp/telegram-bot.tar.gz HEAD bot`

Expected: archive exists and contains no `.env`, cache, or private key.

- [ ] **Step 3: Upload and replace the verified bot source**

Upload the archive with the existing deployment SSH key. On the VPS, verify `/opt/pilot-plus/bot` resolves exactly to that path, replace only that directory, and extract the archive under `/opt/pilot-plus`.

- [ ] **Step 4: Rebuild and restart**

Run on VPS:

```bash
cd /opt/pilot-plus
PILOT_BOT_ENV_FILE=/etc/pilot-plus-bot.env docker compose -f bot/docker-compose.bot.yaml up -d --build
```

Expected: `bot-redis-1` and `bot-telegram-bot-1` are running.

- [ ] **Step 5: Verify health and logs**

Run on VPS:

```bash
docker inspect bot-telegram-bot-1 --format 'status={{.State.Status}} health={{.State.Health.Status}} restart={{.RestartCount}}'
docker compose -f /opt/pilot-plus/bot/docker-compose.bot.yaml logs --tail=80 telegram-bot
```

Expected: `status=running health=healthy restart=0` and no traceback.

- [ ] **Step 6: Verify the real linked profile and menu**

Call the protected `/api/bot/v1/me` path for Telegram ID `185185047` using the configured service token without printing it. Expected JSON contains `"kind":"STAFF"` and `"displayName":"Павел Седов"`. Send `/start` in Telegram and confirm the persistent seven-section reply keyboard appears; press each section and confirm every press returns a response.

## Plan self-review

- Spec coverage: persistent menu, centralized labels, seven handled actions, legacy callback, staff authorization, client isolation, callback acknowledgement, error copy, tests, and deployment are each mapped to a task.
- Placeholder scan: no TBD, TODO, or unspecified implementation step remains.
- Type consistency: Task 2 consumes the exact label exports and `staff_main_menu()` produced by Task 1; the router registration matches the existing aiogram structure.
