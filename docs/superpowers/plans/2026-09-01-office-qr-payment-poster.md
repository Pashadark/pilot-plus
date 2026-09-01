# Office QR Payment Poster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать готовую к печати одностраничную A4-листовку «Оплата по QR-коду» для офиса СУПА ПРО.

**Architecture:** Статический PDF генерируется ReportLab из исходного QR-изображения без изменения его пропорций. После генерации PDF проверяется программно и рендерится в PNG для визуального контроля.

**Tech Stack:** Python, ReportLab, Pillow, pypdf/pdfplumber, Poppler.

## Global Constraints

- Итоговый формат: PDF, одна страница A4, вертикальная ориентация.
- Поля безопасной печати не менее 10 мм.
- Заголовок: «Оплата по QR-коду».
- Исходный QR-код нельзя обрезать, растягивать или перерисовывать.
- Кириллица должна корректно отображаться.
- Финальный PDF необходимо отрендерить в PNG и визуально проверить.

---

### Task 1: Создать печатный PDF

**Files:**
- Create: `tmp/pdfs/build_office_qr_payment_poster.py`
- Create: `output/pdf/supa-pro-qr-payment-a4.pdf`

**Interfaces:**
- Consumes: исходное изображение `1-Фото-1.jpg` размером 320x320 пикселей.
- Produces: одностраничный PDF A4 с крупным QR и инструкцией оплаты.

- [ ] **Step 1: Проверить исходный QR**

  Открыть изображение через Pillow, подтвердить квадратные пропорции, ненулевой размер и достаточный контраст.

- [ ] **Step 2: Создать генератор листовки**

  Использовать ReportLab, шрифты DejaVu Sans/DejaVu Sans Bold и страницу `A4`. Разместить фирменную шапку, заголовок, центральную карточку QR, три шага и нижнюю подпись `supapro.ru`.

- [ ] **Step 3: Сгенерировать PDF**

  Run: `python tmp/pdfs/build_office_qr_payment_poster.py`

  Expected: создан `output/pdf/supa-pro-qr-payment-a4.pdf`, одна страница A4.

### Task 2: Проверить итоговый файл

**Files:**
- Read: `output/pdf/supa-pro-qr-payment-a4.pdf`
- Create: `tmp/pdfs/supa-pro-qr-payment-a4-1.png`

**Interfaces:**
- Consumes: PDF из Task 1.
- Produces: подтверждённый печатный PDF без визуальных дефектов.

- [ ] **Step 1: Проверить структуру PDF**

  Run: `pdfinfo output/pdf/supa-pro-qr-payment-a4.pdf`

  Expected: `Pages: 1`, `Page size: 595.276 x 841.89 pts (A4)`.

- [ ] **Step 2: Проверить извлечённый текст**

  Через `pdfplumber` подтвердить наличие строк «Оплата по QR-коду», «Откройте камеру», «Наведите на код», «Подтвердите оплату» и `supapro.ru`.

- [ ] **Step 3: Отрендерить страницу**

  Run: `pdftoppm -png -r 150 output/pdf/supa-pro-qr-payment-a4.pdf tmp/pdfs/supa-pro-qr-payment-a4`

  Expected: PNG без обрезки, наложений, нечитаемого текста и искажений QR.

- [ ] **Step 4: Финальная проверка**

  Открыть PNG, проверить визуальную иерархию, поля печати, контраст и читаемость. При дефекте скорректировать генератор и повторить Tasks 1-2.
