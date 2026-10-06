from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message, ReplyKeyboardRemove
from bot.keyboards.client import client_main_menu, customer_back, fine_actions, fines_navigation
from bot.keyboards.rentals import rental_documents
from bot.formatters.rentals import rental_card
from bot.formatters.fines import fine_card
from bot.services.errors import PilotApiError

router = Router(name='customer')
router.message.filter(F.chat.type == 'private')
router.callback_query.filter(F.message.chat.type == 'private')

class CustomerQuestion(StatesGroup):
    text = State()

async def show_client_home(message: Message, pilot_api, telegram_id: str):
    if message.chat.type != 'private': return
    await message.answer('Личный кабинет клиента', reply_markup=ReplyKeyboardRemove())
    try:
        items = (await pilot_api.rentals(telegram_id)).get('items', [])
    except PilotApiError:
        await message.answer('Не удалось обновить аренду. Попробуйте «Моя аренда» ещё раз.', reply_markup=client_main_menu())
        return
    active = [r for r in items if r.get('status') in {'ACTIVE','CONFIRMED'}]
    if not active:
        await message.answer('Сейчас у вас нет действующей аренды.', reply_markup=client_main_menu())
        return
    for item in active:
        await message.answer(rental_card(item), parse_mode='HTML', reply_markup=client_main_menu())

@router.callback_query(F.data == 'client:menu')
async def home(callback: CallbackQuery, state: FSMContext, pilot_api):
    await state.clear()
    await callback.answer()
    if callback.message: await show_client_home(callback.message, pilot_api, str(callback.from_user.id))

@router.message(Command('menu'))
async def menu(message: Message, state: FSMContext, pilot_api):
    await state.clear()
    await show_client_home(message, pilot_api, str(message.from_user.id))

@router.callback_query(F.data.startswith('client:fines:'))
async def fines(callback: CallbackQuery, state: FSMContext, pilot_api):
    await state.clear()
    try:
        page = int(callback.data.rsplit(':',1)[-1])
        result = await pilot_api.fines(str(callback.from_user.id), page)
    except (PilotApiError, ValueError):
        await callback.answer('Не удалось загрузить штрафы. Повторите вход через /start.', show_alert=True)
        return
    await callback.answer()
    if not callback.message: return
    items = result.get('items', [])
    await callback.message.answer('🧾 Ваши штрафы' if items else 'Подтверждённых менеджером штрафов пока нет.', reply_markup=fines_navigation(page,result.get('hasMore',False)))
    for item in items:
        await callback.message.answer(fine_card(item), parse_mode='HTML', reply_markup=fine_actions(item['id'],item.get('status') in {'PAID','CANCELLED'}))

@router.callback_query(F.data == 'client:documents')
async def contracts(callback: CallbackQuery, state: FSMContext, pilot_api):
    await state.clear()
    try:
        items = (await pilot_api.rentals(str(callback.from_user.id))).get('items', [])
    except PilotApiError:
        await callback.answer('Договоры недоступны', show_alert=True)
        return
    await callback.answer()
    if not callback.message: return
    ready = [r for r in items if r.get('documentsReady')]
    for item in ready:
        await callback.message.answer(rental_card(item),parse_mode='HTML',reply_markup=rental_documents(item['id']))
    await callback.message.answer('Выберите договор выше.' if ready else 'Документы пока не подготовлены.',reply_markup=customer_back())

@router.callback_query((F.data == 'client:help') | F.data.startswith('client:question:') | F.data.startswith('client:pay:'))
async def ask(callback: CallbackQuery, state: FSMContext, pilot_api):
    try:
        if (await pilot_api.profile(str(callback.from_user.id))).get('kind') != 'CLIENT':
            await callback.answer('Этот раздел доступен клиентам',show_alert=True)
            return
        if callback.data.startswith('client:pay:'):
            await pilot_api.support(str(callback.from_user.id),'Прошу прислать ссылку на оплату штрафа.',callback.id,callback.data.rsplit(':',1)[-1])
            await callback.answer('Запрос отправлен менеджеру',show_alert=True)
            return
    except PilotApiError:
        await callback.answer('Не удалось отправить запрос. Попробуйте позже.',show_alert=True)
        return
    await state.clear()
    await state.set_state(CustomerQuestion.text)
    await state.update_data(fine_id=callback.data.rsplit(':',1)[-1] if callback.data.startswith('client:question:') else None)
    await callback.answer()
    if callback.message: await callback.message.answer('Напишите вопрос одним сообщением (до 1500 символов). Он поступит менеджеру.',reply_markup=customer_back())

@router.message(CustomerQuestion.text)
async def question(message: Message,state: FSMContext,pilot_api):
    text=(message.text or '').strip()
    if not 1 <= len(text) <= 1500:
        await message.answer('Нужно текстовое сообщение от 1 до 1500 символов.',reply_markup=customer_back())
        return
    data=await state.get_data()
    try:
        await pilot_api.support(str(message.from_user.id),text,f'message-{message.message_id}',data.get('fine_id'))
    except PilotApiError:
        await message.answer('Не удалось отправить вопрос. Попробуйте через несколько минут.',reply_markup=customer_back())
        return
    await state.clear()
    await message.answer('Вопрос отправлен менеджеру. Он свяжется с вами.',reply_markup=customer_back())
