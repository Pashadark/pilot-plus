# Административные границы регионов России

`russia-admin1.geojson` формируется командой:

```powershell
node scripts/prepare-russian-region-data.mjs
```

Источник — Natural Earth Admin 1, версия 5.1.2, public domain. Полигон каждого региона
нормализуется в `MultiPolygon`. Территории с неподтверждённым или спорным статусом нельзя
использовать для автоматического объявления нарушения: у них
`automaticEnforcementAllowed=false`.

Данные предназначены для навигационного GPS-контроля и не являются юридической картой.
