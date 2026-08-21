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


class StaffOperationForm(StatesGroup):
    extension_end = State()
    extension_confirm = State()
    mileage = State()
    fuel = State()
    fulfillment = State()
    fulfillment_address = State()
    deposit_amount = State()
    deposit_method = State()
    vehicle_condition = State()
    deposit_resolution = State()
    deposit_withheld = State()
    video = State()
    dashboard_photo = State()
    missing_reason = State()
    confirm = State()
