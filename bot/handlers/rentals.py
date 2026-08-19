from datetime import datetime
from zoneinfo import ZoneInfo

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.formatters.rentals import rental_card
from bot.keyboards.callbacks import CLIENT_NEW_RENTAL, CLIENT_RENTALS
from bot.keyboards.rentals import confirmation, document_links, fulfillment_choices, rental_documents, vehicle_choices
from bot.services.errors import PilotApiError
from bot.states.rental import NewRentalForm

router = Router(name="rentals")
MOSCOW = ZoneInfo("Europe/Moscow")


def parse_moscow(value: str) -> datetime | None:
    try:
        parsed = datetime.strptime(value.strip(), "%d.%m.%Y %H:%M").replace(tzinfo=MOSCOW)
        if parsed.strftime("%d.%m.%Y %H:%M") != value.strip():
            return None
        return parsed
    except ValueError:
        return None


@router.callback_query(F.data == CLIENT_NEW_RENTAL)
async def new_rental(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await state.set_state(NewRentalForm.starts_at)
    if callback.message:
        await callback.message.answer("Введите дату и время начала по Москве: ДД.ММ.ГГГГ ЧЧ:ММ")
    await callback.answer()


@router.message(NewRentalForm.starts_at)
async def rental_start(message: Message, state: FSMContext) -> None:
    value = parse_moscow(message.text or "")
    if not value or value <= datetime.now(MOSCOW):
        await message.answer("Нужна будущая дата: ДД.ММ.ГГГГ ЧЧ:ММ")
        return
    await state.update_data(startsAt=value.isoformat())
    await state.set_state(NewRentalForm.ends_at)
    await message.answer("Введите дату и время возврата по Москве: ДД.ММ.ГГГГ ЧЧ:ММ")


@router.message(NewRentalForm.ends_at)
async def rental_end(message: Message, state: FSMContext, pilot_api) -> None:
    value = parse_moscow(message.text or "")
    data = await state.get_data()
    start = datetime.fromisoformat(data["startsAt"])
    if not value or value <= start:
        await message.answer("Возврат должен быть позже начала.")
        return
    await state.update_data(endsAt=value.isoformat())
    try:
        result = await pilot_api.availability(str(message.from_user.id), start.isoformat(), value.isoformat())
    except PilotApiError:
        await message.answer("Не удалось проверить автопарк. Попробуйте позже.")
        return
    vehicles = result.get("items", [])
    if not vehicles:
        await message.answer("На выбранные даты свободных машин нет.")
        await state.clear()
        return
    await state.update_data(vehicles={v["id"]: v for v in vehicles})
    await state.set_state(NewRentalForm.vehicle)
    await message.answer("Выберите свободную машину:", reply_markup=vehicle_choices(vehicles))


@router.callback_query(NewRentalForm.vehicle, F.data.startswith("rental:vehicle:"))
async def rental_vehicle(callback: CallbackQuery, state: FSMContext) -> None:
    vehicle_id = callback.data.rsplit(":", 1)[-1]
    data = await state.get_data()
    if vehicle_id not in data.get("vehicles", {}):
        await callback.answer("Машина недоступна", show_alert=True)
        return
    await state.update_data(preferredVehicleId=vehicle_id)
    await state.set_state(NewRentalForm.fulfillment)
    if callback.message:
        await callback.message.answer("Как получить машину?", reply_markup=fulfillment_choices())
    await callback.answer()


@router.callback_query(NewRentalForm.fulfillment, F.data.startswith("rental:mode:"))
async def rental_mode(callback: CallbackQuery, state: FSMContext) -> None:
    mode = callback.data.rsplit(":", 1)[-1]
    await state.update_data(fulfillmentMode=mode, deliveryAddress=None)
    if mode == "DELIVERY":
        await state.set_state(NewRentalForm.delivery_address)
        if callback.message:
            await callback.message.answer("Введите полный адрес подачи:")
    else:
        await state.set_state(NewRentalForm.confirm)
        if callback.message:
            await callback.message.answer("Проверьте данные и отправьте заявку.", reply_markup=confirmation())
    await callback.answer()


@router.message(NewRentalForm.delivery_address)
async def rental_address(message: Message, state: FSMContext) -> None:
    address = (message.text or "").strip()
    if not 5 <= len(address) <= 500:
        await message.answer("Введите полный адрес от 5 до 500 символов.")
        return
    await state.update_data(deliveryAddress=address)
    await state.set_state(NewRentalForm.confirm)
    await message.answer("Проверьте данные и отправьте заявку.", reply_markup=confirmation())


@router.callback_query(NewRentalForm.confirm, F.data == "rental:submit")
async def rental_submit(callback: CallbackQuery, state: FSMContext, pilot_api) -> None:
    data = await state.get_data()
    payload = {key: data.get(key) for key in ("startsAt", "endsAt", "preferredVehicleId", "fulfillmentMode", "deliveryAddress")}
    payload.update({"comment": None, "rentalId": None})
    try:
        await pilot_api.create_rental_request(str(callback.from_user.id), payload, f"tg-new-rental-{callback.id}")
    except PilotApiError:
        await callback.answer("Не удалось отправить заявку", show_alert=True)
        return
    await state.clear()
    if callback.message:
        await callback.message.answer("Заявка отправлена. Диспетчер подтвердит доступность.")
    await callback.answer()


@router.callback_query(F.data == CLIENT_RENTALS)
async def my_rentals(callback: CallbackQuery, pilot_api) -> None:
    try:
        items = (await pilot_api.rentals(str(callback.from_user.id))).get("items", [])
    except PilotApiError:
        await callback.answer("Не удалось загрузить аренды", show_alert=True)
        return
    if callback.message:
        if not items:
            await callback.message.answer("Аренд пока нет.")
        for item in items:
            markup = rental_documents(item["id"]) if item.get("documentsReady") else None
            await callback.message.answer(rental_card(item), parse_mode="HTML", reply_markup=markup)
    await callback.answer()


@router.callback_query(F.data == "rental:cancel")
async def cancel(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.answer("Отменено")


@router.callback_query(F.data.startswith("rental:documents:"))
async def documents(callback: CallbackQuery, pilot_api) -> None:
    rental_id = callback.data.rsplit(":", 1)[-1]
    try:
        items = (await pilot_api.rental_documents(str(callback.from_user.id), rental_id)).get("items", [])
    except PilotApiError:
        await callback.answer("Документы недоступны", show_alert=True)
        return
    if callback.message and items:
        await callback.message.answer("Ссылки действуют 5 минут:", reply_markup=document_links(items))
    await callback.answer()
