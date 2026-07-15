import { expect, test } from '@playwright/test';

test('настольная оболочка показывает постоянную навигацию', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Дизайн-система' })).toBeVisible();
});

test('мобильная оболочка открывает drawer с клавиатуры без горизонтального переполнения', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const menuButton = page.getByRole('button', { name: 'Открыть меню' });
  await expect(menuButton).toBeVisible();
  await menuButton.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Мобильная навигация' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Дизайн-система' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Мобильная навигация' })).toBeHidden();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
