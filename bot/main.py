import asyncio

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.redis import RedisStorage

from bot.config import Settings
from bot.handlers.start import router as start_router
from bot.handlers.rentals import router as rentals_router
from bot.services.pilot_api import PilotApiClient
from bot.services.notifications import notification_worker


async def main() -> None:
    settings = Settings()
    bot = Bot(token=settings.telegram_bot_token.get_secret_value())
    storage = RedisStorage.from_url(str(settings.redis_url))
    dispatcher = Dispatcher(storage=storage)
    dispatcher.include_router(start_router)
    dispatcher.include_router(rentals_router)
    api = PilotApiClient(str(settings.pilot_api_base_url), settings.pilot_bot_service_token.get_secret_value(), timeout=settings.request_timeout_seconds)
    stop_event = asyncio.Event()
    worker = asyncio.create_task(notification_worker(bot, api, stop_event, settings.pilot_staff_chat_id))
    try:
        await dispatcher.start_polling(bot, pilot_api=api)
    finally:
        stop_event.set()
        await worker
        await api.close()
        await storage.close()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
