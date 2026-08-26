# Compact Client Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привести desktop-таблицу клиентов к средней плотности, единой типографике и аккуратному выравниванию, сохранив звёздный рейтинг и кнопку-иконку просмотра.

**Architecture:** Изменения ограничены презентационными компонентами `ClientGrid` и `ClientRatingStars`. Данные, серверные запросы и мобильные карточки не меняются; поведение фиксируется серверным компонентным тестом разметки.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, React Icons, Vitest, React DOM server rendering.

## Global Constraints

- Средняя плотность: строки 68–72 px.
- Основной текст 14 px; `font-medium` только для имени и значимых ссылок.
- Вторичные данные 12 px и серого цвета.
- Рейтинг: пять небольших жёлтых звёзд и числовая оценка.
- Денежные значения выровнены вправо и используют tabular nums.
- Действие — квадратная кнопка с иконкой, tooltip и `aria-label="Открыть карточку клиента"`.
- Мобильные карточки не меняются.

---

### Task 1: Зафиксировать компактную структуру тестом

**Files:**
- Modify: `src/modules/clients/components/ClientGrid.test.tsx`

**Interfaces:**
- Consumes: HTML, который возвращает `ClientGrid`.
- Produces: регрессионные утверждения для типографики, выравнивания и доступного действия.

- [ ] **Step 1: Добавить утверждения презентации**

В существующий тест `renders photo-first operational columns with real rental context` добавить:

```ts
expect(markup).toContain('aria-label="Открыть карточку клиента"');
expect(markup).toContain('title="Открыть карточку клиента"');
expect(markup).toContain('h-[72px]');
expect(markup).toContain('text-right tabular-nums');
expect(markup).not.toContain('class="font-bold');
```

- [ ] **Step 2: Запустить тест и увидеть ожидаемое падение**

Run: `npx vitest run src/modules/clients/components/ClientGrid.test.tsx`

Expected: FAIL, потому что текущая таблица не содержит новой кнопки-иконки и компактных классов.

### Task 2: Реализовать среднюю плотность и единый шрифт

**Files:**
- Modify: `src/modules/clients/components/ClientGrid.tsx`
- Modify: `src/modules/client-rating/components/ClientRatingStars.tsx`

**Interfaces:**
- Consumes: существующие `ClientCardDto`, `ClientRatingSummary`, `Badge`, `ClientPhoto`.
- Produces: прежний публичный интерфейс `ClientGrid`, но с компактной desktop-разметкой.

- [ ] **Step 1: Привести таблицу к общей типографике**

Установить `text-sm font-normal`, заголовок оставить `text-xs font-medium`, уменьшить horizontal padding до `px-3`, а каждой desktop-строке добавить `h-[72px]`. Имя клиента сделать `font-medium`; телефон, аренды, машина и суммы оставить без `font-semibold`/`font-bold`.

- [ ] **Step 2: Выровнять числовые колонки**

Заголовки и ячейки стоимости и депозита оформить `text-right`; значения — `whitespace-nowrap tabular-nums`. Количество аренд также получает `tabular-nums` без жирного начертания.

- [ ] **Step 3: Упростить вторичные строки**

Сохранить только дату, регистрационный номер и номер договора в `text-xs text-[var(--color-text-secondary)]`; убрать отдельную подпись `Последняя` под стоимостью.

- [ ] **Step 4: Сделать доступную кнопку-иконку**

Импортировать `FiEye` из `react-icons/fi` и заменить текстовую кнопку:

```tsx
<Link
  href={`/clients/${client.id}`}
  aria-label="Открыть карточку клиента"
  title="Открыть карточку клиента"
  className="inline-flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
>
  <FiEye aria-hidden="true" className="size-4" />
</Link>
```

- [ ] **Step 5: Сделать рейтинг легче**

В `ClientRatingStars` заменить контейнер на `flex items-center gap-1.5 text-sm`, звёздам добавить `size-3.5`, а числовую оценку вывести через `<span className="tabular-nums text-[var(--color-text-secondary)]">` вместо `<strong>`.

- [ ] **Step 6: Запустить целевой тест**

Run: `npx vitest run src/modules/clients/components/ClientGrid.test.tsx`

Expected: PASS.

- [ ] **Step 7: Проверить типы и сборку**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run build`

Expected: production build completes successfully.

- [ ] **Step 8: Зафиксировать реализацию**

```bash
git add src/modules/clients/components/ClientGrid.tsx src/modules/clients/components/ClientGrid.test.tsx src/modules/client-rating/components/ClientRatingStars.tsx
git commit -m "feat: compact client operations table"
```
