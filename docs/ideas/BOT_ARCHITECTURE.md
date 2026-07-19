# Pilot+ Telegram Bot — Архитектура

**Версия:** 1.0
**Дата:** 19 июля 2026
**Стек:** Python 3.12+, aiogram 3.x, SQLAlchemy 2.x (async), PostgreSQL
**Назначение:** Полная спецификация для реализации AI-агентом

---

## 1. Философия бота

Бот — **цифровой диспетчер гаража**. Он не просто принимает заявки. Он понимает естественный язык, предзаполняет данные, помнит контекст и работает быстрее, чем человек без бота.

### Принципы

1. **Понимание, а не парсинг.** Бот принимает сообщения в свободной форме.
2. **Минимум шагов.** Одно сообщение = одна заявка (если все данные есть).
3. **Предзаполнение.** Всё, что можно вычислить или вспомнить — заполнено.
4. **Прощение ошибок.** Опечатки, синонимы, разный порядок слов — бот поймёт.
5. **Невидимость.** Бот не спамит. Только по делу.
6. **Скорость.** Ответ < 500ms.

---

## 2. Структура проекта

```text
bot/
├── main.py # Точка входа, инициализация бота и диспетчера
├── config.py # Токен, настройки БД, переменные окружения
├── requirements.txt # Зависимости
│
├── db/
│ ├── base.py # Base, engine, session_factory
│ ├── models.py # Все SQLAlchemy-модели
│ └── repository.py # Все запросы к БД (CRUD + специфичные)
│
├── nlp/
│ ├── intent_classifier.py # Определение намерения (delivery, wash, refuel...)
│ └── entity_extractor.py # Извлечение сущностей (авто, пробег, топливо...)
│
├── states/
│ └── forms.py # Все FSM-состояния (по одному классу на тип заявки)
│
├── keyboards/
│ ├── main.py # Главное меню
│ ├── cars.py # Клавиатура выбора авто
│ ├── delivery.py # Клавиатуры для подачи/выдачи
│ ├── return_form.py # Клавиатуры для возврата
│ ├── wash.py # Клавиатуры для мойки
│ ├── refuel.py # Клавиатуры для заправки
│ ├── transfer.py # Клавиатуры для перегона
│ ├── confirm.py # Клавиатуры подтверждения/редактирования/отмены
│ ├── admin.py # Клавиатуры админ-панели
│ └── common.py # Общие кнопки (Назад, Отмена, Меню)
│
├── handlers/
│ ├── start.py # /start, регистрация водителя
│ ├── menu.py # Обработка главного меню
│ ├── free_text.py # Обработка свободного текста (NLP)
│ ├── voice.py # Обработка голосовых сообщений
│ ├── photo.py # Обработка фото (проверка, сохранение)
│ ├── delivery.py # Хендлеры для подачи (FSM)
│ ├── issue.py # Хендлеры для выдачи (FSM)
│ ├── return_form.py # Хендлеры для возврата (FSM)
│ ├── wash.py # Хендлеры для мойки (FSM)
│ ├── refuel.py # Хендлеры для заправки (FSM)
│ ├── transfer.py # Хендлеры для перегона (FSM)
│ ├── status.py # Запрос статуса авто (?monjaro)
│ ├── driver.py # Мои заявки, статистика водителя
│ ├── admin.py # Админ-панель
│ ├── notifications.py # Напоминания, ежедневная сводка
│ └── errors.py # Обработка ошибок
│
├── services/
│ ├── photo_checker.py # Проверка фото (свежесть, качество, EXIF)
│ ├── geolocation.py # Получение геолокации из фото/сообщения
│ ├── conflict_detector.py # Проверка конфликтов (авто уже в заявке)
│ ├── scheduler.py # Планировщик (напоминания, сводки)
│ └── pilot_api.py # Клиент для API Pilot+ (если нужно)
│
├── formatters/
│ ├── messages.py # Форматирование всех сообщений бота
│ ├── delivery.py # Форматтер для подачи/выдачи
│ ├── return_form.py # Форматтер для возврата
│ ├── wash.py # Форматтер для мойки
│ ├── refuel.py # Форматтер для заправки
│ ├── transfer.py # Форматтер для перегона
│ ├── status.py # Форматтер для статуса авто
│ ├── daily_report.py # Форматтер ежедневной сводки
│ └── driver.py # Форматтер для статистики водителя
│
└── assets/
└── templates/ # HTML-шаблоны (если нужны для отчётов)

```

