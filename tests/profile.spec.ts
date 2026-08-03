import { expect, test } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';

test('профиль показывает реальные данные текущего администратора', async ({ page }) => {
  await openAuthenticatedRoute(page, '/profile');

  await expect(page.getByRole('heading', { name: 'Профиль администратора' })).toBeVisible();
  const name = page.getByLabel('Имя');
  const email = page.getByLabel('Email');
  await expect(name).not.toHaveValue('');
  await expect(email).toHaveValue(process.env.PILOT_ADMIN_EMAIL ?? '');
  const currentName = await name.inputValue();
  const currentEmail = await email.inputValue();
  const expectedInitials = currentName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const profile = page.getByRole('region', { name: 'Профиль администратора' });

  await expect(profile.getByRole('img', { name: currentName })).toContainText(expectedInitials);
  await expect(profile.getByText(currentEmail, { exact: true }).first()).toBeVisible();
  await expect(profile.getByText('Администратор', { exact: true })).toBeVisible();

  if (await page.getByTestId('desktop-sidebar').isVisible()) {
    await expect(page.getByTestId('desktop-sidebar').getByText(currentName)).toBeVisible();
    await expect(page.getByTestId('desktop-sidebar').getByText(currentEmail)).toBeVisible();
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

test('администратор успешно сохраняет текущее имя', async ({ page }) => {
  const currentPassword = process.env.PILOT_ADMIN_PASSWORD;
  if (!currentPassword) throw new Error('Для profile e2e нужен PILOT_ADMIN_PASSWORD.');

  await openAuthenticatedRoute(page, '/profile');
  const name = page.getByLabel('Имя');
  const currentName = await name.inputValue();

  await name.fill(currentName);
  await page
    .getByLabel(/^Текущий пароль/)
    .first()
    .fill(currentPassword);
  await page.getByRole('button', { name: 'Сохранить профиль' }).click();
  await expect(page.getByText('Профиль сохранён.').first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Имя')).toHaveValue(currentName);
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
