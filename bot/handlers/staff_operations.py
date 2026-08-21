from decimal import Decimal, InvalidOperation
from io import BytesIO
from uuid import uuid4
from datetime import datetime
from zoneinfo import ZoneInfo

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from bot.keyboards.rentals import (
    operation_choice,
    operation_confirmation,
    operation_media_skip,
)
from bot.keyboards.staff import staff_main_menu
from bot.services.errors import PilotApiError
from bot.states.rental import StaffOperationForm

router = Router(name="staff_operations")
MAX_BOT_VIDEO_BYTES = 20 * 1024 * 1024
MAX_BOT_PHOTO_BYTES = 15 * 1024 * 1024


def positive_integer(value: str | None, maximum: int) -> int | None:
    try:
        parsed = int((value or "").strip())
    except ValueError:
        return None
    return parsed if 0 <= parsed <= maximum else None


def rubles_to_minor(value: str | None) -> int | None:
    try:
        amount = Decimal((value or "").strip().replace(",", "."))
    except InvalidOperation:
        return None
    minor = amount * 100
    return int(minor) if amount >= 0 and minor == minor.to_integral_value() else None


@router.callback_query(F.data.startswith("staffop:HANDOVER:") | F.data.startswith("staffop:RETURN:"))
async def operation_start(callback: CallbackQuery, state: FSMContext) -> None:
    _, operation, rental_id = callback.data.split(":", 2)
    await state.clear()
    await state.update_data(
        operation=operation,
        rentalId=rental_id,
        idempotencyKey=f"tg-operation-{callback.from_user.id}-{uuid4().hex}",
        skipped=[],
    )
    await state.set_state(StaffOperationForm.mileage)
    if callback.message:
        await callback.message.answer("Введите пробег на приборной панели, км:")
    await callback.answer()


@router.callback_query(F.data.startswith("staffop:EXTENSION:"))
async def extension_start(callback: CallbackQuery, state: FSMContext) -> None:
    rental_id = callback.data.rsplit(":", 1)[-1]
    await state.clear()
    await state.update_data(
        operation="EXTENSION",
        rentalId=rental_id,
        idempotencyKey=f"tg-extension-{callback.from_user.id}-{uuid4().hex}",
    )
    await state.set_state(StaffOperationForm.extension_end)
    if callback.message:
        await callback.message.answer("Введите новую дату возврата по Москве: ДД.ММ.ГГГГ ЧЧ:ММ")
    await callback.answer()


@router.message(StaffOperationForm.extension_end)
async def extension_end(message: Message, state: FSMContext) -> None:
    try:
        value = datetime.strptime((message.text or "").strip(), "%d.%m.%Y %H:%M").replace(
            tzinfo=ZoneInfo("Europe/Moscow")
        )
    except ValueError:
        await message.answer("Введите дату в формате ДД.ММ.ГГГГ ЧЧ:ММ.")
        return
    if value <= datetime.now(ZoneInfo("Europe/Moscow")):
        await message.answer("Новая дата возврата должна быть в будущем.")
        return
    await state.update_data(nextEndsAt=value.strftime("%d.%m.%Y %H:%M"))
    await state.set_state(StaffOperationForm.extension_confirm)
    await message.answer(
        f"Продлить договор до {value.strftime('%d.%m.%Y %H:%M')}?",
        reply_markup=operation_choice("extension", [("Подтвердить продление", "confirm"), ("Отмена", "cancel")]),
    )


@router.callback_query(StaffOperationForm.extension_confirm, F.data == "staffop:extension:confirm")
async def extension_confirm(callback: CallbackQuery, state: FSMContext, pilot_api) -> None:
    data = await state.get_data()
    now = datetime.now(ZoneInfo("Europe/Moscow")).strftime("%d.%m.%Y %H:%M")
    try:
        await pilot_api.extend_staff_rental(
            str(callback.from_user.id),
            data["rentalId"],
            {
                "idempotencyKey": data["idempotencyKey"],
                "occurredAt": now,
                "nextEndsAt": data["nextEndsAt"],
                "notes": "Продлено сотрудником через Telegram",
            },
        )
    except PilotApiError:
        await callback.answer("Не удалось продлить. Проверьте даты и занятость машины.", show_alert=True)
        return
    await state.clear()
    if callback.message:
        await callback.message.answer("Аренда продлена, календарь обновлён.", reply_markup=staff_main_menu())
    await callback.answer()


