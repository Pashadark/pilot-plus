import { expect, test, type Page } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

test.beforeEach(async ({ page }) => {
  await openAuthenticatedRoute(page, '/ui-kit');
});

async function enableDarkTheme(page: Page) {
  await page.evaluate(() => localStorage.setItem('pilot-theme', 'dark'));
  await page.reload();
}

test('витрина запускает четыре типа системных уведомлений', async ({ page }) => {
  for (const [button, title] of [
    ['Показать успех', 'Операция выполнена'],
    ['Показать предупреждение', 'Требуется внимание'],
    ['Показать ошибку', 'Произошла ошибка'],
    ['Показать информацию', 'Новая информация'],
  ] as const) {
    await page.getByRole('button', { name: button }).click();
    await expect(page.getByText(title)).toBeVisible();
  }

  const danger = page.locator('[data-toast-tone="danger"]');
  const close = danger.getByRole('button', { name: 'Закрыть уведомление' });
  await close.focus();
  await page.keyboard.press('Enter');
  await expect(danger).toBeHidden();
});

test('светлая тема использует визуальные токены Mosaic', async ({ page }) => {
  await page.goto('/ui-kit');
  await page.evaluate(() => localStorage.setItem('pilot-theme', 'light'));
  await page.reload();

  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(243, 244, 246)');
  await expect(page.locator('body')).toHaveCSS('font-family', /Inter/);

  const primary = page.getByTestId('button-primary');
  await expect(primary).toHaveCSS('background-color', 'rgb(37, 99, 235)');
  await expect(primary).toHaveCSS('border-radius', '8px');

  const card = page.getByTestId('showcase-card');
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(card).toHaveCSS('border-radius', '12px');
});

test('каталог сохраняет плотность Mosaic на телефоне', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/ui-kit');
  await expect(page.getByRole('heading', { name: 'Дизайн-система Pilot+' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

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

test('дизайн-система доступна из приложения', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Дизайн-система' }).click();
  await expect(page).toHaveURL(/\/ui-kit$/);
  await expect(
    page.getByRole('heading', { name: 'Дизайн-система Pilot+', level: 1 }),
  ).toBeVisible();
});

test('тема и примитивы действий публикуют доступные состояния', async ({ page }) => {
  await page.goto('/ui-kit');
  await expect(page.getByTestId('button-primary')).toBeVisible();
  await expect(page.getByTestId('button-loading')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByTestId('button-disabled')).toBeDisabled();

  await enableDarkTheme(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('тёмная тема применяется ко всем маршрутам и сохраняет читаемые поверхности', async ({
  page,
}) => {
  await page.goto('/ui-kit');
  await enableDarkTheme(page);

  for (const route of ['/', '/ui-kit']) {
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(249, 250, 251)');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 24, 39)');
  }
});

const responsiveViewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 1000 },
] as const;

for (const { viewport, theme } of responsiveViewports.flatMap((viewport) =>
  (['light', 'dark'] as const).map((theme) => ({ viewport, theme })),
)) {
  test(`маршруты используют ${theme} тему без горизонтального переполнения при ширине ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/ui-kit');
    if (theme === 'dark') await enableDarkTheme(page);
    for (const route of ['/', '/ui-kit']) {
      await page.goto(route);
      await expect(page.locator('body')).toHaveCSS(
        'background-color',
        theme === 'light' ? 'rgb(243, 244, 246)' : 'rgb(17, 24, 39)',
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `${route} при ширине ${viewport.width}px`).toBe(false);
    }
  });
}

test('режим уменьшенного движения отключает обычные переходы', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ui-kit');
  const duration = await page
    .getByTestId('button-primary')
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(['0s', '0.00001s', '1e-05s']).toContain(duration);
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

test('всплывающие слои и поля доступны с клавиатуры', async ({ page }) => {
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
  await expect(page.getByRole('searchbox', { name: 'Поиск компонентов' })).toBeVisible();
});

test('блокировка прокрутки сохраняется пока открыт другой слой', async ({ page }) => {
  await page.goto('/ui-kit');
  await page.getByRole('button', { name: 'Открыть два окна' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.getByRole('dialog').last().getByRole('button', { name: 'Закрыть' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
});

test('Escape и удержание фокуса принадлежат только верхнему всплывающему слою', async ({
  page,
}) => {
  await page.goto('/ui-kit');
  const opener = page.getByRole('button', { name: 'Открыть два окна' });
  await opener.click();
  const first = page.getByRole('dialog', { name: 'Первое окно' });
  const second = page.getByRole('dialog', { name: 'Второе окно' });
  await expect(second.getByRole('button', { name: 'Закрыть' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(second).toBeHidden();
  await expect(first).toBeVisible();
  await expect(first.getByRole('button', { name: 'Закрыть' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first.getByRole('button', { name: 'Закрыть' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(first).toBeHidden();
  await expect(opener).toBeFocused();
});

test('вкладки, подсказка и нижняя панель имеют полные клавиатурные контракты', async ({ page }) => {
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

test('витрина исполняет полный каталог утверждённых компонентов', async ({ page }) => {
  await page.goto('/ui-kit');
  for (const id of [
    'textarea',
    'radio',
    'avatar',
    'list-item',
    'table',
    'progress',
    'toast',
    'popover',
    'confirmation-dialog',
    'drawer',
    'stat-card',
    'status-indicator',
    'vehicle-plate',
    'vehicle-marker',
    'speed-indicator',
    'connection-status',
    'event-item',
  ])
    await expect(page.getByTestId(`showcase-${id}`)).toBeVisible();
});

test('витрина исполняет диалог подтверждения и боковую панель', async ({ page }) => {
  await page.goto('/ui-kit');

  const confirmationTrigger = page.getByRole('button', { name: 'Подтвердить удаление' });
  await confirmationTrigger.click();
  const confirmation = page.getByRole('dialog', { name: 'Удалить автомобиль?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole('button', { name: 'Подтвердить' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirmation).toBeHidden();
  await expect(confirmationTrigger).toBeFocused();

  const drawerTrigger = page.getByRole('button', { name: 'Открыть боковую панель' });
  await drawerTrigger.click();
  const drawer = page.getByRole('dialog', { name: 'Параметры автомобиля' });
  await expect(drawer).toBeVisible();
  const drawerBox = await drawer.boundingBox();
  expect(
    Math.abs((drawerBox?.x ?? 0) + (drawerBox?.width ?? 0) - page.viewportSize()!.width),
  ).toBeLessThanOrEqual(16);
  await drawer.getByRole('button', { name: 'Закрыть панель' }).click();
  await expect(drawer).toBeHidden();
  await expect(drawerTrigger).toBeFocused();
});

test('витрина исполняет семантические компоненты автопарка', async ({ page }) => {
  await page.goto('/ui-kit');

  await expect(
    page.getByRole('img', { name: 'Haval Jolion, А 123 МР 77, в движении' }),
  ).toBeVisible();
  await expect(page.getByText('Скорость 62 км/ч')).toHaveAttribute('data-state', 'moving');
  await expect(page.getByText('На связи · сигнал получен сейчас')).toHaveAttribute(
    'data-state',
    'online',
  );
  const event = page.getByRole('listitem', { name: 'Въезд в геозону, Haval Jolion' });
  await expect(event).toContainText('10:42');
  await expect(event).toHaveAttribute('data-tone', 'info');
});
