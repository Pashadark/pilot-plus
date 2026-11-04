from time import time

from aiogram import F, Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, ReplyKeyboardRemove

from bot.keyboards.client import contact_keyboard
from bot.keyboards.staff import staff_main_menu
from bot.messages.client_states import send_unresolved_rental
from bot.services.errors import PilotApiError
from bot.states.authorization import ClientAuthorization
from bot.handlers.customer import show_client_home

router = Router(name="start")


@router.message(CommandStart())
async def start(message: Message, command: CommandObject, pilot_api, state: FSMContext) -> None:
    if not message.from_user:
        return
    if message.chat.type != "private":
        await message.answer("Откройте личный чат с ботом для входа и просмотра аренды.")
        return
    await state.clear()
    telegram_id = str(message.from_user.id)
    try:
        if command.args:
            await pilot_api.link_identity(command.args, telegram_id)
        profile = await pilot_api.profile(telegram_id)
    except PilotApiError as error:
        if error.code == "CONTACT_REQUIRED" or (error.code == "IDENTITY_REQUIRED" and not command.args):
            await state.set_state(ClientAuthorization.contact)
            await state.update_data(invite_token=command.args, expires_at=time() + 600)
            await message.answer("Подтвердите свой телефон кнопкой ниже. Номер должен совпадать с номером в договоре. Чужие контакты и номер текстом не подходят.", reply_markup=contact_keyboard())
            return
        await message.answer("Бот ещё не привязан. Попросите персональную ссылку у сотрудника СУПА ПРО.")
        return
    if profile.get('kind') == 'CLIENT':
        await show_client_home(message, pilot_api, telegram_id)
        return
    await message.answer(
        f"Здравствуйте, {profile.get('displayName') or 'сотрудник'}! Выберите рабочий раздел СУПА ПРО:",
        reply_markup=staff_main_menu(),
    )


@router.message(ClientAuthorization.contact, F.contact)
async def verify_contact(message: Message, state: FSMContext, pilot_api) -> None:
    if not message.from_user or message.chat.type != "private":
        return
    contact = message.contact
    if not contact or contact.user_id != message.from_user.id:
        await message.answer("Нужен ваш собственный контакт. Нажмите «Подтвердить мой телефон».", reply_markup=contact_keyboard())
        return
    data = await state.get_data()
    if data.get("expires_at", 0) < time():
        await state.clear()
        await message.answer("Время подтверждения истекло. Откройте персональную ссылку ещё раз.", reply_markup=ReplyKeyboardRemove())
        return
    try:
        profile = await pilot_api.link_identity(data.get("invite_token"), str(message.from_user.id), phone_number=contact.phone_number, contact_user_id=str(contact.user_id))
    except PilotApiError as error:
        if error.code == "CONTACT_MISMATCH":
            await message.answer("Телефон не совпал с данными клиента. Попросите менеджера проверить номер в СУПА ПРО. Доступ не открыт.")
        elif error.code == "MANAGER_REVIEW_REQUIRED":
            await send_unresolved_rental(message)
        else:
            await message.answer("Не удалось подтвердить доступ. Попробуйте позже или обратитесь к менеджеру.")
        return
    await state.clear()
    await message.answer("Телефон подтверждён. Здесь будут сведения о вашей аренде и уведомления.", reply_markup=ReplyKeyboardRemove())
    await show_client_home(message, pilot_api, str(message.from_user.id))


@router.message(ClientAuthorization.contact)
async def require_contact(message: Message) -> None:
    if message.chat.type == "private":
        await message.answer("Для входа нажмите кнопку «Подтвердить мой телефон». Номер текстом не подтверждает владельца.", reply_markup=contact_keyboard())
