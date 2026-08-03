import { expect, test } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await openAuthenticatedRoute(page, '/system');
});

test('показывает безопасное состояние четырёх независимых сервисов', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Состояние системы', level: 1 })).toBeVisible();

  const cards = page.getByTestId('service-health-card');
  await expect(cards).toHaveCount(4);
  for (const label of ['API Pilot+', 'PostgreSQL', 'Redis', 'MQTT']) {
    const card = cards.filter({ has: page.getByRole('heading', { name: label }) });
    await expect(card).toBeVisible();
    await expect(card.getByTestId('service-health-status')).toHaveText(
      /^(Работает|Недоступен|Не настроен)$/,
    );
    await expect(card.getByText('Проверено')).toBeVisible();
    await expect(card.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
  }

  await expect(page.getByText(/redis\.internal|mqtt\.internal|127\.0\.0\.1|5433/i)).toHaveCount(0);
});

test('на среднем экране заголовок PostgreSQL остаётся внутри карточки', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/system');

  const card = page
    .getByTestId('service-health-card')
    .filter({ has: page.getByRole('heading', { name: 'PostgreSQL' }) });
  const heading = card.getByRole('heading', { name: 'PostgreSQL' });
  const [cardBox, headingBox] = await Promise.all([card.boundingBox(), heading.boundingBox()]);

  expect(cardBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(headingBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
  expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width);
});

test('на мобильном экране карточки идут одной колонкой без переполнения', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/system');

  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const boxes = await page.getByTestId('service-health-card').evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      return { top: box.top, width: box.width };
    }),
  );
  expect(boxes).toHaveLength(4);
  expect(boxes[1]?.top ?? 0).toBeGreaterThan(boxes[0]?.top ?? 0);
  expect(boxes[2]?.top ?? 0).toBeGreaterThan(boxes[1]?.top ?? 0);
  expect(boxes[3]?.top ?? 0).toBeGreaterThan(boxes[2]?.top ?? 0);
  for (const box of boxes) expect(box.width).toBeLessThanOrEqual(390);
});
