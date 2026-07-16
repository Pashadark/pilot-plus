import { expect, test, type ConsoleMessage } from '@playwright/test';

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

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Включить светлую тему' })).toBeVisible();
  await page.waitForTimeout(250);

  expect(consoleMessages.filter((message) => hydrationError.test(message))).toEqual([]);
});

test('два синхронных переключения темы возвращают исходную тему', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pilot-theme', 'light'));
  await page.goto('/ui-kit');

  const toggle = page.getByRole('button', { name: 'Включить тёмную тему' });
  await expect(toggle).toBeVisible();
  await toggle.evaluate((button) => {
    const themeButton = button as HTMLButtonElement;
    themeButton.click();
    themeButton.click();
  });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Включить тёмную тему' })).toBeVisible();
});

test('удаление сохранённой темы в другой вкладке возвращает светлую тему', async ({
  context,
  page,
}) => {
  await page.goto('/ui-kit');
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const otherPage = await context.newPage();
  await otherPage.goto('/ui-kit');
  await otherPage.evaluate(() => localStorage.removeItem('pilot-theme'));

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Включить тёмную тему' })).toBeVisible();
  await otherPage.close();
});

test('очистка хранилища в другой вкладке возвращает светлую тему', async ({ context, page }) => {
  await page.goto('/ui-kit');
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const otherPage = await context.newPage();
  await otherPage.goto('/ui-kit');
  await otherPage.evaluate(() => localStorage.clear());

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Включить тёмную тему' })).toBeVisible();
  await otherPage.close();
});

test('повторная навигация очищает карту без синхронного unmount React root', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (message) => collectConsoleMessages(consoleMessages, message));

  await page.goto('/');
  const mapCanvas = page.getByLabel('Карта автопарка').filter({ visible: true }).locator('canvas');
  await expect(mapCanvas).toBeVisible();

  for (let index = 0; index < 3; index += 1) {
    await page.goto('/ui-kit');
    await expect(page.getByRole('heading', { name: 'Дизайн-система Pilot+' })).toBeVisible();
    await page.goto('/');
    await expect(mapCanvas).toBeVisible();
  }

  expect(consoleMessages.filter((message) => synchronousUnmountWarning.test(message))).toEqual([]);
});
