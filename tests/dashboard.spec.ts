import { expect, test, type Page } from '@playwright/test';

async function openAuthenticatedDashboard(page: Page) {
  await page.goto('/');

  if (new URL(page.url()).pathname !== '/login') return;

  const email = process.env.PILOT_ADMIN_EMAIL;
  const password = process.env.PILOT_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Для проверки защищённого дашборда нужны PILOT_ADMIN_EMAIL и PILOT_ADMIN_PASSWORD',
    );
  }

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL('/');
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openAuthenticatedDashboard(page);
});

test('настольная оболочка показывает постоянную навигацию', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Дизайн-система' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Сегодня, 19 июл' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Фильтры' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Настроить вид' })).toBeVisible();
});

test('настольная навигация раскрывается и сохраняет состояние', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const shell = page.getByTestId('app-shell');
  const sidebar = page.getByTestId('desktop-sidebar');
  const toggle = page.getByRole('button', { name: 'Свернуть навигацию' });

  await expect(sidebar).toHaveCSS('width', '228px');
  await toggle.click();
  await expect(shell).toHaveAttribute('data-sidebar-expanded', 'false');
  await expect(sidebar).toHaveCSS('width', '72px');
  await expect(page.getByRole('button', { name: 'Развернуть навигацию' })).toBeVisible();

  await page.reload();
  await expect(shell).toHaveAttribute('data-sidebar-expanded', 'false');
  await expect(sidebar).toHaveCSS('width', '72px');
});

test('настольная навигация остаётся раскрытой при запрещённом localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Доступ запрещён', 'SecurityError');
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const shell = page.getByTestId('app-shell');
  await expect(shell).toHaveAttribute('data-sidebar-expanded', 'true');
  await page.getByRole('button', { name: 'Свернуть навигацию' }).click();
  await expect(shell).toHaveAttribute('data-sidebar-expanded', 'true');
});

test('раскрытие навигации не ломает карту', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const map = page.getByTestId('fleet-map-workspace');
  const before = await map.boundingBox();

  await page.getByRole('button', { name: 'Свернуть навигацию' }).click();
  await expect
    .poll(async () => (await map.boundingBox())?.width ?? 0)
    .toBeGreaterThan(before?.width ?? 0);
  await expect(map.getByLabel('Карта автопарка').locator('canvas')).toBeVisible();
  await expect(map.getByText('OpenStreetMap', { exact: false })).toBeVisible();
});

test('перетаскивание ручки меняет положение нижней панели', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const sheet = page.getByTestId('vehicle-bottom-sheet');
  const handle = page.getByTestId('vehicle-sheet-handle');
  const box = await handle.boundingBox();
  if (!box) throw new Error('Ручка панели не найдена');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, 180, { steps: 8 });
  await page.mouse.up();
  await expect(sheet).toHaveAttribute('data-snap', 'expanded');
});

test('настольная панель управления отдаёт приоритет карте автопарка', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Панель управления' })).toBeVisible();
  await expect(page.getByTestId('fleet-map-workspace')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Последние события' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Пробег по дням' })).toBeVisible();
  await expect(
    page.getByTestId('fleet-map-workspace').getByText('OpenStreetMap', { exact: false }),
  ).toBeVisible();
});

test('настольная панель использует плотную сетку Mosaic', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Панель управления' })).toHaveCSS(
    'font-size',
    '24px',
  );
  await expect(page.getByTestId('fleet-stat-total')).toHaveCSS('border-radius', '12px');

  const map = await page.getByTestId('fleet-map-workspace').boundingBox();
  const status = await page.getByTestId('dashboard-events').boundingBox();
  expect((map?.width ?? 0) / (status?.width ?? 1)).toBeGreaterThan(1.7);
});

test('рабочая панель использует общие семантические компоненты автопарка', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(
    page.getByRole('listitem', { name: 'Превышение скорости, Haval Jolion' }),
  ).toHaveAttribute('data-tone', 'danger');
});

test('настольная карта остаётся крупнейшей рабочей областью', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');

  const map = await page.getByTestId('fleet-map-workspace').boundingBox();
  const status = await page.getByTestId('dashboard-events').boundingBox();
  expect((map?.width ?? 0) * (map?.height ?? 0)).toBeGreaterThan(
    (status?.width ?? 0) * (status?.height ?? 0),
  );
});

