# Промо автопарка, 08.10.2026

18 отдельных PNG для 24 автомобилей. Встроенный ImageGen, `transparent_background: true`; оригинальные фотографии и записи БД не изменены. Изображения являются промо-иллюстрациями, не доказательством состояния или комплектации автомобиля.

Файлы: `public/vehicles/promo/`. Визуальная проверка обеих тем: `public/vehicles/promo/index.html`. Привязка к существующим машинам: `src/modules/dashboard/vehicle-promo.ts`. Для неизвестных ID используется исходная фотография, без подбора случайной модели. Для Mercedes Н604АВ997 использован общий чёрный дорестайлинговый кузов E-класса: в БД точная модель пока не заполнена, старое промо было серебристым при указанном чёрном цвете.

Источники: фото из карточек компании, полученные read-only 08.10.2026, локальная рабочая копия `.codex-tmp/promo-sources/`. Внешняя среда удалена, номера пустые. Сведения о годах Cerato и Ceed в БД расходятся с видом машин; генерация опирается на фотографии, сами поля не исправлялись в рамках дизайна.

## Prompt set

Для каждого файла имя модели/цвета подставлялось в отдельный запрос. Общее требование: preserve the EXACT car generation, paint color, body and wheels from the source photograph; full front three-quarter view, centered with transparent margins; clean soft neutral studio reflections; genuine transparent alpha; no opaque floor, no plate letters/numbers, no floating pixels, no white halo, no text or watermark; readable on white and #101014.

- BMW, Ceed, Cerato: background-extraction, remove paving, trees and environment, replace tree reflections with soft neutral studio highlights, vehicle fills 85% of landscape canvas.
- K5, Rio, Sorento: background-extraction, single-car catalogue PNG, same vehicle details, left-facing front where feasible.
- E200, E220 2020, Karoq, Polo, Camry: product-mockup with reference, exact model/color and wheels, clean neutral lighting.
- E220 2019: preserve the vertical grille and five-spoke wheels from the actual photograph.
- Octavia: refined background extraction with explicit removal of white remnants around roof and wheels.
- Camry 2019 white: preserve white roof; do not add the black roof of the other white Camry.

На рабочем дне PNG идут через Next Image для небольших адаптивных размеров и сохранения прозрачности; защищённые исходные фото остаются unoptimized, чтобы не нарушать авторизацию загрузки.
