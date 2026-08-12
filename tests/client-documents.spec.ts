import { createCipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';

import { prisma } from '../src/database/prisma/client';
import { SESSION_COOKIE_NAME } from '../src/services/auth/session-constants';
import { hashSessionToken } from '../src/services/auth/session-token';
import { LocalPrivateStorage } from '../src/services/storage/local-private-storage';

import { openAuthenticatedRoute } from './helpers/auth';

type CompanyRole = 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER' | 'VIEWER';

const safePdf = Buffer.from('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF', 'utf8');
const safePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAE/wJ/lx2lWQAAAABJRU5ErkJggg==',
  'base64',
);
const eicarPdf = Buffer.from(
  [
    '%PDF-1.7\n',
    'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR',
    '-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
    '\n%%EOF',
  ].join(''),
  'utf8',
);

function clientKeys(): { encryptionKey: string; searchKey: string } {
  const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  const searchKey = process.env.CLIENT_SEARCH_KEY;
  if (!encryptionKey || !searchKey) {
    throw new Error(
      'Для E2E документов нужны CLIENT_DATA_ENCRYPTION_KEY и CLIENT_SEARCH_KEY в тестовом окружении.',
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

async function adminUserId() {
  const email = process.env.PILOT_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('Для E2E документов нужен PILOT_ADMIN_EMAIL.');
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error('Администратор E2E не найден в тестовой БД.');
  return user.id;
}

async function createCompany(label: string) {
  const id = randomUUID();
  return prisma.company.create({
    data: { id, name: `${label} ${id}`, slug: `documents-${id}`, isDemo: true },
    select: { id: true, name: true },
  });
}

async function createClient(companyId: string, createdByUserId: string, label: string) {
  const id = randomUUID();
  const phone = `79${id.replace(/\D/g, '').padEnd(9, '0').slice(0, 9)}`;
  const { encryptionKey, searchKey } = clientKeys();
  return prisma.client.create({
    data: {
      id,
      companyId,
      firstName: 'E2E',
      lastName: label,
      phoneEncrypted: encryptFixtureField(phone, encryptionKey),
      phoneIndex: createHmac('sha256', searchKey)
        .update(phone.replace(/\D/g, ''), 'utf8')
        .digest('hex'),
      driverCategories: [],
      status: 'NEW',
      createdByUserId,
      source: `e2e-client-documents-${id}`,
    },
    select: { id: true },
  });
}

async function createMember(companyId: string, role: CompanyRole) {
  const id = randomUUID();
  const user = await prisma.user.create({
    data: {
      id,
      email: `documents-${role.toLowerCase()}-${id}@example.test`,
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

async function openSession(page: Page, userId: string) {
  const id = randomUUID();
  const token = randomUUID();
  await prisma.session.create({
    data: {
      id,
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 120_000),
    },
  });
  await page
    .context()
    .addCookies([
      { name: SESSION_COOKIE_NAME, value: token, domain: '127.0.0.1', path: '/', httpOnly: true },
    ]);
  return id;
}

async function createDocumentFixture({
  companyId,
  clientId,
  createdByUserId,
  status,
  title,
  originalName,
}: {
  companyId: string;
  clientId: string;
  createdByUserId: string;
  status: 'CLEAN' | 'PENDING';
  title: string;
  originalName?: string;
}) {
  const id = randomUUID();
  const versionUploadId = randomUUID();
  const storageKey = `companies/${companyId}/clients/${clientId}/documents/${id}/1.pdf`;
  const document = await prisma.clientDocument.create({
    data: {
      id,
      companyId,
      clientId,
      category: 'OTHER',
      title,
      status,
      currentVersion: 1,
      createdByUserId,
      versions: {
        create: {
          uploadId: versionUploadId,
          version: 1,
          storageKey,
          originalName: originalName ?? `${title}.pdf`,
          verifiedMime: 'application/pdf',
          bytes: safePdf.byteLength,
          sha256: 'a'.repeat(64),
          scanVerdict: status === 'CLEAN' ? 'CLEAN' : null,
          scannedAt: status === 'CLEAN' ? new Date() : null,
        },
      },
    },
    select: { id: true },
  });

  if (status === 'CLEAN') {
    const root = process.env.PRIVATE_STORAGE_ROOT?.trim();
    if (!root) throw new Error('Для CLEAN E2E fixture нужен PRIVATE_STORAGE_ROOT.');
    const storage = await LocalPrivateStorage.create(root);
    await storage.putQuarantine(versionUploadId, safePdf);
    await storage.promote(versionUploadId, storageKey);
  }

  return document;
}

async function removeStorageCompanies(companyIds: readonly string[]) {
  const configuredRoot = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (!configuredRoot) return;
  const root = resolve(configuredRoot);
  await Promise.all(
    companyIds.map(async (companyId) => {
      const target = resolve(root, 'private', 'companies', companyId);
      const fromRoot = relative(root, target);
      if (!fromRoot || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
        throw new Error('E2E cleanup вышел за пределы PRIVATE_STORAGE_ROOT.');
      }
      await rm(target, { recursive: true, force: true });
    }),
  );
}

async function cleanupFixtures({
  companyIds,
  sessionIds = [],
  userIds = [],
}: {
  companyIds: readonly string[];
  sessionIds?: readonly string[];
  userIds?: readonly string[];
}) {
  if (sessionIds.length) {
    await prisma.session.deleteMany({ where: { id: { in: [...sessionIds] } } });
  }
  if (companyIds.length) {
    await prisma.company.deleteMany({ where: { id: { in: [...companyIds] } } });
    await removeStorageCompanies(companyIds);
  }
  if (userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
  }
}

async function dropFile(input: Locator, name: string, mime: string, bytes: Buffer) {
  await input.evaluate(
    (element, payload) => {
      const data = new Uint8Array(payload.bytes);
      const transfer = new DataTransfer();
      transfer.items.add(new File([data], payload.name, { type: payload.mime }));
      element
        .closest('[data-testid="document-dropzone"]')
        ?.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
    },
    { name, mime, bytes: [...bytes] },
  );
}

function documentCard(page: Page, title: string) {
  return page.locator('article[data-document-status]').filter({ hasText: title });
}

test('safe JPG/PDF, photo, replacement, download and EICAR denial', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Полный mutation-flow выполняется один раз.');
  const companyIds: string[] = [];
  try {
    const safeJpeg = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 37, g: 99, b: 235 } },
    })
      .jpeg()
      .toBuffer();
    const adminId = await adminUserId();
    const company = await createCompany('E2E documents flow');
    companyIds.push(company.id);
    const client = await createClient(company.id, adminId, `Documents-${randomUUID()}`);

    await openAuthenticatedRoute(page, `/clients/${client.id}`);
    await expect(page.getByTestId('client-documents-panel')).toBeVisible();
    await expect(page.getByText('Документы пока не загружены')).toBeVisible();

    await page.getByLabel(/Название документа/u).fill('Паспорт E2E');
    await dropFile(page.getByLabel('Файл документа'), 'passport-safe.jpg', 'image/jpeg', safeJpeg);
    await page.getByRole('button', { name: 'Загрузить документ' }).click();
    const jpgCard = documentCard(page, 'Паспорт E2E');
    await expect(jpgCard).toContainText('Проверен');
    const firstPreview = jpgCard.getByRole('img', { name: /Предпросмотр документа/u });
    await expect(firstPreview).toBeVisible();
    await expect(firstPreview).toHaveAttribute('src', /[?&]v=1(?:&|$)/u);

    await page.getByLabel(/Категория документа/u).selectOption('CONTRACT');
    await page.getByLabel(/Название документа/u).fill('Договор E2E');
    await page
      .getByLabel('Файл документа')
      .setInputFiles({ name: 'contract-safe.pdf', mimeType: 'application/pdf', buffer: safePdf });
    await page.getByRole('button', { name: 'Загрузить документ' }).click();
    const pdfCard = documentCard(page, 'Договор E2E');
    await expect(pdfCard).toContainText('PDF');
    await expect(pdfCard).toContainText('Проверен');

    const downloadPromise = page.waitForEvent('download');
    await pdfCard.getByRole('link', { name: 'Скачать' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('contract-safe.pdf');
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).subarray(0, 4).toString()).toBe('%PDF');

    await page
      .getByLabel('Фотография клиента')
      .setInputFiles({ name: 'client-safe.png', mimeType: 'image/png', buffer: safePng });
    await page.getByRole('button', { name: 'Обновить фотографию' }).click();
    await expect(page.getByText('Фотография клиента обновлена.')).toBeVisible();
    await expect(page.getByTestId('client-photo').locator('img')).toHaveAttribute(
      'src',
      new RegExp(`/clients/${client.id}/photo\\?v=[a-z0-9]+$`, 'u'),
    );

    await jpgCard.getByRole('button', { name: /Заменить документ/u }).click();
    await jpgCard
      .getByLabel(/Новый файл/u)
      .setInputFiles({ name: 'passport-replaced.jpg', mimeType: 'image/jpeg', buffer: safeJpeg });
    await jpgCard.getByRole('button', { name: 'Загрузить замену' }).click();
    await expect(jpgCard).toContainText('passport-replaced.jpg');
    await expect(jpgCard.getByRole('img', { name: /Предпросмотр документа/u })).toHaveAttribute(
      'src',
      /[?&]v=2(?:&|$)/u,
    );

    await page.getByLabel(/Категория документа/u).selectOption('OTHER');
    await page.getByLabel(/Название документа/u).fill('EICAR E2E');
    await page
      .getByLabel('Файл документа')
      .setInputFiles({ name: 'eicar.pdf', mimeType: 'application/pdf', buffer: eicarPdf });
    await page.getByRole('button', { name: 'Загрузить документ' }).click();
    await expect(page.getByText('Файл заблокирован антивирусом.')).toBeVisible();
    const blockedCard = documentCard(page, 'EICAR E2E');
    await expect(blockedCard).toContainText('Заблокирован');
    await expect(blockedCard.getByRole('link', { name: 'Скачать' })).toHaveCount(0);

    page.once('dialog', (dialog) => dialog.accept());
    await jpgCard.getByRole('button', { name: /Архивировать документ/u }).click();
    await expect(jpgCard).toHaveCount(0);
  } finally {
    await cleanupFixtures({ companyIds });
  }
});

test('cross-tenant is hidden and DRIVER is denied by page and download route', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'RBAC regression выполняется один раз.');
  const companyIds: string[] = [];
  const sessionIds: string[] = [];
  const userIds: string[] = [];
  try {
    const adminId = await adminUserId();
    const ownCompany = await createCompany('E2E documents own');
    const foreignCompany = await createCompany('E2E documents foreign');
    companyIds.push(ownCompany.id, foreignCompany.id);
    const ownClient = await createClient(ownCompany.id, adminId, `Own-${randomUUID()}`);
    const foreignClient = await createClient(foreignCompany.id, adminId, `Foreign-${randomUUID()}`);
    const ownDocument = await createDocumentFixture({
      companyId: ownCompany.id,
      clientId: ownClient.id,
      createdByUserId: adminId,
      status: 'CLEAN',
      title: 'Own document',
    });
    const foreignDocument = await createDocumentFixture({
      companyId: foreignCompany.id,
      clientId: foreignClient.id,
      createdByUserId: adminId,
      status: 'CLEAN',
      title: 'Foreign document',
    });
    const viewer = await createMember(ownCompany.id, 'VIEWER');
    const driver = await createMember(ownCompany.id, 'DRIVER');
    userIds.push(viewer.id, driver.id);

    sessionIds.push(await openSession(page, viewer.id));
    await page.goto(`/clients/${foreignClient.id}`);
    await expect(page.getByRole('heading', { name: 'Клиент не найден' })).toBeVisible();
    const foreignResponse = await page.request.get(
      `/clients/${foreignClient.id}/documents/${foreignDocument.id}/download`,
    );
    expect(foreignResponse.status()).toBe(404);

    await page.context().clearCookies();
    sessionIds.push(await openSession(page, driver.id));
    const driverResponse = await page.request.get(
      `/clients/${ownClient.id}/documents/${ownDocument.id}/download`,
    );
    expect(driverResponse.status()).toBe(403);
    await page.goto(`/clients/${ownClient.id}`);
    await expect(page.getByTestId('client-documents-panel')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Не удалось загрузить карточку клиента' }),
    ).toBeVisible();
  } finally {
    await cleanupFixtures({ companyIds, sessionIds, userIds });
  }
});

