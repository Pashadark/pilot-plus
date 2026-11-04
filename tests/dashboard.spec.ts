import { expect, test, type Locator, type Page } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

async function expectNavigationLabelFits(link: Locator, label: string) {
  const container = link.locator('[data-navigation-label="true"]');
  await expect(container).toBeVisible();
  await expect(container).toHaveText(label);
  await expect
    .poll(() => container.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
}

async function openDashboard(page: Page) {
  await openAuthenticatedRoute(page, '/');
  await expect(page.getByRole('heading', { name: 'Командный центр' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openDashboard(page);
});

test('настольная оболочка показывает постоянную навигацию', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
  await expectNavigationLabelFits(
    page.getByRole('link', { name: 'Техническое обслуживание' }),
    'Техническое обслуживание',
  );
  await expectNavigationLabelFits(page.getByRole('link', { name: 'Мойка' }), 'Мойка');
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Глобальный поиск' })).toBeVisible();
});

test('настольная навигация сворачивается и сохраняет состояние', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const shell = page.getByTestId('app-shell');
  const sidebar = page.getByTestId('desktop-sidebar');
  await page.getByRole('button', { name: 'Свернуть навигацию' }).click();
  await expect(shell).toHaveAttribute('data-sidebar-expanded', 'false');
  await expect(sidebar).toHaveCSS('width', '72px');
  await page.reload();
  await expect(shell).toHaveAttribute('data-sidebar-expanded', 'false');
});

test('командный центр показывает деньги, парк и рабочие приоритеты', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const kpis = page.getByRole('region', { name: 'Показатели автопарка' });
  await expect(kpis).toContainText('Москва · погода');
  await expect(kpis).toContainText('Заработано за всё время');
  await expect(kpis).toContainText('Депозиты по договорам');
  await expect(kpis).toContainText('Свободно');
  await expect(kpis).toContainText('В аренде');
  await expect(kpis).toContainText('ТО и мойка');
  await expect(kpis).toContainText('Нет GPS-связи');
  await expect(page.getByRole('heading', { name: 'Рабочий день' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Требует внимания' })).toBeVisible();
});

test('быстрые периоды и календарь управляют выбранным рабочим днём', async ({ page }) => {
  const periods = page.getByRole('navigation', { name: 'Период командного центра' });
  await expect(periods.getByRole('link', { name: 'Сегодня', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(periods.getByRole('link', { name: 'Завтра', exact: true })).toHaveAttribute(
    'href',
    '/?period=tomorrow',
  );

  await page.getByRole('button', { name: 'Выбрать дату или период' }).click();
  const dialog = page.getByRole('dialog', { name: 'Выбор даты командного центра' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Дата').fill('2026-08-27');
  await dialog.getByRole('button', { name: 'Показать' }).click();
  await expect(page).toHaveURL(/from=2026-08-27/);
});

test('быстрые действия ведут в рабочие разделы', async ({ page }) => {
  const actions = page.locator('[aria-label="Быстрые действия"]');
  await expect(actions.getByRole('link', { name: 'Новая аренда' })).toHaveAttribute(
    'href',
    '/rentals/new',
  );
  await expect(actions.getByRole('link', { name: 'Поставить на ТО' })).toHaveAttribute(
    'href',
    '/maintenance',
  );
  await expect(actions.getByRole('link', { name: 'Отправить на мойку' })).toHaveAttribute(
    'href',
    '/wash',
  );
});

test('пункты мобильного дока имеют область не меньше 44 пикселей', async ({ page }) => {
  const dock = page.getByRole('navigation', { name: 'Мобильная навигация' });
  await expect(dock).toBeVisible();
  for (const item of await dock.locator('.mobile-dock__item').all()) {
    const box = await item.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('панель Ещё удерживает фокус и возвращает его кнопке', async ({ page }) => {
  const menuButton = page.getByRole('button', { name: 'Ещё', exact: true });
  await menuButton.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Все разделы' });
  const closeButton = dialog.getByRole('button', { name: 'Закрыть меню' });

  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(menuButton).toBeFocused();
});

test('мобильный командный центр не создаёт горизонтальное переполнение', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Рабочий день' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
