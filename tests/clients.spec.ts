import { createCipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { prisma } from '../src/database/prisma/client';
import { SESSION_COOKIE_NAME } from '../src/services/auth/session-constants';
import { hashSessionToken } from '../src/services/auth/session-token';

import { openAuthenticatedRoute } from './helpers/auth';

type CompanyRole = 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER' | 'VIEWER';

function e2ePhone(): string {
  return `7${randomUUID().replace(/\D/g, '').padEnd(10, '0').slice(0, 10)}`;
}

function clientKeys(): { encryptionKey: string; searchKey: string } {
  const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  const searchKey = process.env.CLIENT_SEARCH_KEY;
  if (!encryptionKey || !searchKey) {
    throw new Error(
      'Для E2E клиентов нужны CLIENT_DATA_ENCRYPTION_KEY и CLIENT_SEARCH_KEY в тестовом окружении.',
    );
  }
  return { encryptionKey, searchKey };
}

function encryptFixtureField(plaintext: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv, {
    authTagLength: 16,
  });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

function fixturePhoneIndex(phone: string, searchKey: string): string {
  return createHmac('sha256', searchKey).update(phone.replace(/\D/g, ''), 'utf8').digest('hex');
}

async function adminUserId(): Promise<string> {
  const email = process.env.PILOT_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('Для E2E клиентов нужен PILOT_ADMIN_EMAIL.');
  const admin = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!admin) throw new Error('Администратор E2E не найден. Сначала выполните db:seed.');
  return admin.id;
}

async function createTemporaryCompany(label: string) {
  const id = randomUUID();
  const name = `${label} ${id}`;
  return prisma.company.create({
    data: { id, name, slug: `e2e-${id}`, isDemo: true },
    select: { id: true, name: true },
  });
}

async function createFixtureClient(companyId: string, createdByUserId: string, label: string) {
  const id = randomUUID();
  const { encryptionKey, searchKey } = clientKeys();
  const phone = e2ePhone();
  return prisma.client.create({
    data: {
      id,
      companyId,
      firstName: 'E2E',
      lastName: label,
      phoneEncrypted: encryptFixtureField(phone, encryptionKey),
      phoneIndex: fixturePhoneIndex(phone, searchKey),
      driverCategories: [],
      status: 'NEW',
      createdByUserId,
      source: `e2e-fixture-${id}`,
    },
    select: { id: true },
  });
}

async function createCompanyMember(companyId: string, role: CompanyRole) {
  const id = randomUUID();
  const user = await prisma.user.create({
    data: {
      id,
      email: `clients-${role.toLowerCase()}-${id}@example.test`,
      name: `E2E ${role}`,
      passwordHash: 'e2e-session-only',
      role: 'MEMBER',
    },
    select: { id: true },
  });
  await prisma.companyMember.create({
    data: { companyId, userId: user.id, role, additionalPermissions: [] },
  });
  return user;
}

