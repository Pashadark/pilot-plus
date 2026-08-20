from aiogram.fsm.state import State, StatesGroup


class NewRentalForm(StatesGroup):
    starts_at = State()
    ends_at = State()
    vehicle = State()
    fulfillment = State()
    delivery_address = State()
    comment = State()
    confirm = State()


class ExtensionForm(StatesGroup):
    rental = State()
    ends_at = State()
    confirm = State()