---

## 3. Модели данных (db/models.py)

```python
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.sql import func
import enum

class Base(AsyncAttrs, DeclarativeBase):
    pass

class DriverRole(str, enum.Enum):
    DRIVER = "driver"
    DISPATCHER = "dispatcher"
    ADMIN = "admin"

class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(String, unique=True, nullable=False)
    username = Column(String)                    # @ivanov
    full_name = Column(String, nullable=False)   # Иван Иванов
    phone = Column(String)
    role = Column(Enum(DriverRole), default=DriverRole.DRIVER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    requests = relationship("VehicleRequest", back_populates="driver")

class Car(Base):
    __tablename__ = "cars"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)      # "Monjaro"
    aliases = Column(JSON, default=list)                     # ["монжаро", "монж", "мж"]
    plate_number = Column(String)                            # госномер
    last_mileage = Column(Integer)                           # последний известный пробег
    is_active = Column(Boolean, default=True)

    requests = relationship("VehicleRequest", back_populates="car")

class RequestType(str, enum.Enum):
    DELIVERY = "delivery"    # подача
    ISSUE = "issue"          # выдача
    RETURN = "return"        # возврат
    WASH = "wash"            # мойка
    REFUEL = "refuel"        # заправка
    TRANSFER = "transfer"    # перегон

class RequestStatus(str, enum.Enum):
    PENDING = "pending"          # создана
    IN_PROGRESS = "in_progress"  # в работе
    COMPLETED = "completed"      # завершена
    CANCELLED = "cancelled"      # отменена

class VehicleRequest(Base):
    __tablename__ = "vehicle_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(Enum(RequestType), nullable=False)
    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING)

    car_id = Column(Integer, ForeignKey("cars.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False)

    mileage = Column(Integer)
    fuel = Column(String)                # "full" / "not_full"
    fuel_amount = Column(Integer)        # доплата за топливо (руб)
    condition = Column(String)           # "clean" / "dirty"
    wash_amount = Column(Integer)        # доплата за мойку (руб)
    wash_options = Column(JSON)          # ["кузов", "коврики", "багажник"]
    transfer_description = Column(String) # описание работ для перегона

    location_lat = Column(Float)
    location_lng = Column(Float)
    location_address = Column(String)

    photos = Column(JSON, default=list)  # [{"file_id": "...", "type": "odo"}, ...]
    voice_comment = Column(String)        # file_id голосового коммента

    cancel_reason = Column(String)

    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)

    car = relationship("Car", back_populates="requests")
    driver = relationship("Driver", back_populates="requests")

class DailySummary(Base):
    __tablename__ = "daily_summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(DateTime, nullable=False)
    data = Column(JSON, nullable=False)   # агрегированные данные за день
```

## 4. NLP-слой (nlp/)

intent_classifier.py — Определение намерения
Задача: Из текста сообщения определить, что хочет сделать пользователь.

Алгоритм: Ключевые слова + приоритеты.

```python
INTENTS = {
    "delivery": ["подача", "подать", "подай", "доставить", "отвезти"],
    "issue": ["выдача", "выдать", "выдай", "отдать клиенту"],
    "return": ["возврат", "вернуть", "верни", "принять", "клиент вернул"],
    "wash": ["мойка", "помыть", "помыл", "вымой", "мою"],
    "refuel": ["заправка", "заправить", "заправь", "залил", "бензин"],
    "transfer": ["перегон", "перегнать", "перегнал", "то", "техобслуживание"],
    "status": ["?","что по","статус","инфо","где","как там"],
    "my_stats": ["мои заявки","сколько я","моя статистика","я сегодня"],
    "help": ["помощь","помоги","что ты умеешь","команды"],
}
entity_extractor.py — Извлечение сущностей
Задача: Из текста вытащить конкретные данные.

Алгоритм:

Авто: ищем совпадение с Car.name или Car.aliases (регистронезависимо,容忍 опечатки через расстояние Левенштейна)

Пробег: ищем числа (3-6 цифр), особенно рядом с «км», «пробег», «odo»

Топливо: ключевые слова «полный», «неполный», «половина», «пустой»

Состояние: ключевые слова «чистый», «грязный», «грязная»

Суммы: числа рядом с «р», «руб», «₽»

Мойка: ключевые слова «кузов», «коврики», «багажник», «салон», «двигатель»

Геолокация: если сообщение имеет location — берём координаты

```

