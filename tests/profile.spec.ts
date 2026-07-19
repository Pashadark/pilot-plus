import { expect, test } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

test('профиль показывает реальные данные текущего администратора', async ({ page }) => {
  await openAuthenticatedRoute(page, '/profile');

  await expect(page.getByRole('heading', { name: 'Профиль администратора' })).toBeVisible();
  const name = page.getByLabel('Имя');
  const email = page.getByLabel('Email');
  await expect(name).not.toHaveValue('');
  await expect(email).toHaveValue(process.env.PILOT_ADMIN_EMAIL ?? '');

  if (await page.getByTestId('desktop-sidebar').isVisible()) {
    await expect(
      page.getByTestId('desktop-sidebar').getByText(await name.inputValue()),
    ).toBeVisible();
    await expect(
      page.getByTestId('desktop-sidebar').getByText(await email.inputValue()),
    ).toBeVisible();
  } else {
    await page.getByRole('button', { name: 'Открыть меню' }).click();
    await expect(page.getByRole('link', { name: 'Открыть профиль' })).toContainText(
      await name.inputValue(),
    );
    await expect(page.getByRole('link', { name: 'Открыть профиль' })).toContainText(
      await email.inputValue(),
    );
  }
});

test('администратор сохраняет имя и может вернуть исходное значение', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Изменяющий БД сценарий выполняется один раз.');
  const currentPassword = process.env.PILOT_ADMIN_PASSWORD;
  if (!currentPassword) throw new Error('Для profile e2e нужен PILOT_ADMIN_PASSWORD.');

  await openAuthenticatedRoute(page, '/profile');
  const name = page.getByLabel('Имя');
  const originalName = await name.inputValue();
  const changedName = `${originalName} E2E`;

  try {
    await name.fill(changedName);
    await page
      .getByLabel(/^Текущий пароль/)
      .first()
      .fill(currentPassword);
    await page.getByRole('button', { name: 'Сохранить профиль' }).click();
    await expect(page.getByText('Профиль сохранён.').first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Имя')).toHaveValue(changedName);
  } finally {
    await page.getByLabel('Имя').fill(originalName);
    await page
      .getByLabel(/^Текущий пароль/)
      .first()
      .fill(currentPassword);
    await page.getByRole('button', { name: 'Сохранить профиль' }).click();
    await expect(page.getByText('Профиль сохранён.').first()).toBeVisible();
  }
});

test('неверный текущий пароль не изменяет профиль', async ({ page }) => {
  await openAuthenticatedRoute(page, '/profile');

  await page
    .getByLabel(/^Текущий пароль/)
    .first()
    .fill('Неверный пароль 2026');
  await page.getByRole('button', { name: 'Сохранить профиль' }).click();

  await expect(page.getByText('Не удалось подтвердить текущий пароль.').first()).toBeVisible();
});

test('профиль не переполняется на ширине 375 пикселей', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openAuthenticatedRoute(page, '/profile');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
