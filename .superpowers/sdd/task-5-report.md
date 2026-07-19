# Task 5 — одноразовые auth toast

## Реализация

- Успешный вход перенаправляет на `/?welcome=1`, выход — на `/login?loggedOut=1`.
- Серверные страницы Next 16 ожидают `searchParams` как `Promise` и превращают только точное значение `1` в безопасный `FlashToastKind`.
- `FlashToast` содержит фиксированный allowlist сообщений, показывает уведомление один раз и удаляет только обработанный marker через `history.replaceState`.
- Произвольный текст из URL не передаётся в toast и игнорируется.

## Проверки

- `npm run test:unit` — 19 files, 82 tests passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npx playwright test tests/auth.spec.ts --workers=1` — 12 passed (desktop/mobile); 2 проверки welcome skipped, так как в окружении отсутствуют `PILOT_ADMIN_EMAIL` и `PILOT_ADMIN_PASSWORD`.

## Ограничения

Полный browser-сценарий успешного входа выполняется автоматически, когда доступны тестовые credentials администратора. Redirect на `/?welcome=1` покрыт unit-тестом auth action; публичный browser-сценарий выхода и allowlist marker покрыты в текущем окружении.