```python
async def extract_entities(text: str, db: AsyncSession) -> dict:
    entities = {
        "car": None,
        "mileage": None,
        "fuel": None,
        "fuel_amount": None,
        "condition": None,
        "wash_amount": None,
        "wash_options": [],
        "transfer_description": None,
    }

    # 1. Ищем авто
    entities["car"] = await find_car(text, db)

    # 2. Ищем пробег
    entities["mileage"] = extract_mileage(text)

    # 3. Ищем топливо
    entities["fuel"] = extract_fuel(text)

    # 4. Ищем состояние
    entities["condition"] = extract_condition(text)

    # 5. Ищем суммы
    amounts = extract_amounts(text)
    if entities["fuel"] == "not_full" and len(amounts) > 0:
        entities["fuel_amount"] = amounts[0]
    if entities["condition"] == "dirty" and len(amounts) > (1 if entities["fuel"] == "not_full" else 0):
        idx = 1 if entities["fuel"] == "not_full" else 0
        if idx < len(amounts):
            entities["wash_amount"] = amounts[idx]

    # 6. Ищем опции мойки
    entities["wash_options"] = extract_wash_options(text)

    # 7. Описание перегона
    entities["transfer_description"] = extract_transfer_description(text)

    return entities
```

## 5. FSM-состояния (states/forms.py)

```python
from aiogram.fsm.state import State, StatesGroup

class DeliveryForm(StatesGroup):
    """Подача (и Выдача — используют одни состояния)"""
    car = State()
    mileage = State()
    fuel = State()
    fuel_amount = State()
    condition = State()
    wash_amount = State()
    photo = State()
    confirm = State()

class ReturnForm(StatesGroup):
    """Возврат"""
    car = State()
    mileage = State()
    fuel = State()
    fuel_amount = State()
    condition = State()
    wash_amount = State()
    photo = State()
    confirm = State()

class WashForm(StatesGroup):
    """Мойка"""
    car = State()
    wash_options = State()
    photo_before = State()
    photo_after = State()
    confirm = State()

class RefuelForm(StatesGroup):
    """Заправка"""
    car = State()
    mileage = State()
    photo_receipt = State()
    confirm = State()

class TransferForm(StatesGroup):
    """Перегон + ТО"""
    car = State()
    mileage = State()
    description = State()
    photo = State()
    confirm = State()
```

## 6. Клавиатуры (keyboards/)

keyboards/common.py — Общие кнопки

```python
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

def back_button(callback_data: str = "back") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⬅ Назад", callback_data=callback_data)]
    ])

def cancel_button() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")]
    ])

def back_cancel_buttons(back_data: str = "back") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="⬅ Назад", callback_data=back_data),
            InlineKeyboardButton(text="❌ Отмена", callback_data="cancel"),
        ]
    ])

def menu_button() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🏠 Меню", callback_data="menu")]
    ])
keyboards/main.py — Главное меню
```

```python
def main_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📝 Новая заявка", callback_data="new_request")],
        [
            InlineKeyboardButton(text="📋 Мои заявки", callback_data="my_requests"),
            InlineKeyboardButton(text="🚗 Инфо по авто", callback_data="car_info"),
        ],
        [InlineKeyboardButton(text="📊 Сводка", callback_data="daily_summary")],
    ])

def request_type_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📤 Подача", callback_data="type_delivery"),
            InlineKeyboardButton(text="📥 Выдача", callback_data="type_issue"),
        ],
        [
            InlineKeyboardButton(text="🔄 Возврат", callback_data="type_return"),
            InlineKeyboardButton(text="🧽 Мойка", callback_data="type_wash"),
        ],
        [
            InlineKeyboardButton(text="⛽ Заправка", callback_data="type_refuel"),
            InlineKeyboardButton(text="🚛 Перегон", callback_data="type_transfer"),
        ],
        [InlineKeyboardButton(text="⬅ Отмена", callback_data="menu")],
    ])
keyboards/cars.py — Выбор авто
```

