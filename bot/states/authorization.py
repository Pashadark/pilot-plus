from aiogram.fsm.state import State, StatesGroup


class ClientAuthorization(StatesGroup):
    contact = State()
