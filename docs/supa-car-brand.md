# SUPA CAR — базовый знак приложения

SUPA CAR — отдельное мобильное приложение для владельцев автомобилей, подключённых к Supa Pro.
Знак Supa Pro не изменяется и не используется как основа знака SUPA CAR.

## Утверждённое направление

- Композиция: `SUPA` на первой строке, `CAR` на второй.
- Фон: графит `#101014`.
- Градиент букв: `#FF7A00` → `#FF5200` → `#FF3024`.
- Только прописные буквы.
- Без дополнительных автомобильных символов, обводки и слогана.
- Для Android adaptive icon текст располагается внутри безопасной центральной области.

## Исходники

- `public/supa-car/brand/supa-car-app-icon.svg` — основной квадратный значок.
- `public/supa-car/brand/supa-car-adaptive-background.svg` — фон Android adaptive icon.
- `public/supa-car/brand/supa-car-adaptive-foreground.svg` — передний слой Android adaptive icon.
- `public/supa-car/brand/supa-car-splash.svg` — вертикальная заставка.

SVG является основным исходником. PNG-экспорты генерируются из него без изменения композиции и цветов.