```python
def cars_keyboard(cars: list, back_data: str = "back") -> InlineKeyboardMarkup:
    buttons = []
    for car in cars:
        buttons.append([
            InlineKeyboardButton(
                text=f"🚗 {car.name}",
                callback_data=f"car_{car.id}"
            )
        ])
    buttons.append([InlineKeyboardButton(text="⬅ Назад", callback_data=back_data)])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
keyboards/delivery.py — Подача/Выдача
```

```python
def fuel_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="⛽ Полный", callback_data="fuel_full"),
            InlineKeyboardButton(text="⛽ Неполный", callback_data="fuel_not_full"),
        ],
        [InlineKeyboardButton(text="⬅ Назад", callback_data="back")],
    ])

def condition_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✨ Чистый", callback_data="cond_clean"),
            InlineKeyboardButton(text="🧹 Грязный", callback_data="cond_dirty"),
        ],
        [InlineKeyboardButton(text="⬅ Назад", callback_data="back")],
    ])
keyboards/wash.py — Мойка
```

```python
def wash_options_keyboard(selected: list) -> InlineKeyboardMarkup:
    """Чекбоксы для выбора что моем"""
    options = [
        ("wash_body", "Кузов"),
        ("wash_mats", "Коврики"),
        ("wash_trunk", "Багажник"),
        ("wash_interior", "Салон"),
        ("wash_engine", "Двигатель"),
    ]
    buttons = []
    for key, label in options:
        prefix = "✅" if key in selected else "⬜"
        buttons.append([
            InlineKeyboardButton(
                text=f"{prefix} {label}",
                callback_data=f"toggle_{key}"
            )
        ])
    buttons.append([InlineKeyboardButton(text="✅ Готово", callback_data="wash_done")])
    buttons.append([InlineKeyboardButton(text="⬅ Назад", callback_data="back")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
keyboards/confirm.py — Подтверждение
```

```python
def confirm_keyboard(edit_callback: str = "edit") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Подтвердить", callback_data="confirm_yes"),
            InlineKeyboardButton(text="✏️ Изменить", callback_data=edit_callback),
        ],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel")],
    ])

def confirm_with_photo_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📷 Фото", callback_data="add_photo")],
        [
            InlineKeyboardButton(text="✏️ Изменить", callback_data="edit"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="cancel"),
        ],
    ])
keyboards/admin.py — Админ-панель
```

```python
def admin_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📊 Сводка", callback_data="admin_summary"),
            InlineKeyboardButton(text="👥 Водители", callback_data="admin_drivers"),
        ],
        [
            InlineKeyboardButton(text="🚗 Авто", callback_data="admin_cars"),
            InlineKeyboardButton(text="📋 Все заявки", callback_data="admin_requests"),
        ],
        [
            InlineKeyboardButton(text="💰 Финансы", callback_data="admin_finance"),
            InlineKeyboardButton(text="⚙️ Настройки", callback_data="admin_settings"),
        ],
        [InlineKeyboardButton(text="🏠 Меню", callback_data="menu")],
    ])
```

## 7. Форматтеры сообщений (formatters/)

formatters/delivery.py — Подача/Выдача

```python
def format_delivery(data: dict, request_type: str = "delivery") -> str:
    """Форматирует итоговое сообщение для подачи/выдачи"""
    emoji = "📤" if request_type == "delivery" else "📥"
    title = "ПОДАЧА" if request_type == "delivery" else "ВЫДАЧА"

    lines = [
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"{emoji} *{title}*",
        "",
        f"🚗 *{data['car_name']}*",
        f"📏 Пробег: {data['mileage']} км",
    ]

    # Топливо
    if data['fuel'] == 'full':
        lines.append("⛽ Топливо: полный бак")
    else:
        lines.append("⛽ Топливо: неполный")
        lines.append(f"💵 Доплата за топливо: {data['fuel_amount']:,} ₽".replace(',', ' '))

    # Состояние
    if data['condition'] == 'clean':
        lines.append("✨ Состояние: чистый")
    else:
        lines.append("🧹 Состояние: грязный")
        lines.append(f"💵 Доплата за мойку: {data['wash_amount']:,} ₽".replace(',', ' '))

    # Итого доплата
    total = 0
    if data['fuel'] == 'not_full':
        total += data.get('fuel_amount', 0)
    if data['condition'] == 'dirty':
        total += data.get('wash_amount', 0)
    if total > 0:
        lines.append("")
        lines.append(f"💰 *Итого доплата: {total:,} ₽*".replace(',', ' '))

    # Локация
    if data.get('location_address'):
        lines.append(f"📍 {data['location_address']}")

    # Фото
    if data.get('photos'):
        lines.append(f"📸 Фото: {len(data['photos'])} шт.")

    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)
formatters/wash.py — Мойка
```