@router.callback_query(StaffOperationForm.extension_confirm, F.data == "staffop:extension:cancel")
async def extension_cancel(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    await callback.answer("Отменено")


@router.message(StaffOperationForm.mileage)
async def operation_mileage(message: Message, state: FSMContext) -> None:
    mileage = positive_integer(message.text, 9_999_999)
    if mileage is None:
        await message.answer("Введите пробег целым числом, например 125430.")
        return
    await state.update_data(mileageKm=str(mileage))
    await state.set_state(StaffOperationForm.fuel)
    await message.answer("Введите уровень топлива от 0 до 100%:")


@router.message(StaffOperationForm.fuel)
async def operation_fuel(message: Message, state: FSMContext) -> None:
    fuel = positive_integer(message.text, 100)
    if fuel is None:
        await message.answer("Введите целое число от 0 до 100.")
        return
    await state.update_data(fuelLevelPercent=str(fuel))
    data = await state.get_data()
    if data["operation"] == "HANDOVER":
        await state.set_state(StaffOperationForm.fulfillment)
        await message.answer(
            "Как машина передана клиенту?",
            reply_markup=operation_choice("fulfillment", [("Выдача в офисе", "OFFICE"), ("Подача по адресу", "DELIVERY")]),
        )
    else:
        await state.set_state(StaffOperationForm.vehicle_condition)
        await message.answer(
            "Состояние машины при возврате:",
            reply_markup=operation_choice("condition", [("Без замечаний", "OK"), ("Есть повреждения", "DAMAGED")]),
        )


@router.callback_query(StaffOperationForm.fulfillment, F.data.startswith("staffop:fulfillment:"))
async def operation_fulfillment(callback: CallbackQuery, state: FSMContext) -> None:
    method = callback.data.rsplit(":", 1)[-1]
    await state.update_data(fulfillmentMethod=method)
    if method == "DELIVERY":
        await state.set_state(StaffOperationForm.fulfillment_address)
        if callback.message:
            await callback.message.answer("Введите адрес подачи:")
    else:
        await state.update_data(fulfillmentAddress="")
        await state.set_state(StaffOperationForm.deposit_amount)
        if callback.message:
            await callback.message.answer("Введите полученный депозит в рублях, 0 если без депозита:")
    await callback.answer()


@router.message(StaffOperationForm.fulfillment_address)
async def operation_address(message: Message, state: FSMContext) -> None:
    address = (message.text or "").strip()
    if not 5 <= len(address) <= 500:
        await message.answer("Введите полный адрес от 5 до 500 символов.")
        return
    await state.update_data(fulfillmentAddress=address)
    await state.set_state(StaffOperationForm.deposit_amount)
    await message.answer("Введите полученный депозит в рублях, 0 если без депозита:")


@router.message(StaffOperationForm.deposit_amount)
async def operation_deposit_amount(message: Message, state: FSMContext) -> None:
    amount = rubles_to_minor(message.text)
    if amount is None:
        await message.answer("Введите сумму в рублях, например 15000 или 15000,50.")
        return
    await state.update_data(depositAmountMinor=str(amount), depositStatus="PAID" if amount else "NOT_REQUIRED")
    if amount:
        await state.set_state(StaffOperationForm.deposit_method)
        await message.answer(
            "Как получен депозит?",
            reply_markup=operation_choice("payment", [("Наличные", "CASH"), ("Карта", "CARD"), ("Перевод", "TRANSFER")]),
        )
    else:
        await state.update_data(depositPaymentMethod="")
        await ask_video(message, state)


@router.callback_query(StaffOperationForm.deposit_method, F.data.startswith("staffop:payment:"))
async def operation_deposit_method(callback: CallbackQuery, state: FSMContext) -> None:
    await state.update_data(depositPaymentMethod=callback.data.rsplit(":", 1)[-1])
    if callback.message:
        await ask_video(callback.message, state)
    await callback.answer()


@router.callback_query(StaffOperationForm.vehicle_condition, F.data.startswith("staffop:condition:"))
async def operation_condition(callback: CallbackQuery, state: FSMContext) -> None:
    condition = callback.data.rsplit(":", 1)[-1]
    await state.update_data(vehicleCondition=condition, damageDescription="")
    await state.set_state(StaffOperationForm.deposit_resolution)
    if callback.message:
        await callback.message.answer(
            "Что с депозитом?",
            reply_markup=operation_choice("resolution", [("Возвращён полностью", "REFUNDED"), ("Удержана часть", "PARTIALLY_WITHHELD"), ("Удержан полностью", "WITHHELD")]),
        )
    await callback.answer()


@router.callback_query(StaffOperationForm.deposit_resolution, F.data.startswith("staffop:resolution:"))
async def operation_deposit_resolution(callback: CallbackQuery, state: FSMContext) -> None:
    resolution = callback.data.rsplit(":", 1)[-1]
    await state.update_data(depositStatus=resolution)
    if resolution == "REFUNDED":
        await state.update_data(depositWithheldMinor="0", depositResolutionReason="")
        if callback.message:
            await ask_video(callback.message, state)
    else:
        await state.set_state(StaffOperationForm.deposit_withheld)
        if callback.message:
            await callback.message.answer("Введите удержанную сумму в рублях:")
    await callback.answer()


@router.message(StaffOperationForm.deposit_withheld)
async def operation_deposit_withheld(message: Message, state: FSMContext) -> None:
    amount = rubles_to_minor(message.text)
    if amount is None or amount <= 0:
        await message.answer("Введите удержанную сумму больше нуля.")
        return
    await state.update_data(depositWithheldMinor=str(amount), depositResolutionReason="Указано сотрудником в Telegram")
    await ask_video(message, state)


async def ask_video(message: Message, state: FSMContext) -> None:
    await state.set_state(StaffOperationForm.video)
    await message.answer(
        "Отправьте одно видео осмотра машины (до 20 МБ).",
        reply_markup=operation_media_skip("video"),
    )


@router.message(StaffOperationForm.video, F.video | F.document)
async def operation_video(message: Message, state: FSMContext) -> None:
    media = message.video or message.document
    mime = media.mime_type or ""
    if mime not in {"video/mp4", "video/webm"} or (media.file_size or 0) > MAX_BOT_VIDEO_BYTES:
        await message.answer("Нужно MP4/WebM видео размером до 20 МБ.")
        return
    await state.update_data(videoFileId=media.file_id, videoName=media.file_name or "inspection.mp4", videoMime=mime)
    await ask_photo(message, state)


async def ask_photo(message: Message, state: FSMContext) -> None:
    await state.set_state(StaffOperationForm.dashboard_photo)
    await message.answer(
        "Отправьте фото приборной панели с пробегом и топливом.",
        reply_markup=operation_media_skip("photo"),
    )


@router.callback_query(StaffOperationForm.video, F.data == "staffop:skip:video")
async def operation_skip_video(callback: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    await state.update_data(skipped=[*data.get("skipped", []), "video"])
    if callback.message:
        await ask_photo(callback.message, state)
    await callback.answer()


@router.message(StaffOperationForm.dashboard_photo, F.photo | F.document)
async def operation_photo(message: Message, state: FSMContext) -> None:
    media = message.photo[-1] if message.photo else message.document
    mime = "image/jpeg" if message.photo else (media.mime_type or "")
    if mime not in {"image/jpeg", "image/png", "image/webp"} or (media.file_size or 0) > MAX_BOT_PHOTO_BYTES:
        await message.answer("Нужно JPG/PNG/WebP фото размером до 15 МБ.")
        return
    await state.update_data(photoFileId=media.file_id, photoName=getattr(media, "file_name", None) or "dashboard.jpg", photoMime=mime)
    await finish_evidence(message, state)


@router.callback_query(StaffOperationForm.dashboard_photo, F.data == "staffop:skip:photo")
async def operation_skip_photo(callback: CallbackQuery, state: FSMContext) -> None:
    data = await state.get_data()
    await state.update_data(skipped=[*data.get("skipped", []), "photo"])
    if callback.message:
        await finish_evidence(callback.message, state)
    await callback.answer()


async def finish_evidence(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    if data.get("skipped"):
        await state.set_state(StaffOperationForm.missing_reason)
        await message.answer("Почему фиксация пропущена? Причина сохранится в договоре навсегда.")
    else:
        await state.update_data(evidenceMissingReason="")
        await show_summary(message, state)


@router.message(StaffOperationForm.missing_reason)
async def operation_missing_reason(message: Message, state: FSMContext) -> None:
    reason = (message.text or "").strip()
    if not 3 <= len(reason) <= 500:
        await message.answer("Укажите причину от 3 до 500 символов.")
        return
    await state.update_data(evidenceMissingReason=reason)
    await show_summary(message, state)


async def show_summary(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    await state.set_state(StaffOperationForm.confirm)
    action = "выдача/подача" if data["operation"] == "HANDOVER" else "возврат"
    evidence_text = "полная" if not data.get("skipped") else "пропущена частично"
    await message.answer(
        f"Проверьте: {action}, пробег {data['mileageKm']} км, топливо {data['fuelLevelPercent']}%, фиксация {evidence_text}.",
        reply_markup=operation_confirmation(),
    )


async def download_media(bot, file_id: str, name: str, mime: str) -> tuple[str, bytes, str]:
    telegram_file = await bot.get_file(file_id)
    buffer = BytesIO()
    await bot.download_file(telegram_file.file_path, destination=buffer)
    return name, buffer.getvalue(), mime


@router.callback_query(StaffOperationForm.confirm, F.data == "staffop:confirm")
async def operation_confirm(callback: CallbackQuery, state: FSMContext, pilot_api) -> None:
    data = await state.get_data()
    try:
        video = None
        photo = None
        if data.get("videoFileId"):
            video = await download_media(callback.bot, data["videoFileId"], data["videoName"], data["videoMime"])
        if data.get("photoFileId"):
            photo = await download_media(callback.bot, data["photoFileId"], data["photoName"], data["photoMime"])
        payload = {
            key: str(data.get(key, ""))
            for key in (
                "idempotencyKey", "mileageKm", "fuelLevelPercent", "evidenceMissingReason",
                "fulfillmentMethod", "fulfillmentAddress", "depositStatus", "depositAmountMinor",
                "depositPaymentMethod", "vehicleCondition", "damageDescription", "depositWithheldMinor",
                "depositResolutionReason",
            )
        }
        payload["occurredAt"] = datetime.now(ZoneInfo("Europe/Moscow")).strftime("%d.%m.%Y %H:%M")
        await pilot_api.complete_rental_operation(
            str(callback.from_user.id), data["rentalId"], data["operation"], payload,
            video=video, dashboard_photo=photo,
        )
    except (PilotApiError, OSError):
        await callback.answer("Не удалось сохранить. Данные не потеряны — повторите.", show_alert=True)
        return
    await state.clear()
    if callback.message:
        await callback.message.answer("Операция сохранена в договоре и истории машины.", reply_markup=staff_main_menu())
    await callback.answer()


@router.callback_query(F.data == "staffop:cancel")
async def operation_cancel(callback: CallbackQuery, state: FSMContext) -> None:
    await state.clear()
    if callback.message:
        await callback.message.answer("Операция отменена.", reply_markup=staff_main_menu())
    await callback.answer()
