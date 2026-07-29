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

  test('показывает цветной маршрут, события и воспроизведение', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedRoute(page, '/map');
    await page.getByRole('button', { name: /А 123 МР 77/i }).click();

    const trackSurface = page.getByTestId('vehicle-track-a11y');
    await expect(trackSurface).toHaveAttribute('data-track-date', '2026-07-29');
    await expect(trackSurface).toHaveAttribute('data-track-ready', 'true');
    await expectNoPageOverflow(page);
    await expect
      .poll(() => trackSurface.evaluate((element) => getComputedStyle(element).pointerEvents))
      .toBe('none');
    const trackSurfaceBox = await trackSurface.boundingBox();
    expect(trackSurfaceBox).not.toBeNull();
    expect(trackSurfaceBox!.width).toBeLessThanOrEqual(1);
    expect(trackSurfaceBox!.height).toBeLessThanOrEqual(1);

    const greenSegment = page.locator('[data-track-color="green"]').first();
    await expect(page.locator('[data-track-color="green"]')).toHaveCount(3);
    await expect(page.locator('[data-track-color="yellow"]')).toHaveCount(2);
    await expect(page.locator('[data-track-color="red"]')).toHaveCount(2);
    await expect
      .poll(() => greenSegment.evaluate((element) => getComputedStyle(element).opacity))
      .toBe('0.72');
    await expect(page.getByLabel('Начало маршрута')).toHaveCount(1);
    await expect(page.getByLabel('Конец маршрута')).toHaveCount(1);

    const refuelEvent = page.getByRole('button', { name: 'Событие: Заправка' });
    const refuelCoordinate = await refuelEvent.getAttribute('data-coordinate');
    expect(refuelCoordinate).not.toBeNull();
    await expect(
      page.locator(`[data-track-color][data-coordinate="${refuelCoordinate}"]`),
    ).toHaveCount(1);

    const firstSegment = page.getByRole('button', {
      name: 'Участок маршрута 08:00–08:08',
    });
    await firstSegment.dispatchEvent('mouseover');
    const segmentPopup = page.locator('.maplibregl-popup');
    await expect(segmentPopup.getByText('08:00–08:08')).toBeVisible();
    await expect(segmentPopup.getByText('Средняя скорость: 32 км/ч')).toBeVisible();
    await expect(segmentPopup.getByText('Красноярск, ул. Дубровинского')).toBeVisible();
    await firstSegment.dispatchEvent('mouseout');

    const playbackMarker = page.getByLabel('Положение автомобиля на маршруте');
    const initialPlaybackPoint = await playbackMarker.getAttribute('data-playback-point');
    await refuelEvent.focus();
    await refuelEvent.press('Enter');
    await expect(page.getByRole('article', { name: 'Событие: Заправка' })).toBeVisible();
    const playbackSlider = page.getByRole('slider', { name: 'Положение на маршруте' });
    await expect(playbackSlider).not.toHaveValue('0');
    await expect
      .poll(() => playbackMarker.getAttribute('data-playback-point'))
      .not.toBe(initialPlaybackPoint);

    const eventPlaybackPoint = await playbackMarker.getAttribute('data-playback-point');
    await page.getByRole('button', { name: 'Воспроизвести маршрут' }).click();
    await expect
      .poll(() => playbackMarker.getAttribute('data-playback-point'))
      .not.toBe(eventPlaybackPoint);

    await page.getByLabel('Дата маршрута').selectOption('2026-07-28');
    await expect(trackSurface).toHaveAttribute('data-track-date', '2026-07-28');

    await page.getByRole('button', { name: 'Закрыть карточку автомобиля' }).click();
    await expect(trackSurface).toHaveCount(0);
    await expect(page.locator('[data-track-color]')).toHaveCount(0);
    await expect(playbackMarker).toHaveCount(0);
  });

  test('все действия маршрута доступны с клавиатуры', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAuthenticatedRoute(page, '/map');

    const marker = page.getByRole('button', { name: /А 123 МР 77/i });
    await marker.focus();
    await marker.press('Enter');

    const trackSurface = page.getByTestId('vehicle-track-a11y');
    await expect(trackSurface).toHaveAttribute('data-track-ready', 'true');
    const playbackSlider = page.getByRole('slider', { name: 'Положение на маршруте' });

    const firstSegment = page.getByRole('button', {
      name: 'Участок маршрута 08:00–08:08',
    });
    await firstSegment.focus();
    const segmentPopup = page.locator('.maplibregl-popup');
    await expect(segmentPopup.getByText('08:00–08:08')).toBeVisible();
    await expect(segmentPopup.getByText('Средняя скорость: 32 км/ч')).toBeVisible();
    await expect(segmentPopup.getByText('Красноярск, ул. Дубровинского')).toBeVisible();

    const finish = page.getByRole('button', { name: 'Конец маршрута' });
    await finish.focus();
    await finish.press('Enter');
    await expect(playbackSlider).toHaveValue('100');

    const start = page.getByRole('button', { name: 'Начало маршрута' });
    await start.focus();
    await start.press('Enter');
    await expect(playbackSlider).toHaveValue('0');

    const event = page.getByRole('button', { name: 'Событие: Заправка' });
    await event.focus();
    await event.press('Enter');
    await expect(page.getByRole('article', { name: 'Событие: Заправка' })).toBeVisible();

    const date = page.getByLabel('Дата маршрута');
    await date.focus();
    await date.press('ArrowDown');
    await date.press('Enter');
    await expect(trackSurface).toHaveAttribute('data-track-date', '2026-07-28');

    const play = page.locator(
      'button[aria-label="Воспроизвести маршрут"], button[aria-label="Приостановить маршрут"]',
    );
    await play.focus();
    await play.press('Space');
    await expect(play).toHaveAttribute('aria-label', 'Приостановить маршрут');

    const close = page.getByRole('button', { name: 'Закрыть карточку автомобиля' });
    await close.focus();
    await close.press('Enter');
    await expect(trackSurface).toHaveCount(0);
  });

  for (const viewport of [
    { name: 'телефоне 390×844', width: 390, height: 844 },
    { name: 'планшете 1024×768', width: 1024, height: 768 },
  ]) {
    test(`маршрут не создаёт горизонтальную прокрутку на ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openAuthenticatedRoute(page, '/map');
      await page.getByRole('button', { name: /А 123 МР 77/i }).press('Enter');

      await expect(page.getByTestId('vehicle-track-a11y')).toHaveAttribute(
        'data-track-ready',
        'true',
      );
      await expectNoPageOverflow(page);
    });
  }

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

    await page.getByRole('button', { name: 'Закрыть карточку автомобиля' }).tap();
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
