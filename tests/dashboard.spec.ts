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

test('мобильная панель управления является полноэкранным рабочим пространством карты', async ({
  page,
}) => {
  const workspace = page.getByTestId('mobile-map-workspace');
  await expect(workspace).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Поиск транспорта' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Все автомобили' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('vehicle-bottom-sheet')).toBeVisible();
  const box = await workspace.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(600);
});

test('нижняя панель имеет три различимые высоты и доступные элементы управления', async ({
  page,
}) => {
  const sheet = page.getByTestId('vehicle-bottom-sheet');
  const snapButtons = page.getByRole('group', { name: 'Положение нижней панели' }).getByRole('button');
  const heights: number[] = [];

  for (const name of ['Свернуть панель', 'Открыть панель наполовину', 'Развернуть панель']) {
    const button = page.getByRole('button', { name });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    heights.push((await sheet.boundingBox())?.height ?? 0);
  }

  expect(heights[0]).toBeLessThan(heights[1]);
  expect(heights[1]).toBeLessThan(heights[2]);
  for (const button of await snapButtons.all()) {
    const box = await button.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('фильтры и поиск меняют набор транспорта на карте', async ({ page }) => {
  const movingFilter = page.getByRole('button', { name: 'В движении' });
  await movingFilter.click();
  await expect(movingFilter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Все автомобили' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: 'Выбрать Haval Jolion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выбрать Geely Atlas' })).toHaveCount(0);

  await page.getByRole('searchbox', { name: 'Поиск транспорта' }).fill('несуществующий');
  await expect(page.getByText('На карте пока нет транспорта')).toBeVisible();
});

test('карта сохраняет canvas и атрибуцию после изменения viewport', async ({ page }) => {
  const workspace = page.getByTestId('mobile-map-workspace');
  const map = workspace.getByLabel('Карта автопарка');
  await expect(map.locator('canvas')).toBeVisible();
  await expect(workspace.getByText('OpenStreetMap', { exact: false })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const mapBox = await workspace.boundingBox();
      const canvasBox = await map.locator('canvas').boundingBox();
      return {
        sameWidth: Math.round(canvasBox?.width ?? 0) === Math.round(mapBox?.width ?? 0),
        sameHeight: Math.round(canvasBox?.height ?? 0) === Math.round(mapBox?.height ?? 0),
        hasSize: (mapBox?.width ?? 0) > 0 && (mapBox?.height ?? 0) > 600,
      };
    })
    .toEqual({ sameWidth: true, sameHeight: true, hasSize: true });
});