test('mobile 390 px has no horizontal overflow and keeps 44 px controls', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Responsive regression относится к mobile.');
  const companyIds: string[] = [];
  try {
    const adminId = await adminUserId();
    const company = await createCompany('E2E documents mobile');
    companyIds.push(company.id);
    const client = await createClient(company.id, adminId, `Mobile-${randomUUID()}`);
    await createDocumentFixture({
      companyId: company.id,
      clientId: client.id,
      createdByUserId: adminId,
      status: 'PENDING',
      title: 'Mobile pending',
      originalName: `${'оченьдлинноеимяфайлабезпробелов'.repeat(18)}.pdf`,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await openAuthenticatedRoute(page, `/clients/${client.id}`);
    await expect(page.getByTestId('client-documents-panel')).toBeVisible();
    await expect(documentCard(page, 'Mobile pending')).toContainText('Проверяется');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    for (const control of [
      page.getByLabel('Фотография клиента'),
      page.getByLabel('Файл документа'),
      page.getByRole('button', { name: 'Загрузить документ' }),
    ]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  } finally {
    await cleanupFixtures({ companyIds });
  }
});

test('client navigation exposes the geometry-preserving document skeleton', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Skeleton navigation проверяется один раз.');
  const companyIds: string[] = [];
  try {
    const adminId = await adminUserId();
    const company = await createCompany('E2E documents skeleton');
    companyIds.push(company.id);
    const label = `Skeleton-${randomUUID()}`;
    const client = await createClient(company.id, adminId, label);

    await openAuthenticatedRoute(page, '/clients');
    await page.route(new RegExp(`/clients/${client.id}(?:\\?|$)`), async (route) => {
      if (new URL(route.request().url()).searchParams.has('_rsc')) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 700));
      }
      await route.continue();
    });
    const card = page.getByTestId('client-card').filter({ hasText: label });
    const navigation = card.getByRole('link', { name: 'Открыть', exact: true }).click();
    await expect(page.getByLabel('Загрузка клиента')).toBeVisible();
    await expect(page.getByTestId('client-documents-skeleton')).toBeVisible();
    await navigation;
    await expect(page).toHaveURL(new RegExp(`/clients/${client.id}$`));
  } finally {
    await cleanupFixtures({ companyIds });
  }
});
