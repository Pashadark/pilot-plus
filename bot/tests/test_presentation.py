import asyncio

from bot.presentation import (
    WELCOME_DESCRIPTION,
    WELCOME_SHORT_DESCRIPTION,
    asset_path,
    configure_bot_presentation,
)


def test_presentation_assets_and_copy_are_brand_safe():
    assert asset_path("client-welcome.png").is_file()
    assert asset_path("client-rental-closed.png").is_file()
    assert "Supa Pro" in WELCOME_SHORT_DESCRIPTION
    assert "СУПА ПРО" in WELCOME_DESCRIPTION
    assert len(WELCOME_SHORT_DESCRIPTION) <= 120
    assert len(WELCOME_DESCRIPTION) <= 512


def test_configure_bot_presentation_sets_default_and_russian_descriptions():
    class RecordingBot:
        def __init__(self):
            self.calls = []

        async def set_my_short_description(self, **kwargs):
            self.calls.append(("short", kwargs))

        async def set_my_description(self, **kwargs):
            self.calls.append(("full", kwargs))

    bot = RecordingBot()

    asyncio.run(configure_bot_presentation(bot))

    assert bot.calls == [
        ("short", {"short_description": WELCOME_SHORT_DESCRIPTION}),
        ("full", {"description": WELCOME_DESCRIPTION}),
        (
            "short",
            {"short_description": WELCOME_SHORT_DESCRIPTION, "language_code": "ru"},
        ),
        ("full", {"description": WELCOME_DESCRIPTION, "language_code": "ru"}),
    ]
