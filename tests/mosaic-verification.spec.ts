import { expect, test, type ConsoleMessage } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

const hydrationError = /hydration|server rendered html didn't match/i;
const synchronousUnmountWarning = /attempted to synchronously unmount a root/i;

function collectConsoleMessages(messages: string[], message: ConsoleMessage) {
  messages.push(message.text());
}

test('сохранённая тёмная тема гидратируется без ошибок консоли', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (message) => collectConsoleMessages(consoleMessages, message));
  page.on('pageerror', (error) => consoleMessages.push(error.message));
  await page.addInitScript(() => localStorage.setItem('pilot-theme', 'dark'));

  await openAuthenticatedRoute(page, '/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('switch', { name: 'Тёмная тема' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.waitForTimeout(250);

  expect(consoleMessages.filter((message) => hydrationError.test(message))).toEqual([]);
});

test('два синхронных переключения темы возвращают исходную тему', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pilot-theme', 'light'));
  await openAuthenticatedRoute(page, '/ui-kit');

  const toggle = page.getByRole('switch', { name: 'Тёмная тема' });
  await expect(toggle).toBeVisible();
  await page.waitForTimeout(250);
  await toggle.evaluate((button) => {
    const themeButton = button as HTMLButtonElement;
    themeButton.click();
    themeButton.click();
  });

  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('удаление сохранённой темы в другой вкладке возвращает светлую тему', async ({
  context,
  page,
}) => {
  await openAuthenticatedRoute(page, '/ui-kit');
  await page.waitForTimeout(250);
  const toggle = page.getByRole('switch', { name: 'Тёмная тема' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  const otherPage = await context.newPage();
  await otherPage.goto('/ui-kit');
  await otherPage.evaluate(() => localStorage.removeItem('pilot-theme'));

  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await otherPage.close();
});

test('очистка хранилища в другой вкладке возвращает светлую тему', async ({ context, page }) => {
  await openAuthenticatedRoute(page, '/ui-kit');
  await page.waitForTimeout(250);
  const toggle = page.getByRole('switch', { name: 'Тёмная тема' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  const otherPage = await context.newPage();
  await otherPage.goto('/ui-kit');
  await otherPage.evaluate(() => localStorage.clear());

  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await otherPage.close();
});

test('повторная навигация очищает карту без синхронного unmount React root', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (message) => collectConsoleMessages(consoleMessages, message));

  await openAuthenticatedRoute(page, '/map');
  const mapRegion = page.getByRole('region', { name: 'Интерактивная карта автопарка' });
  await expect(mapRegion).toBeVisible();

  for (let index = 0; index < 3; index += 1) {
    await page.goto('/ui-kit');
    await expect(page.getByRole('heading', { name: 'Дизайн-система СУПА ПРО' })).toBeVisible();
    await page.goto('/map');
    await expect(mapRegion).toBeVisible();
  }

  expect(consoleMessages.filter((message) => synchronousUnmountWarning.test(message))).toEqual([]);
});