async function openSession(page: Page, userId: string): Promise<string> {
  const id = randomUUID();
  const token = randomUUID();
  await prisma.session.create({
    data: {
      id,
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  await page
    .context()
    .addCookies([
      { name: SESSION_COOKIE_NAME, value: token, domain: '127.0.0.1', path: '/', httpOnly: true },
    ]);
  return id;
}

async function cleanupE2eFixtures({
  clientIds = [],
  clientLabels = [],
  companyIds = [],
  sessionIds = [],
  userIds = [],
}: {
  clientIds?: readonly string[];
  clientLabels?: readonly string[];
  companyIds?: readonly string[];
  sessionIds?: readonly string[];
  userIds?: readonly string[];
}) {
  if (sessionIds.length)
    await prisma.session.deleteMany({ where: { id: { in: [...sessionIds] } } });
  if (clientIds.length || clientLabels.length) {
    await prisma.client.deleteMany({
      where: {
        OR: [
          ...(clientIds.length ? [{ id: { in: [...clientIds] } }] : []),
          ...(clientLabels.length ? [{ lastName: { in: [...clientLabels] } }] : []),
        ],
      },
    });
  }
  if (companyIds.length)
    await prisma.company.deleteMany({ where: { id: { in: [...companyIds] } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
}

async function createClientThroughForm(page: Page, lastName: string, companyName?: string) {
  const phone = e2ePhone();
  const additionalPhone = e2ePhone();
  await page.getByRole('button', { name: 'Добавить клиента' }).click();
  await expect(page.getByRole('heading', { name: 'Новый клиент', level: 2 })).toBeVisible();
  if (companyName)
    await page.locator('select[name="companyId"]').selectOption({ label: companyName });
  await page.getByLabel('Имя').fill('E2E');
  await page.getByLabel('Фамилия').fill(lastName);
  await page.getByLabel('Телефон').fill(phone);
  await page.getByLabel('Дополнительный телефон').fill(additionalPhone);
  await page.getByLabel('Email').fill(`${lastName.toLowerCase()}@example.test`);
  await page.getByRole('button', { name: 'Далее', exact: true }).first().click();
  await page.getByLabel('Серия паспорта').fill('4518');
  await page.getByLabel('Номер паспорта').fill('621431');
  await page.locator('input[name="driverLicense"]').fill('E2E-LICENSE');
  await page.getByLabel('Дата выдачи ВУ').fill('2020-01-01');
  await page.getByLabel('Срок действия ВУ').fill('2030-01-01');
  await page.getByRole('button', { name: 'Далее', exact: true }).first().click();
  await page.getByRole('button', { name: 'Далее', exact: true }).first().click();
  await page.getByRole('button', { name: 'Создать клиента' }).click({ force: true });
  await expect(page).toHaveURL(/\/clients\/[a-z0-9]+$/);
  await expect(page.getByLabel('Дополнительный телефон')).toHaveValue(additionalPhone);
  return page.url().split('/').at(-1) as string;
}

async function editClientThroughForm(page: Page, clientId: string, editedLastName: string) {
  await page
    .getByRole('heading', { name: 'Редактировать клиента', level: 2 })
    .scrollIntoViewIfNeeded();
  await page.getByLabel('Фамилия').fill(editedLastName);
  await page.getByRole('button', { name: 'Сохранить изменения' }).click({ force: true });
  await expect(page).toHaveURL(new RegExp(`/clients/${clientId}$`));
  await expect(page.getByRole('heading', { name: new RegExp(editedLastName) })).toBeVisible();
}

test('SYSTEM проходит list/detail/create/edit в изолированной компании', async ({ page }) => {
  const marker = `SYSTEM-${randomUUID()}`;
  const fixtureLabel = `${marker}-FIXTURE`;
  const foreignLabel = `${marker}-FOREIGN`;
  const createdLabel = `${marker}-CREATED`;
  const editedLabel = `${createdLabel}-EDITED`;
  const clientIds: string[] = [];
  const companyIds: string[] = [];

  try {
    const adminId = await adminUserId();
    const company = await createTemporaryCompany('E2E system company');
    companyIds.push(company.id);
    const foreignCompany = await createTemporaryCompany('E2E system foreign company');
    companyIds.push(foreignCompany.id);
    const fixture = await createFixtureClient(company.id, adminId, fixtureLabel);
    clientIds.push(fixture.id);
    const foreignFixture = await createFixtureClient(foreignCompany.id, adminId, foreignLabel);
    clientIds.push(foreignFixture.id);

    await openAuthenticatedRoute(page, '/clients');
    await expect(page.getByTestId('client-page')).toBeVisible();
    const fixtureLink = page.getByRole('link', { name: new RegExp(`^${fixtureLabel}`) });
    await expect(fixtureLink).toHaveCount(1);
    await expect(page.getByRole('link', { name: new RegExp(`^${foreignLabel}`) })).toHaveCount(1);
    await fixtureLink.click();
    await expect(page.getByTestId('client-detail-page')).toBeVisible();
    await page.getByRole('link', { name: 'К клиентам' }).click();

    const clientId = await createClientThroughForm(page, createdLabel, company.name);
    clientIds.push(clientId);
    await editClientThroughForm(page, clientId, editedLabel);
  } finally {
    await cleanupE2eFixtures({ clientIds, clientLabels: [createdLabel, editedLabel], companyIds });
  }
});

test('COMPANY dispatcher проходит list/detail/create/edit только в своей компании', async ({
  page,
}) => {
  const marker = `COMPANY-${randomUUID()}`;
  const fixtureLabel = `${marker}-FIXTURE`;
  const createdLabel = `${marker}-CREATED`;
  const editedLabel = `${createdLabel}-EDITED`;
  const clientIds: string[] = [];
  const companyIds: string[] = [];
  const sessionIds: string[] = [];
  const userIds: string[] = [];

  try {
    const adminId = await adminUserId();
    const company = await createTemporaryCompany('E2E company dispatcher');
    companyIds.push(company.id);
    const fixture = await createFixtureClient(company.id, adminId, fixtureLabel);
    clientIds.push(fixture.id);
    const dispatcher = await createCompanyMember(company.id, 'DISPATCHER');
    userIds.push(dispatcher.id);

    sessionIds.push(await openSession(page, dispatcher.id));
    await page.goto('/clients');
    await expect(page.getByTestId('client-page')).toBeVisible();
    const fixtureLink = page.getByRole('link', { name: new RegExp(`^${fixtureLabel}`) });
    await expect(fixtureLink).toHaveCount(1);
    await fixtureLink.click();
    await expect(page.getByTestId('client-detail-page')).toBeVisible();
    await page.getByRole('link', { name: 'К клиентам' }).click();

    const clientId = await createClientThroughForm(page, createdLabel);
    clientIds.push(clientId);
    await editClientThroughForm(page, clientId, editedLabel);
  } finally {
    await cleanupE2eFixtures({
      clientIds,
      clientLabels: [createdLabel, editedLabel],
      companyIds,
      sessionIds,
      userIds,
    });
  }
});

test('viewer read-only, driver forbidden, а чужая карточка возвращает 404', async ({ page }) => {
  const marker = `ACCESS-${randomUUID()}`;
  const ownLabel = `${marker}-OWN`;
  const foreignLabel = `${marker}-FOREIGN`;
  const clientIds: string[] = [];
  const companyIds: string[] = [];
  const sessionIds: string[] = [];
  const userIds: string[] = [];

  try {
    const adminId = await adminUserId();
    const ownCompany = await createTemporaryCompany('E2E access owner');
    companyIds.push(ownCompany.id);
    const foreignCompany = await createTemporaryCompany('E2E access foreign');
    companyIds.push(foreignCompany.id);
    const ownClient = await createFixtureClient(ownCompany.id, adminId, ownLabel);
    clientIds.push(ownClient.id);
    const foreignClient = await createFixtureClient(foreignCompany.id, adminId, foreignLabel);
    clientIds.push(foreignClient.id);
    const viewer = await createCompanyMember(ownCompany.id, 'VIEWER');
    userIds.push(viewer.id);
    const driver = await createCompanyMember(ownCompany.id, 'DRIVER');
    userIds.push(driver.id);

    sessionIds.push(await openSession(page, viewer.id));
    await page.goto('/clients');
    await expect(page.getByTestId('client-page')).toBeVisible();
    const ownLink = page.getByRole('link', { name: new RegExp(`^${ownLabel}`) });
    await expect(ownLink).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Добавить клиента' })).toHaveCount(0);
    await ownLink.click();
    await expect(page.getByTestId('client-detail-page')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Редактировать клиента', level: 2 }),
    ).toHaveCount(0);
    await page.goto(`/clients/${foreignClient.id}`);
    await expect(page.getByRole('heading', { name: 'Клиент не найден', level: 1 })).toBeVisible();

    await page.context().clearCookies();
    sessionIds.push(await openSession(page, driver.id));
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Клиенты' })).toHaveCount(0);
    await page.goto('/clients');
    await expect(page.getByTestId('client-page')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Не удалось загрузить клиентов', level: 1 }),
    ).toBeVisible();
  } finally {
    await cleanupE2eFixtures({ clientIds, companyIds, sessionIds, userIds });
  }
});

test('SVG заглушка и карточка клиента не переполняют экран 390×844', async ({ page }) => {
  const marker = `MOBILE-${randomUUID()}`;
  const clientIds: string[] = [];
  const companyIds: string[] = [];

  try {
    const adminId = await adminUserId();
    const company = await createTemporaryCompany('E2E mobile client card');
    companyIds.push(company.id);
    const fixture = await createFixtureClient(company.id, adminId, marker);
    clientIds.push(fixture.id);

    await page.setViewportSize({ width: 390, height: 844 });
    await openAuthenticatedRoute(page, '/clients');

    const card = page.getByTestId('client-card').filter({ hasText: marker });
    await expect(card).toHaveCount(1);
    await expect(card.getByTestId('client-photo').locator('svg')).toBeVisible();
    expect(
      (await card.getByRole('link', { name: 'Открыть', exact: true }).boundingBox())?.height ?? 0,
    ).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  } finally {
    await cleanupE2eFixtures({ clientIds, companyIds });
  }
});
