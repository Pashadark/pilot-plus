import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { prisma } from '../src/database/prisma/client';
import { SESSION_COOKIE_NAME } from '../src/services/auth/session';
import { hashSessionToken } from '../src/services/auth/session-token';

import { openAuthenticatedRoute } from './helpers/auth';

test('обзор администрирования показывает реальные показатели и рабочие действия на desktop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAuthenticatedRoute(page, '/admin');

  await expect(page.getByRole('heading', { name: 'Центр управления', level: 1 })).toBeVisible();
  await expect(page.getByTestId('admin-overview-kpi')).toHaveCount(4);
  for (const card of await page.getByTestId('admin-overview-kpi').all()) {
    await expect(card.locator('dd')).toHaveText(/^\d+$/);
  }
  await expect(page.getByRole('link', { name: 'Открыть автопарк' })).toHaveAttribute(
    'href',
    '/vehicles',
  );
  await expect(page.getByRole('link', { name: 'Открыть устройства' })).toHaveAttribute(
    'href',
    '/devices',
  );
  await expect(page.getByRole('link', { name: 'Проверить систему' })).toHaveAttribute(
    'href',
    '/system',
  );
  await expect(page.getByRole('button', { name: /добавить компанию|добавить пользователя/i })).toHaveCount(
    0,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('обзор администрирования помещается на мобильном экране', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedRoute(page, '/admin');

  await expect(page.getByRole('heading', { name: 'Центр управления', level: 1 })).toBeVisible();
  await expect(page.getByTestId('admin-overview-kpi')).toHaveCount(4);
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  const drawer = page.getByRole('dialog', { name: 'Мобильная навигация' });
  await expect(drawer.getByRole('link', { name: 'Администрирование' })).toHaveAttribute(
    'href',
    '/admin',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('MEMBER без company-admin membership получает forbidden state', async ({ page }) => {
  const id = randomUUID();
  const email = `admin-forbidden-${id}@example.test`;
  const token = randomUUID();
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Тестовый пользователь',
      passwordHash: 'not-used-by-session-test',
      role: 'MEMBER',
    },
  });

  try {
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await page.context().addCookies([
      { name: SESSION_COOKIE_NAME, value: token, domain: '127.0.0.1', path: '/', httpOnly: true },
    ]);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Доступ ограничен' })).toBeVisible();
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});