```python
def format_wash(data: dict) -> str:
    lines = [
        "━━━━━━━━━━━━━━━━━━━━━━",
        "🧽 *МОЙКА*",
        "",
        f"🚗 *{data['car_name']}*",
        "",
        "Что помыто:",
    ]

    for item in data.get('wash_options', []):
        lines.append(f"• {item}")

    if data.get('photos_before'):
        lines.append(f"📸 ДО: {len(data['photos_before'])} фото")
    if data.get('photos_after'):
        lines.append(f"📸 ПОСЛЕ: {len(data['photos_after'])} фото")

    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)
formatters/refuel.py — Заправка
```

```python
def format_refuel(data: dict) -> str:
    lines = [
        "━━━━━━━━━━━━━━━━━━━━━━",
        "⛽ *ЗАПРАВКА*",
        "",
        f"🚗 *{data['car_name']}*",
        f"📏 Пробег: {data['mileage']} км",
        "",
    ]

    if data.get('receipt_photo'):
        lines.append("📸 Чек: прикреплён")

    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)
formatters/transfer.py — Перегон
```

```python
def format_transfer(data: dict) -> str:
    lines = [
        "━━━━━━━━━━━━━━━━━━━━━━",
        "🚛 *ПЕРЕГОН + ТО*",
        "",
        f"🚗 *{data['car_name']}*",
        f"📏 Пробег: {data['mileage']} км",
        "",
    ]

    if data.get('description'):
        lines.append(f"📝 Работы: {data['description']}")

    if data.get('photos'):
        lines.append(f"📸 Фото: {len(data['photos'])} шт.")

    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)
formatters/status.py — Статус авто
```

```python
def format_car_status(car, last_requests: list) -> str:
    lines = [
        "━━━━━━━━━━━━━━━━━━━━━━",
        f"🚗 *{car.name}*",
        "",
        f"📏 Пробег: {car.last_mileage} км",
    ]

    # Последние заявки
    if last_requests:
        lines.append("")
        lines.append("📋 Последние заявки:")
        for req in last_requests[:3]:
            type_emoji = {
                "delivery": "📤", "issue": "📥", "return": "🔄",
                "wash": "🧽", "refuel": "⛽", "transfer": "🚛"
            }.get(req.type.value, "📋")

            status_emoji = {
                "completed": "🟢", "in_progress": "🟡", "pending": "🔴", "cancelled": "⚪"
            }.get(req.status.value, "⚪")

            lines.append(f"{status_emoji} {type_emoji} {req.type.value} — {req.created_at.strftime('%d.%m %H:%M')}")

    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)
formatters/daily_report.py — Ежедневная сводка
```

```python
def format_daily_report(date, stats: dict, top_driver: dict) -> str:
    lines = [
        "━━━━━━━━━━━━━━━━━━━━━━",
        "📊 *ИТОГИ ДНЯ*",
        f"📅 {date}",
        "",
        f"📤 Подачи: {stats.get('delivery', 0)}",
        f"📥 Выдачи: {stats.get('issue', 0)}",
        f"🔄 Возвраты: {stats.get('return', 0)}",
        f"🧽 Мойки: {stats.get('wash', 0)}",
        f"⛽ Заправки: {stats.get('refuel', 0)}",
        f"🚛 Перегоны: {stats.get('transfer', 0)}",
        "",
        f"💰 Доплат получено: {stats.get('total_amount', 0):,} ₽".replace(',', ' '),
        "",
    ]

    if top_driver:
        lines.append(f"🏆 Водитель дня: @{top_driver['username']} — {top_driver['count']} заявок")

    lines.append(f"📋 Всего заявок за день: {stats.get('total', 0)}")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    return "\n".join(lines)
```

