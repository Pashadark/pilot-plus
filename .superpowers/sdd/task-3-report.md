# Task 3 report — контракты домена Pilot Connect

## Результат

- Добавлены сериализуемые контракты `DeviceListItem`, `DeviceDetails`,
  `DeviceCommandItem` и `FirmwareReleaseItem`, а также связанные enum-like типы и
  `DeviceActionState`.
- `getEffectiveDeviceStatus` сначала отдаёт `UNASSIGNED` для устройства без
  автомобиля, затем переводит сохранённый `ONLINE` в `OFFLINE` только после более чем
  15 минут без связи. Ровно 15 минут остаются `ONLINE`.
- Метаданные статусов используют утверждённые русские подписи: «Онлайн», «Офлайн»,
  «Требует внимания», «Не привязано» и «Отключено».
- Zod-схемы проверяют границы имени, серийного номера, IMEI, версий, bounded ID и
  discriminated union команд. Обновление требует `firmwareReleaseId`; reboot/shutdown
  не принимают firmware-поля.
- `canUpdateFirmware` принимает ровно три числовых сегмента и возвращает `true` только
  для строго более новой версии.

## TDD

### RED

До реализации выполнен focused Vitest. Три suite ожидаемо завершились с ошибками
`Cannot find module './status'`, `Cannot find module './validation'` и
`Cannot find module './firmware'`: production-модули ещё отсутствовали.

### GREEN

После минимальной реализации focused-набор прошёл: 3 файла, 15 тестов.

## Проверки

| Проверка | Результат |
| --- | --- |
| Focused Vitest | PASS — 3 файла, 15 тестов |
| `npm run typecheck` | PASS |
| `npm run lint -- src/modules/devices` | PASS |
| Scoped Prettier | PASS |
| `git diff --check` | PASS |

## Границы

- Prisma schema, миграции, seed, Server Actions, страницы и другие модули не менялись.
- Полный unit/e2e-набор намеренно не запускался: задача ограничена чистыми доменными
  контрактами.
