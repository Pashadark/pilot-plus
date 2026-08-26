# Flat-аватар Telegram-бота СУПА ПРО — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать читаемый flat-аватар Telegram-бота СУПА ПРО с монограммой «СП», автомобилем и GPS-акцентом.

**Architecture:** Новый вариант генерируется встроенным ImageGen как отдельный растровый исходник. После визуальной проверки он копируется в проект, приводится к размерам 1024×1024 и 256×256 и проверяется в круглой маске Telegram без замены ранее утверждённых файлов.

**Tech Stack:** OpenAI built-in ImageGen, PNG с альфа-каналом, PowerShell/System.Drawing для точного ресайза, Codex `view_image` для визуальной проверки.

## Global Constraints

- Строгий современный flat-дизайн и только сплошные цвета.
- Палитра: тёмно-синий, белый, один бирюзовый акцент.
- Точная кириллическая монограмма «СП»; дополнительного текста нет.
- Без градиентов, объёма, металла, бликов, теней, свечения, фотореализма и водяных знаков.
- Основной PNG 1024×1024; превью PNG 256×256 с круглой маской.
- Прежний аватар не перезаписывать до подтверждения нового варианта.

---

### Task 1: Сгенерировать и проверить flat-концепт

**Files:**
- Create: `$CODEX_HOME/generated_images/<generated-id>.png`

**Interfaces:**
- Consumes: утверждённая композиция из `docs/superpowers/specs/2026-08-26-supapro-flat-bot-avatar-design.md`.
- Produces: один квадратный PNG-концепт без визуальных нарушений спецификации.

- [ ] **Step 1: Выполнить генерацию встроенным ImageGen**

Использовать промпт:

```text
Use case: logo-brand
Asset type: square Telegram bot avatar
Primary request: minimal flat brand mark for the Russian fleet-management system СУПА ПРО
Subject: large exact Cyrillic monogram «СП», with a small simplified white passenger-car silhouette below and one compact cyan GPS signal symbol
Style/medium: strict modern vector-friendly flat design, bold geometric shapes, solid colors only
Composition/framing: centered inside a dark navy circular field, generous safe margin for Telegram circular crop, readable at 40–64 px
Color palette: dark navy, white, one cyan accent
Text (verbatim): "СП"
Constraints: exact Cyrillic letters; no other text; no watermark
Avoid: gradients, 3D, metallic surfaces, highlights, shadows, glow, photorealism, tiny details, frames
```

- [ ] **Step 2: Проверить концепт визуально**

Открыть PNG через `view_image` и подтвердить: буквы читаются как «СП», автомобиль и GPS различимы, круглая обрезка не затрагивает элементы, запрещённые эффекты отсутствуют.

### Task 2: Подготовить проектные PNG

**Files:**
- Create: `bot/assets/supapro-bot-avatar-flat.png`
- Create: `bot/assets/supapro-bot-avatar-flat-preview.png`

**Interfaces:**
- Consumes: утверждённый PNG-концепт из Task 1.
- Produces: основной файл 1024×1024 и круглое превью 256×256.

- [ ] **Step 1: Скопировать и привести основной файл к 1024×1024**

Сохранить результат как `bot/assets/supapro-bot-avatar-flat.png`, не изменяя прежний `supapro-bot-avatar.png`.

- [ ] **Step 2: Создать круглое превью 256×256**

Применить круглую альфа-маску и сохранить `bot/assets/supapro-bot-avatar-flat-preview.png`.

- [ ] **Step 3: Проверить размеры и альфа-канал**

Run: PowerShell `System.Drawing.Image::FromFile(...)` для обоих файлов.

Expected: `1024x1024 Format32bppArgb` и `256x256 Format32bppArgb`.

- [ ] **Step 4: Показать превью пользователю**

Открыть `bot/assets/supapro-bot-avatar-flat-preview.png` через `view_image` и отправить изображение прямо в чат.

- [ ] **Step 5: Зафиксировать файлы**

```bash
git add bot/assets/supapro-bot-avatar-flat.png bot/assets/supapro-bot-avatar-flat-preview.png
git commit -m "feat: add flat supapro bot avatar"
```