## 8. Хендлеры (handlers/)

handlers/free_text.py — Обработка свободного текста
Логика:

Получаем текст

Вызываем classify_intent(text) → определяем намерение

Если намерение не определено → «Я не понял, используйте кнопки или напишите: подача/возврат/мойка/заправка/перегон»

Вызываем extract_entities(text, db) → извлекаем сущности

Запускаем FSM соответствующего типа, передавая извлечённые данные

Запрашиваем только недостающие поля

```python
@router.message(F.text, ~F.text.startswith("/"))
async def handle_free_text(message: Message, state: FSMContext, db: AsyncSession):
    text = message.text.lower()

    # Определяем намерение
    intent = classify_intent(text)

    if not intent:
        await message.answer(
            "Не понял. Используйте кнопки или напишите:\n"
            "• подача [авто] [пробег]\n"
            "• возврат [авто] [пробег]\n"
            "• мойка [авто]\n"
            "• заправка [авто] [пробег]\n"
            "• ? [авто] — узнать статус",
            reply_markup=main_menu()
        )
        return

    # Извлекаем сущности
    entities = await extract_entities(text, db)

    # Запускаем соответствующий FSM
    if intent == "delivery":
        await start_fsm_from_entities(message, state, entities, DeliveryForm, "delivery")
    elif intent == "issue":
        await start_fsm_from_entities(message, state, entities, DeliveryForm, "issue")
    elif intent == "return":
        await start_fsm_from_entities(message, state, entities, ReturnForm, "return")
    elif intent == "wash":
        await start_fsm_from_entities(message, state, entities, WashForm, "wash")
    elif intent == "refuel":
        await start_fsm_from_entities(message, state, entities, RefuelForm, "refuel")
    elif intent == "transfer":
        await start_fsm_from_entities(message, state, entities, TransferForm, "transfer")
    elif intent == "status":
        await handle_status_request(message, text, db)
    elif intent == "my_stats":
        await handle_my_stats(message, db)

async def start_fsm_from_entities(message, state, entities, form_class, request_type):
    """Запускает FSM с предзаполненными данными"""
    await state.update_data(**entities, request_type=request_type)

    # Определяем, каких данных не хватает
    if not entities.get("car"):
        await state.set_state(form_class.car)
        await message.answer("Выберите авто:", reply_markup=cars_keyboard(...))
    elif not entities.get("mileage") and request_type in ("delivery", "issue", "return", "refuel", "transfer"):
        await state.set_state(form_class.mileage)
        await message.answer(f"📏 Введите пробег:", reply_markup=back_button())
    elif not entities.get("fuel") and request_type in ("delivery", "issue", "return"):
        await state.set_state(form_class.fuel)
        await message.answer("⛽ Уровень топлива:", reply_markup=fuel_keyboard())
    # ... и так далее

    # Если все данные есть — сразу показываем подтверждение
    else:
        await show_confirmation(message, state, request_type)
handlers/delivery.py — Подача (FSM)
```

