import { expect, test } from '@playwright/test';

test('дизайн-система показывает все утверждённые разделы', async ({ page }) => {
  await page.goto('/ui-kit');
  for (const [id, name] of [
    ['foundations', 'Основы'],
    ['actions', 'Действия'],
    ['forms', 'Формы'],
    ['data-display', 'Отображение данных'],
    ['navigation', 'Навигация'],
    ['feedback', 'Обратная связь'],
    ['overlays', 'Всплывающие слои'],
    ['fleet-components', 'Компоненты автопарка'],
  ] as const) {
    const section = page.getByTestId(`ui-kit-${id}`);
    await expect(section).toBeVisible();
    await expect(section.getByRole('heading', { name, level: 2 })).toBeVisible();
  }

  for (const id of ['actions', 'navigation', 'feedback', 'overlays'] as const) {
    const section = page.getByTestId(`ui-kit-${id}`);
    await expect(section.getByText('Когда использовать:', { exact: false })).toBeVisible();
    await expect(section.getByText('Не использовать:', { exact: false })).toBeVisible();
  }
});

test('UI Kit is reachable from the application', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Дизайн-система' }).click();
  await expect(page).toHaveURL(/\/ui-kit$/);
  await expect(page.getByRole('heading', { name: 'Дизайн-система Pilot+', level: 1 })).toBeVisible();
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

test('overlays and form controls are keyboard accessible', async ({ page }) => {
  await page.goto('/ui-kit');
  const opener = page.getByRole('button', { name: 'Открыть окно' });
  await opener.click();
  await expect(page.getByRole('dialog', { name: 'Пример окна' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

  const dialog = page.getByRole('dialog', { name: 'Пример окна' });
  await expect(dialog).toHaveAttribute('data-testid');
  const firstAction = dialog.getByRole('button').first();
  const lastAction = dialog.getByRole('button').last();
  await expect(firstAction).toBeFocused();
  await dialog.getByRole('button', { name: 'Перерисовать пример' }).click();
  await expect(dialog.getByRole('button', { name: 'Перерисовать пример' })).toBeFocused();
  await lastAction.focus();
  await page.keyboard.press('Tab');
  await expect(firstAction).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(lastAction).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  const vehicleName = page.getByLabel('Название автомобиля');
  await expect(vehicleName).toBeVisible();
  await expect(vehicleName).toHaveAttribute('aria-invalid', 'true');
  await expect(vehicleName).toHaveAttribute('aria-describedby', /hint.*error|error.*hint/);
  await expect(page.getByRole('switch', { name: 'Только онлайн' })).toBeVisible();
  await expect(page.getByRole('searchbox')).toBeVisible();
});

test('scroll lock remains active while another overlay is open', async ({ page }) => {
  await page.goto('/ui-kit');
  await page.getByRole('button', { name: 'Открыть два окна' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.getByRole('dialog').last().getByRole('button', { name: 'Закрыть' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
});

test('tabs, tooltip and bottom sheet expose complete keyboard contracts', async ({ page }) => {
  await page.goto('/ui-kit');

  const selectedTab = page.getByRole('tab', { selected: true });
  await selectedTab.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab').last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab').first()).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab').nth(1)).toBeFocused();

  const tooltipTrigger = page.getByRole('button', { name: 'Подсказка' });
  await expect(tooltipTrigger).toHaveAttribute('aria-describedby');

  await page.getByRole('button', { name: 'Открыть нижнюю панель' }).click();
  const sheet = page.getByRole('dialog', { name: 'Пример нижней панели' });
  await sheet.getByRole('button', { name: 'Развернуть' }).click();
  await expect(sheet).toHaveAttribute('data-snap', 'expanded');

  for (const action of await sheet.getByRole('button').all()) {
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
