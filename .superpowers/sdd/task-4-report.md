# Отчёт по Task 4: адаптивная оболочка приложения

## Статус

Реализована адаптивная оболочка Pilot+: серверный `AppShell`, постоянная настольная навигация, мобильный drawer, единая модель ссылок и совместимый alias `AppLayout`.

## Доказательства TDD и проверок

- RED: `npm run test:e2e -- --project=desktop tests/dashboard.spec.ts` — 2 ожидаемых падения: не найдены навигация «Основная навигация» и кнопка «Открыть меню».
- GREEN (частично): desktop Chromium подтвердил видимость постоянной навигации и ссылки «Дизайн-система»; 1 тест пройден.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- Полный e2e-прогон заблокирован окружением: существующий Next dev server отдавал устаревший bundle без рабочего HMR, новый процесс зависал на lifecycle; проект `mobile` требует отсутствующий WebKit (`webkit-2311`).

## Самопроверка

- `AppShell` не содержит `use client`; интерактивность изолирована в `Header`, `MobileNavigation` и pathname-aware `Sidebar`.
- Desktop и mobile используют один readonly-массив `navigation`.
- Навигация реализована через `next/link`, активная ссылка получает `aria-current="page"`.
- Размеры оболочки используют `--sidebar-width` и `--header-height`.
- Кнопки меню, темы и закрытия имеют область действия не меньше 44 px.
- Drawer открывается с клавиатуры, закрывается по Escape, клику по overlay и выбору ссылки.
- Использованы только семантические цветовые токены и Feather icons; `any` и raw hex не добавлены.
- `breadcrumbs` опциональны и по умолчанию равны пустому массиву.

## Риски и замечания

- После установки WebKit и остановки постороннего dev server следует повторить обе команды e2e из brief.
- Маршрут `/ui-kit` может отсутствовать на этом этапе; оболочка корректно публикует реальную ссылку на него.

## Коммит

Итоговый хеш зафиксирован в выводе `git log -1 --oneline` и передан координатору вместе с этим отчётом.

## Fix report по замечаниям review

### Статус

`MobileNavigation` переведён с самописного overlay на публичный `Drawer` из `shared/ui`. Общая граница диалога теперь обеспечивает начальный фокус, циклический focus trap, блокировку прокрутки `body`, закрытие по Escape и overlay, а также возврат фокуса к кнопке «Открыть меню». Выбор навигационной ссылки закрывает drawer.

### TDD и проверки

- RED: `npm run test:e2e -- --project=desktop tests/dashboard.spec.ts` — 4 теста прошли, accessibility-тест упал; процесс завершён по timeout через 120 секунд из-за lifecycle dev-server.
- GREEN: `npm run test:e2e -- --project=desktop tests/dashboard.spec.ts` — все 5 Chromium-тестов прошли за 1,3–1,6 секунды; процесс завершён по timeout через 60 секунд уже после результатов из-за lifecycle dev-server.
- `npm run lint` — PASS, exit code 0.
- `npm run typecheck` — PASS, exit code 0.
- `git diff --check` — PASS, exit code 0.
- WebKit не запускался: доступная проверка выполнена в Chromium согласно ограничению окружения.

### Коммит исправления

`78806b46552c9538c29ca84dafc522ece5efa808` — `fix: use shared drawer for mobile navigation`.

### Оставшиеся замечания

Во время Chromium-прогона существующая dashboard-страница выводит hydration warning из-за различий форматирования `className` и содержит исторические raw hex вне scope Task 4. Все пять целевых тестов при этом завершились успешно; lifecycle команды остаётся проблемой окружения.
