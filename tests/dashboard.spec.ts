import { expect, test } from '@playwright/test';

test('настольная оболочка показывает постоянную навигацию', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Дизайн-система' })).toBeVisible();
});

test('настольная панель управления отдаёт приоритет карте автопарка', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Центр управления транспортом' }),
  ).toBeVisible();
  await expect(page.getByTestId('fleet-map-workspace')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Состояние парка' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Последние события' })).toBeVisible();
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
});

test('кнопка мобильного меню имеет область не меньше 44 пикселей', async ({ page }) => {
  const menuButton = page.getByRole('button', { name: 'Открыть меню' });
  await expect(menuButton).toBeVisible();

  const box = await menuButton.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
});

test('общий drawer удерживает фокус, блокирует прокрутку и возвращает фокус', async ({ page }) => {
  const menuButton = page.getByRole('button', { name: 'Открыть меню' });
  await menuButton.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Мобильная навигация' });
  const closeButton = dialog.getByRole('button', { name: 'Закрыть меню' });
  const lastLink = dialog.getByRole('link', { name: 'Дизайн-система' });

  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

  await closeButton.press('Shift+Tab');
  await expect(lastLink).toBeFocused();
  await lastLink.press('Tab');
  await expect(closeButton).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(menuButton).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('мобильный drawer закрывается после выбора ссылки', async ({ page }) => {
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  const dialog = page.getByRole('dialog', { name: 'Мобильная навигация' });

  await dialog.getByRole('link', { name: 'Панель управления' }).click();
  await expect(dialog).toBeHidden();
});

test('мобильная оболочка не создаёт горизонтальное переполнение', async ({ page }) => {
  await page.getByRole('button', { name: 'Открыть меню' }).click();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
