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

test('все публичные размеры действий дают область касания не меньше 44 на 44 пикселя', async ({
  page,
}) => {
  await page.goto('/ui-kit');

  const publicSizes = ['xs', 'sm', 'md', 'lg'] as const;

  for (const component of ['button', 'icon-button'] as const) {
    for (const size of publicSizes) {
      const action = page.getByTestId(`${component}-size-${size}`);
      await expect(action).toBeVisible();

      const box = await action.boundingBox();
      expect(box, `${component} размера ${size} должен иметь область касания`).not.toBeNull();
      expect(box?.width, `${component} размера ${size}: ширина`).toBeGreaterThanOrEqual(44);
      expect(box?.height, `${component} размера ${size}: высота`).toBeGreaterThanOrEqual(44);
    }
  }
});
