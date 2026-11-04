import asyncio

from aiogram import Bot, Dispatcher, Router
from aiogram.fsm.storage.redis import RedisStorage

from bot.client_config import ClientSettings
from bot.handlers.customer import router as customer_router
from bot.handlers.rentals import router as rentals_router
from bot.handlers.start import router as start_router
from bot.handlers.staff import router as staff_router
from bot.handlers.staff_operations import router as staff_operations_router
from bot.handlers.notification_actions import router as notification_actions_router
from bot.presentation import configure_bot_presentation
from bot.services.pilot_api import PilotApiClient
from bot.services.notifications import notification_worker


def client_routers() -> tuple[Router, ...]:
    return (
        start_router,
        customer_router,
        rentals_router,
        staff_operations_router,
        notification_actions_router,
        staff_router,
    )


async def main() -> None:
    settings = ClientSettings()
    bot = Bot(token=settings.client_telegram_bot_token.get_secret_value())
    try:
        await configure_bot_presentation(bot)
    except Exception as error:
        print(f"bot_presentation_setup_failed={type(error).__name__}", flush=True)
    storage = RedisStorage.from_url(str(settings.redis_url))
    dispatcher = Dispatcher(storage=storage)
    for router in client_routers():
        dispatcher.include_router(router)
    api = PilotApiClient(
        str(settings.supa_pro_api_base_url),
        settings.supa_pro_bot_service_token.get_secret_value(),
        timeout=settings.request_timeout_seconds,
    )
    stop_event = asyncio.Event()
    client_worker = asyncio.create_task(
        notification_worker(
            bot,
            api,
            stop_event,
            worker_id="supa-client-bot",
            audience="CLIENT",
        )
    )
    staff_worker = asyncio.create_task(
        notification_worker(
            bot,
            api,
            stop_event,
            worker_id="supa-staff-bot",
            audience="STAFF",
        )
    )
    try:
        await dispatcher.start_polling(bot, pilot_api=api)
    finally:
        stop_event.set()
        await asyncio.gather(client_worker, staff_worker)
        await api.close()
        await storage.close()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
