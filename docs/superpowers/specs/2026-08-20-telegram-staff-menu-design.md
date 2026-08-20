# Telegram staff menu design

## Goal

Make the linked Pilot+ staff bot usable as a persistent workspace: the main navigation must always remain available, every visible button must respond, and contextual actions must stay attached to the relevant card.

## Navigation

The staff home screen uses a Telegram reply keyboard, not an inline keyboard. It contains:

- `Заявки`
- `Аренды`
- `Календарь`
- `Клиенты`
- `Автопарк`
- `Штрафы`
- `Помощь`

The keyboard is resized for mobile Telegram clients and remains visible after `/start`. Button labels are centralized under `bot/keyboards`; handlers do not duplicate label strings.

Inline keyboards remain contextual. They are used only for actions on a specific entity, such as approving or rejecting a request, opening a rental, or downloading a document.

## Behavior

`/start` resolves the linked identity and shows the correct persistent menu. Staff menu messages are handled independently of FSM state so navigation can recover from an abandoned flow.

Each visible staff button always receives an immediate response:

- implemented sections return live tenant-scoped Pilot+ data;
- a section whose protected API is not available yet returns a clear Russian message that it is being prepared;
- API failures return a concise retry message and never leave Telegram showing an unanswered action.

The existing dead `staff:requests` callback is removed from the main menu. Old messages containing that callback remain safely handled for backward compatibility instead of silently doing nothing.

## Security and data flow

The bot remains API-only and never connects directly to PostgreSQL. Every data request includes the Telegram user ID and the protected Pilot+ service token. Pilot+ resolves the active identity, company, user role, and tenant scope for every operation.

No client PII is logged. Responses expose only the fields needed by the selected bot view. Mutating actions remain inline, entity-bound, and server-authorized.

## Error handling

- Every callback is acknowledged.
- Every reply-menu message produces a response.
- Unknown text returns the persistent menu with a short hint.
- An unavailable Pilot+ API produces a retry message without clearing useful FSM data.
- Staff-only buttons are never shown to linked clients.

## Verification

Tests must prove:

1. the staff main menu is a reply keyboard containing all seven actions;
2. `/start` returns that keyboard for a staff identity;
3. every menu label has a registered handler and returns a message;
4. the legacy `staff:requests` callback is acknowledged;
5. clients still receive their own menu and cannot access staff handlers;
6. the deployed container remains healthy and a real `/start` shows the new menu.

## Scope boundary

This change fixes navigation and dead actions. It does not invent unsafe direct-database bot access or implement all future staff workflows in one release. Sections without an existing protected API receive an explicit temporary response until their vertical API slice is added.
