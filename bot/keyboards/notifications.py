import re
from urllib.parse import urlparse

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


_URL_ACTIONS = frozenset({"map_url", "contract_url", "decree_url", "payment_url", "open_url"})
_SUMMARY_SECTIONS = frozenset({"critical", "trackers", "totals"})
_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _safe_url(action_type: str, value: object) -> str | None:
    url = str(value or "").strip()
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        return None
    return url


def _callback_data(action: dict) -> str | None:
    action_type = action.get("type")
    if action_type == "summary_section":
        section = str(action.get("section") or "")
        date = str(action.get("date") or "")
        if section in _SUMMARY_SECTIONS and _ISO_DATE.fullmatch(date):
            return f"notify:section:{section}:{date}"
        return None
    if action_type == "summary_refresh":
        date = str(action.get("date") or "")
        return f"notify:refresh:{date}" if _ISO_DATE.fullmatch(date) else None
    if action_type == "remind":
        action_id = str(action.get("actionId") or "")
        return f"notify:remind:{action_id}" if _SAFE_ID.fullmatch(action_id) else None
    if action_type == "notify_client":
        action_id = str(action.get("actionId") or "")
        return f"notify:client:{action_id}:impound" if _SAFE_ID.fullmatch(action_id) else None
    if action_type == "vehicle_block_confirm":
        action_id = str(action.get("actionId") or "")
        token = str(action.get("confirmationToken") or "")
        if _SAFE_ID.fullmatch(action_id) and _SAFE_ID.fullmatch(token):
            return f"notify:block:{action_id}:{token}"
    return None


def notification_actions(actions: list[dict] | None) -> InlineKeyboardMarkup | None:
    rows: list[list[InlineKeyboardButton]] = []
    compact_row: list[InlineKeyboardButton] = []

    def flush_compact() -> None:
        nonlocal compact_row
        if compact_row:
            rows.append(compact_row)
            compact_row = []

    for action in actions or []:
        label = str(action.get("label") or "").strip()
        if not label or len(label) > 64:
            continue
        action_type = str(action.get("type") or "")
        if action_type in _URL_ACTIONS:
            url = _safe_url(action_type, action.get("url"))
            if url:
                button = InlineKeyboardButton(text=label, url=url)
                if action_type == "payment_url":
                    flush_compact()
                    rows.append([button])
                else:
                    compact_row.append(button)
                    if len(compact_row) == 2:
                        flush_compact()
            continue
        callback_data = _callback_data(action)
        if callback_data and len(callback_data.encode("utf-8")) <= 64:
            flush_compact()
            rows.append([InlineKeyboardButton(text=label, callback_data=callback_data)])
    flush_compact()
    return InlineKeyboardMarkup(inline_keyboard=rows) if rows else None