test('настольный дашборд соответствует утверждённой аналитической композиции', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAuthenticatedDashboard(page);

  const dashboard = page.getByTestId('dashboard-desktop');
  await expect(dashboard).toBeVisible();
  await expect(dashboard.getByTestId(/^fleet-stat-/)).toHaveCount(6);
  await expect(dashboard.getByRole('heading', { name: 'Карта транспорта' })).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: 'Последние события' })).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: 'Пробег по дням' })).toBeVisible();
  await expect(dashboard.getByRole('heading', { name: 'Расход топлива' })).toBeVisible();

  const map = await dashboard.getByTestId('fleet-map-workspace').boundingBox();
  const analytics = await dashboard.getByTestId('dashboard-analytics').boundingBox();
  expect((map?.width ?? 0) * (map?.height ?? 0)).toBeGreaterThan(
    (analytics?.width ?? 0) * (analytics?.height ?? 0),
  );
});

test('кнопка мобильного меню имеет область не меньше 44 пикселей', async ({ page }) => {
  const menuButton = page.getByRole('button', { name: 'Открыть меню' });
  await expect(menuButton).toBeVisible();

  const box = await menuButton.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
});

test('мобильная оболочка показывает прокручиваемые хлебные крошки', async ({ page }) => {
  const breadcrumbs = page.getByTestId('mobile-breadcrumbs');

  await expect(breadcrumbs).toBeVisible();
  await expect(breadcrumbs.getByRole('navigation', { name: 'Хлебные крошки' })).toContainText(
    'Панель управления',
  );
  await expect(breadcrumbs).toHaveCSS('overflow-x', 'auto');
  expect(await breadcrumbs.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
    true,
  );
  await breadcrumbs.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
  await expect.poll(() => breadcrumbs.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});

test('глобальная клавиша T переключает тему, но не срабатывает во время ввода', async ({
  page,
}) => {
  await page.keyboard.press('t');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const search = page.getByRole('searchbox', { name: 'Поиск транспорта' });
  await search.focus();
  await page.keyboard.press('t');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(search).toHaveValue('t');
});

test('мобильные плавающие элементы управления доступны с клавиатуры и в тёмной теме', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const search = page.getByRole('searchbox', { name: 'Поиск транспорта' });
  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Все автомобили' })).toBeFocused();
});

test('общий drawer удерживает фокус, блокирует прокрутку и возвращает фокус', async ({ page }) => {
  const menuButton = page.getByRole('button', { name: 'Открыть меню' });
  await menuButton.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Мобильная навигация' });
  const closeButton = dialog.getByRole('button', { name: 'Закрыть меню' });
  const lastLink = dialog.getByRole('link', { name: 'Открыть профиль' });

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

test('мобильная карта использует плавающие поверхности Mosaic', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const search = page.getByRole('searchbox', { name: 'Поиск транспорта' });
  await expect(search).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(search).toHaveCSS('border-radius', '8px');

  const sheet = page.getByTestId('vehicle-bottom-sheet');
  await expect(sheet).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(sheet).toHaveCSS('border-top-left-radius', '16px');
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
  const snapButtons = page
    .getByRole('group', { name: 'Положение нижней панели' })
    .getByRole('button');
  const heights: number[] = [];

  for (const [name, minimumHeight] of [
    ['Свернуть панель', 200],
    ['Открыть панель наполовину', 450],
    ['Развернуть панель', 700],
  ] as const) {
    const button = page.getByRole('button', { name });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => (await sheet.boundingBox())?.height ?? 0)
      .toBeGreaterThan(minimumHeight);
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
  const sheet = page.getByTestId('vehicle-bottom-sheet');
  await page.getByRole('button', { name: 'Выбрать Geely Atlas' }).click();
  await expect(sheet.getByRole('heading', { name: 'Geely Atlas' })).toBeVisible();

  const movingFilter = page.getByRole('button', { name: 'В движении' });
  await movingFilter.click();
  await expect(movingFilter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Все автомобили' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: 'Выбрать Haval Jolion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выбрать Geely Atlas' })).toHaveCount(0);
  await expect(sheet.getByRole('heading', { name: 'Haval Jolion' })).toBeVisible();

  await page.getByRole('button', { name: 'Все автомобили' }).click();
  await page.getByRole('button', { name: 'Выбрать Geely Atlas' }).click();
  await page.getByRole('searchbox', { name: 'Поиск транспорта' }).fill('Haval');
  await expect(sheet.getByRole('heading', { name: 'Haval Jolion' })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Поиск транспорта' }).fill('несуществующий');
  await expect(page.getByText('На карте пока нет транспорта')).toBeVisible();
  await expect(sheet.getByText('Транспорт не найден')).toBeVisible();
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