```python
@router.callback_query(F.data == "type_delivery")
async def start_delivery(callback: CallbackQuery, state: FSMContext):
    await state.update_data(request_type="delivery")
    await state.set_state(DeliveryForm.car)
    cars = await get_active_cars()
    await callback.message.edit_text("Выберите автомобиль:", reply_markup=cars_keyboard(cars))

@router.callback_query(DeliveryForm.car, F.data.startswith("car_"))
async def process_car(callback: CallbackQuery, state: FSMContext):
    car_id = int(callback.data.split("_")[1])
    car = await get_car(car_id)
    await state.update_data(car_id=car.id, car_name=car.name)
    await state.set_state(DeliveryForm.mileage)

    hint = f"Последний пробег: {car.last_mileage} км" if car.last_mileage else ""
    await callback.message.edit_text(
        f"📤 Подача — {car.name}\n{hint}\n\nВведите пробег (км):",
        reply_markup=back_cancel_buttons("type_delivery")
    )

@router.message(DeliveryForm.mileage)
async def process_mileage(message: Message, state: FSMContext):
    try:
        mileage = int(message.text.replace(" ", "").replace("км", ""))
    except ValueError:
        await message.answer("⚠️ Введите число (например: 635)", reply_markup=back_button())
        return

    await state.update_data(mileage=mileage)
    await state.set_state(DeliveryForm.fuel)
    await message.answer("⛽ Уровень топлива:", reply_markup=fuel_keyboard())

@router.callback_query(DeliveryForm.fuel, F.data.startswith("fuel_"))
async def process_fuel(callback: CallbackQuery, state: FSMContext):
    fuel = "full" if callback.data == "fuel_full" else "not_full"
    await state.update_data(fuel=fuel)

    if fuel == "not_full":
        await state.set_state(DeliveryForm.fuel_amount)
        await callback.message.edit_text("💰 Введите сумму доплаты за топливо (₽):", reply_markup=back_button())
    else:
        await state.set_state(DeliveryForm.condition)
        await callback.message.edit_text("✨ Состояние авто:", reply_markup=condition_keyboard())

# ... и так далее по цепочке до confirm
handlers/photo.py — Обработка фото
```

```python
@router.message(F.photo)
async def handle_photo(message: Message, state: FSMContext):
    current_state = await state.get_state()

    if not current_state:
        await message.answer("📸 Фото получено, но сейчас не требуется.")
        return

    # Проверяем свежесть фото
    file_id = message.photo[-1].file_id
    is_fresh = await check_photo_freshness(file_id)

    if not is_fresh:
        await message.answer(
            "⚠️ Похоже, фото из галереи. Сделайте фото сейчас.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="📷 Снять сейчас", callback_data="take_photo_now")]
            ])
        )
        return

    # Сохраняем фото
    data = await state.get_data()
    photos = data.get("photos", [])
    photos.append({"file_id": file_id, "timestamp": datetime.now().isoformat()})
    await state.update_data(photos=photos)

    # Показываем, что фото принято
    await message.answer(f"📸 Фото принято! ({len(photos)} шт.)")

    # Если ожидаем подтверждение — показываем кнопки
    if "confirm" in current_state:
        await show_confirmation_after_photo(message, state)
```

## 9. Интеграция с Pilot+ API (`services/pilot_api.py`)

Бот должен синхронизироваться с Pilot+ для:

Получения актуального списка авто

Обновления пробега

Передачи заявок в гаражный журнал

```python
class PilotAPI:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {api_key}"}

    async def get_cars(self) -> list:
        """Получить список активных авто"""
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/api/vehicles", headers=self.headers)
            return response.json()

    async def update_mileage(self, car_id: int, mileage: int):
        """Обновить пробег авто в Pilot+"""
        async with httpx.AsyncClient() as client:
            await client.patch(
                f"{self.base_url}/api/vehicles/{car_id}",
                json={"mileage": mileage},
                headers=self.headers
            )

    async def create_garage_request(self, data: dict):
        """Создать заявку в гаражном журнале Pilot+"""
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/api/garage/requests",
                json=data,
                headers=self.headers
            )
```

## 10. Запуск (`main.py`)

```python
import asyncio
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.redis import RedisStorage
from config import BOT_TOKEN, REDIS_URL

async def main():
    bot = Bot(token=BOT_TOKEN)
    storage = RedisStorage.from_url(REDIS_URL)
    dp = Dispatcher(storage=storage)

    # Подключаем все роутеры
    dp.include_router(start.router)
    dp.include_router(menu.router)
    dp.include_router(free_text.router)
    dp.include_router(voice.router)
    dp.include_router(photo.router)
    dp.include_router(delivery.router)
    dp.include_router(issue.router)
    dp.include_router(return_form.router)
    dp.include_router(wash.router)
    dp.include_router(refuel.router)
    dp.include_router(transfer.router)
    dp.include_router(status.router)
    dp.include_router(driver.router)
    dp.include_router(admin.router)
    dp.include_router(errors.router)

    # Запускаем планировщик
    scheduler = Scheduler(bot)
    asyncio.create_task(scheduler.run())

    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
```

Это полная архитектура. Документ готов к использованию AI-агентом для реализации бота с нуля.
