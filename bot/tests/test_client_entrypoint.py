from bot.client_main import client_routers


def test_single_bot_process_registers_client_and_staff_routers():
    assert [router.name for router in client_routers()] == [
        "start",
        "customer",
        "rentals",
        "staff_operations",
        "notification_actions",
        "staff",
    ]


def test_staff_router_is_registered_only_once():
    assert [router.name for router in client_routers()].count("staff") == 1
