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

async function expectElementsDoNotOverlap(
  first: ReturnType<Page['locator']>,
  second: ReturnType<Page['locator']>,
) {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();

  const overlap =
    firstBox!.x < secondBox!.x + secondBox!.width &&
    firstBox!.x + firstBox!.width > secondBox!.x &&
    firstBox!.y < secondBox!.y + secondBox!.height &&
    firstBox!.y + firstBox!.height > secondBox!.y;
  expect(overlap).toBe(false);
}

test.describe('онлайн-карта', () => {
  test('перенаправляет анонимного пользователя на вход', async ({ page }) => {
    await page.goto('/map');

    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Вход в Pilot+' })).toBeVisible();
  });

  test('показывает пять тестовых автомобилей', async ({ page }) => {
    await openAuthenticatedRoute(page, '/map');

    await expect(page).toHaveTitle('Онлайн-карта | Pilot+');
    await expect(page.getByRole('heading', { name: 'Онлайн-карта' })).toBeVisible();
    await expect(page.getByText('Демонстрационные данные')).toBeVisible();

    const markers = page.getByRole('button', { name: /Выбрать автомобиль/ });
    await expect(markers).toHaveCount(5);
    for (const plate of [
      'А 123 МР 77',
      'В 456 КХ 178',
      'Е 789 НО 77',
      'К 111 МР 199',
      'М 333 АХ 750',
    ]) {
      await expect(page.getByRole('button', { name: new RegExp(plate) })).toBeVisible();
    }
  });

  test('поддерживает полную hover-карточку, focus и выбор на desktop', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Hover/focus preview проверяется на desktop.');
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedRoute(page, '/map');

    const havalMarker = page.getByRole('button', { name: /В 456 КХ 178/ });
    await havalMarker.hover();
    await expect(havalMarker.getByText(/Haval Jolion · На стоянке/)).toBeVisible();
    await expect(havalMarker.getByText('Скорость: 0 км/ч')).toBeVisible();
    await expect(havalMarker.getByText('Топливо: 58%')).toBeVisible();
    await expect(havalMarker.getByText('Последний сигнал: 3 минуты назад')).toBeVisible();

    const geelyMarker = page.getByRole('button', { name: /Е 789 НО 77/ });
    await geelyMarker.focus();
    await expect(geelyMarker).toBeFocused();
    await expect(geelyMarker.getByText(/Geely Atlas · В движении/)).toBeVisible();

    await havalMarker.click();
    const selectedPanel = page.getByRole('complementary', { name: 'Выбранный автомобиль' });
    await expect(selectedPanel.getByRole('heading', { name: 'Haval Jolion' })).toBeVisible();
  });

  test('ищет по модели, проверяет статусы и пустое состояние', async ({ page }) => {
    await openAuthenticatedRoute(page, '/map');

    const search = page.getByRole('searchbox', { name: 'Поиск транспорта' });
    await expect(search).toHaveAttribute('placeholder', 'Поиск по модели или госномеру');
    await search.fill('Changan UNI-K');
    await expect(page.getByRole('button', { name: /Выбрать автомобиль/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /М 333 АХ 750/ })).toBeVisible();

    await search.fill('');
    await page.getByRole('button', { name: 'В движении' }).click();
    await expect(page.getByRole('button', { name: /Выбрать автомобиль/ })).toHaveCount(2);
    await page.getByRole('button', { name: 'На стоянке' }).click();
    await expect(page.getByRole('button', { name: /Выбрать автомобиль/ })).toHaveCount(2);
    await page.getByRole('button', { name: 'Нет связи' }).click();
    await expect(page.getByRole('button', { name: /Выбрать автомобиль/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /К 111 МР 199/ })).toBeVisible();

    await search.fill('Р 999 РР 24');
    await expect(page.getByText('По запросу ничего не найдено')).toBeVisible();
    await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
    await expect(page.getByRole('button', { name: /Выбрать автомобиль/ })).toHaveCount(5);
  });

  test('на телефоне ждёт tap, закрывает панель в null и не показывает desktop preview', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Touch-поведение проверяется в mobile project.');
    await page.setViewportSize({ width: 390, height: 844 });
    await openAuthenticatedRoute(page, '/map');

    await expect(page.getByRole('complementary', { name: 'Выбранный автомобиль' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '© OpenStreetMap' })).toBeVisible();

    const havalMarker = page.getByRole('button', { name: /В 456 КХ 178/ });
    await expect(havalMarker.getByText(/Haval Jolion · На стоянке/)).toBeHidden();
    await havalMarker.tap();

    const selectedPanel = page.getByRole('complementary', { name: 'Выбранный автомобиль' });
    await expect(selectedPanel).toBeVisible();
    await expect(selectedPanel.getByRole('heading', { name: 'Haval Jolion' })).toBeVisible();
    await expect(havalMarker.getByText(/Haval Jolion · На стоянке/)).toBeHidden();

    const panelBox = await selectedPanel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.width).toBeLessThanOrEqual(390);
    expect(panelBox!.y).toBeGreaterThan(844 / 2);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(844);

    await page.getByRole('button', { name: 'Закрыть панель автомобиля' }).tap();
    await expect(selectedPanel).toHaveCount(0);
    await expect(havalMarker).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('link', { name: '© OpenStreetMap' })).toBeVisible();

    await expectNoPageOverflow(page);
  });

  test('не создаёт прокрутку на низком desktop-экране', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Низкий desktop viewport проверяется отдельно.');
    await page.setViewportSize({ width: 1280, height: 600 });
    await openAuthenticatedRoute(page, '/map');

    await expect(page.getByRole('region', { name: 'Онлайн-карта транспорта' })).toBeVisible();
    await expectNoPageOverflow(page);
  });

  test('использует русские MapLibre labels и последовательный Tab без перехвата canvas', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Клавиатурный порядок проверяется на desktop.');
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedRoute(page, '/map');

    const canvas = page.locator('canvas.maplibregl-canvas');
    await expect(canvas).toHaveAttribute('aria-label', 'Интерактивная карта автопарка');
    await expect(canvas).toHaveAttribute('tabindex', '-1');
    await expect(page.getByRole('button', { name: 'Увеличить масштаб' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Уменьшить масштаб' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Повернуть карту или вернуть север наверх' }),
    ).toBeVisible();

    const markerWrapper = page.locator('.maplibregl-marker').first();
    await expect(markerWrapper).not.toHaveAttribute('role', 'button');
    await expect(markerWrapper).not.toHaveAttribute('aria-label', 'Map marker');

    const search = page.getByRole('searchbox', { name: 'Поиск транспорта' });
    await search.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Все' })).toBeFocused();
    for (const label of ['В движении', 'На стоянке', 'Нет связи']) {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: label })).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /А 123 МР 77/ })).toBeFocused();
    await expect(canvas).not.toBeFocused();

    await canvas.click({ position: { x: 300, y: 300 } });
    await expect(canvas).toHaveAttribute('tabindex', '0');
    await expect(canvas).toBeFocused();
  });

  for (const viewport of [
    { name: 'landscape 844×390', width: 844, height: 390 },
    { name: 'intermediate tablet 1024×768', width: 1024, height: 768 },
  ]) {
    test(`не пересекает controls и panel на ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openAuthenticatedRoute(page, '/map');

      await page.getByRole('button', { name: /В 456 КХ 178/ }).press('Enter');
      const controls = page.getByTestId('online-map-controls');
      const panel = page.getByRole('complementary', { name: 'Выбранный автомобиль' });
      await expect(controls).toBeVisible();
      await expect(panel).toBeVisible();
      await expectElementsDoNotOverlap(controls, panel);
      await expectNoPageOverflow(page);
    });
  }
});
