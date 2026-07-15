import { expect, test } from '@playwright/test';

test('UI Kit is reachable from the application', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Дизайн-система' }).click();
  await expect(page).toHaveURL(/\/ui-kit$/);
  await expect(page.getByRole('heading', { name: 'Pilot+ UI Kit', level: 1 })).toBeVisible();
});
