import { expect, test, type Page } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    innerHeight: window.innerHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.innerHeight);
}

test.describe('онлайн-карта', () => {
  test('показывает пять тестовых автомобилей', async ({ page }) => {
    await openAuthenticatedRoute(page, '/map');

    await expect(page.getByRole('heading', { name: 'Онлайн-карта' })).toBeVisible();
    await expect(page.getByText('Демонстрационные данные')).toBeVisible();

    const markers = page.getByRole('button', { name: /Выбрать автомобиль/ });
    await expect(markers).toHaveCount(5);
    await expect(page.getByRole('button', { name: /А 123 МР 77/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /М 333 АХ 750/ })).toBeVisible();
  });

  test('поддерживает hover, focus, выбор, поиск и пустое состояние на desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedRoute(page, '/map');

    const havalMarker = page.getByRole('button', { name: /В 456 КХ 178/ });
    await havalMarker.hover();
    await expect(havalMarker.getByText(/Haval Jolion · На стоянке/)).toBeVisible();

    const geelyMarker = page.getByRole('button', { name: /Е 789 НО 77/ });
    await geelyMarker.focus();
    await expect(geelyMarker).toBeFocused();
    await expect(geelyMarker.getByText(/Geely Atlas · В движении/)).toBeVisible();

    await havalMarker.click();
    const selectedPanel = page.getByRole('complementary', { name: 'Выбранный автомобиль' });
    await expect(selectedPanel.getByRole('heading', { name: 'Haval Jolion' })).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Поиск транспорта' });
    await search.fill('м333ах750');
    await expect(page.getByRole('button', { name: /Выбрать автомобиль/ })).toHaveCount(1);
    await expect(selectedPanel.getByRole('heading', { name: 'Changan UNI-K' })).toBeVisible();

    await search.fill('Р 999 РР 24');
    await expect(page.getByText('По запросу ничего не найдено')).toBeVisible();
    await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
    await expect(page.getByRole('button', { name: /Выбрать автомобиль/ })).toHaveCount(5);
  });

  test('показывает нижнюю панель на телефоне 390×844 без переполнения', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAuthenticatedRoute(page, '/map');

    const selectedPanel = page.getByRole('complementary', { name: 'Выбранный автомобиль' });
    await expect(selectedPanel).toBeVisible();

    const panelBox = await selectedPanel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.width).toBeLessThanOrEqual(390);
    expect(panelBox!.y).toBeGreaterThan(844 / 2);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(844);

    await expectNoPageOverflow(page);
  });

  test('не создаёт прокрутку на низком desktop-экране', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await openAuthenticatedRoute(page, '/map');

    await expect(page.getByRole('region', { name: 'Онлайн-карта транспорта' })).toBeVisible();
    await expectNoPageOverflow(page);
  });
});
