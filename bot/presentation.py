from pathlib import Path


WELCOME_SHORT_DESCRIPTION = (
    "Помощник клиента Supa Pro: аренда, договор, залог, штрафы и предупреждения в поездке."
)
WELCOME_DESCRIPTION = (
    "СУПА ПРО помогает во время аренды: показывает договор, залог и штрафы, "
    "напоминает о сроках, предупреждает о скорости, резком разгоне и торможении "
    "и помогает быстро связаться с менеджером. Важные сообщения приходят "
    "автоматически, чтобы поездка была безопаснее и понятнее."
)


def asset_path(name: str) -> Path:
    return Path(__file__).resolve().parent / "assets" / name


async def configure_bot_presentation(bot) -> None:
    await bot.set_my_short_description(
        short_description=WELCOME_SHORT_DESCRIPTION,
    )
    await bot.set_my_description(
        description=WELCOME_DESCRIPTION,
    )
    await bot.set_my_short_description(
        short_description=WELCOME_SHORT_DESCRIPTION,
        language_code="ru",
    )
    await bot.set_my_description(
        description=WELCOME_DESCRIPTION,
        language_code="ru",
    )
