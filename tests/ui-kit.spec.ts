import { expect, test } from '@playwright/test';

test('UI Kit is reachable from the application', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Дизайн-система' }).click();
  await expect(page).toHaveURL(/\/ui-kit$/);
  await expect(page.getByRole('heading', { name: 'Pilot+ UI Kit', level: 1 })).toBeVisible();
});

test('theme and action primitives expose accessible states', async ({ page }) => {
  await page.goto('/ui-kit');
  await expect(page.getByTestId('button-primary')).toBeVisible();
  await expect(page.getByTestId('button-loading')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByTestId('button-disabled')).toBeDisabled();

  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
