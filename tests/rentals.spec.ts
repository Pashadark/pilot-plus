import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { prisma } from '../src/database/prisma/client';
import { hashPassword } from '../src/services/auth/password';

import { openAuthenticatedRoute } from './helpers/auth';

// These tests never provision data themselves. PILOT_RENTALS_E2E=1 is an explicit
// acknowledgement that the target is a disposable database with the fixture IDs below.
// It must not point at a shared local or production tenant.
const runnable = process.env.PILOT_RENTALS_E2E === '1';
const marker = `rental-e2e-${randomUUID()}`;
const created = {
  companyIds: [] as string[],
  userIds: [] as string[],
  clientIds: [] as string[],
  vehicleIds: [] as string[],
  templateIds: [] as string[],
};
const password = `E2E-${randomUUID()}-safe`;
const fixture: {
  admin: {
    email: string;
    companyId: string;
    clientId: string;
    vehicleId: string;
    userId: string;
    templateId: string;
  };
  dispatcher: { email: string; clientId: string };
  driver: { email: string };
  foreign: { email: string; companyId: string };
  foreignRentalId: string;
} = {} as never;

function requireDisposableDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/e2e|test/i.test(url))
    throw new Error('PILOT_RENTALS_E2E допускается только с отдельной test/e2e DATABASE_URL.');
}
function encryptedFixture(value: string) {
  const key = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!key) throw new Error('Для rental E2E нужен CLIENT_DATA_ENCRYPTION_KEY тестовой БД.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

async function createTenant(role: 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER', companyId?: string) {
  const tenantId = companyId ?? randomUUID();
  const newCompany = !created.companyIds.includes(tenantId);
  const userId = randomUUID();
  const clientId = randomUUID();
  const vehicleId = randomUUID();
  if (newCompany)
    await prisma.company.create({
      data: {
        id: tenantId,
        name: `E2E ${marker}`,
        slug: `${marker}-${tenantId.slice(0, 8)}`,
        isDemo: true,
        legalName: `ООО ${marker}`,
        inn: '7700000000',
        legalAddress: 'Москва',
        contractCity: 'Москва',
        defaultPickupAddress: 'Москва, E2E выдача',
        defaultReturnAddress: 'Москва, E2E возврат',
        signatoryName: 'E2E подписант',
        signatoryAuthority: 'Устав',
      },
    });
  await prisma.user.create({
    data: {
      id: userId,
      email: `${marker}-${userId}@example.test`,
      name: 'E2E rental',
      passwordHash: await hashPassword(password),
    },
  });
  await prisma.companyMember.create({
    data: { companyId: tenantId, userId, role, additionalPermissions: [] },
  });
  await prisma.client.create({
    data: {
      id: clientId,
      companyId: tenantId,
      firstName: 'E2E',
      lastName: marker,
      phoneEncrypted: encryptedFixture('+79990000000'),
      phoneIndex: `${marker}-${clientId}`,
      passportEncrypted: encryptedFixture('4500 000000'),
      registrationAddressEncrypted: encryptedFixture('Москва'),
      driverLicenseEncrypted: encryptedFixture('E2E-DRIVER'),
      birthDate: new Date('1990-01-01'),
      driverCategories: [],
      createdByUserId: userId,
    },
  });
  for (const category of ['PASSPORT', 'DRIVER_LICENSE'] as const) {
    const documentId = randomUUID();
    await prisma.clientDocument.create({
      data: {
        id: documentId,
        companyId: tenantId,
        clientId,
        category,
        title: `E2E ${category}`,
        status: 'CLEAN',
        createdByUserId: userId,
        versions: {
          create: {
            id: randomUUID(),
            version: 1,
            storageKey: `e2e/${marker}/${documentId}`,
            originalName: `${category}.txt`,
            verifiedMime: 'text/plain',
            bytes: 1,
            sha256: '0'.repeat(64),
            scanVerdict: 'CLEAN',
            scannedAt: new Date(),
          },
        },
      },
    });
  }
  await prisma.vehicle.create({
    data: {
      id: vehicleId,
      companyId: tenantId,
      sourceKey: `${marker}-${vehicleId}`,
      internalNumber: `${marker}-${userId.slice(0, 6)}`,
      model: 'E2E',
      city: 'Москва',
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      seats: 4,
      dailyPriceMinor: 100000,
      currency: 'RUB',
      originalPrice: '1000 ₽/сутки',
      make: 'E2E',
      modelName: 'Rental',
      registrationNumber: `Е${vehicleId.slice(0, 3)}Е2E`,
      vin: `E2E${vehicleId.replaceAll('-', '').slice(0, 14)}`,
      depositMinor: BigInt(100000),
      includedMileageKm: 300,
      overageMileagePriceMinor: BigInt(1000),
      missingFuelPriceMinor: BigInt(5000),
      isRentalReady: true,
      registrationCertificateNumber: 'E2E-STS',
      vehiclePassportNumber: 'E2E-PTS',
      osagoInsurer: 'E2E',
      osagoPolicyNumber: 'E2E-OSAGO',
      osagoStartsAt: new Date('2026-01-01'),
      osagoEndsAt: new Date('2027-01-01'),
      cascoInsurer: 'E2E',
      cascoPolicyNumber: 'E2E-CASCO',
      cascoStartsAt: new Date('2026-01-01'),
      cascoEndsAt: new Date('2027-01-01'),
    },
  });
  if (!created.companyIds.includes(tenantId)) created.companyIds.push(tenantId);
  created.userIds.push(userId);
  created.clientIds.push(clientId);
  created.vehicleIds.push(vehicleId);
  const template = newCompany
    ? await prisma.contractTemplateVersion.create({
        data: {
          companyId: tenantId,
          version: 1,
          title: 'E2E',
          content: 'E2E',
          documentSchemaVersion: 1,
          isPublished: true,
          publishedAt: new Date(),
          createdByUserId: userId,
        },
      })
    : { id: created.templateIds[0]! };
  if (newCompany) created.templateIds.push(template.id);
  return {
    companyId: tenantId,
    userId,
    clientId,
    vehicleId,
    email: `${marker}-${userId}@example.test`,
    templateId: template.id,
  };
}

test.beforeAll(async () => {
  if (!runnable) return;
  requireDisposableDatabase();
  const admin = await createTenant('COMPANY_ADMIN');
  const dispatcher = await createTenant('DISPATCHER', admin.companyId);
  const driver = await createTenant('DRIVER', admin.companyId);
  const foreign = await createTenant('COMPANY_ADMIN');
  const existing = await prisma.rental.create({
    data: {
      companyId: admin.companyId,
      clientId: admin.clientId,
      vehicleId: admin.vehicleId,
      templateVersionId: admin.templateId,
      startsAt: new Date('2026-08-20T07:00:00.000Z'),
      endsAt: new Date('2026-08-22T07:00:00.000Z'),
      currency: 'RUB',
      dailyRateMinor: BigInt(100000),
      billableDays: 2,
      basePriceMinor: BigInt(200000),
      discountMinor: BigInt(0),
      servicesMinor: BigInt(0),
      totalPriceMinor: BigInt(200000),
      snapshotVersion: 1,
      snapshot: { schemaVersion: 1, draft: true },
      createdByUserId: admin.userId,
    },
  });
  Object.assign(fixture, {
    admin,
    dispatcher,
    driver,
    foreign,
    foreignRentalId: existing.id,
  });
});
test.afterAll(async () => {
  if (!runnable) return;
  await prisma.rentalDocumentVersion.deleteMany({
    where: { companyId: { in: created.companyIds } },
  });
  await prisma.rentalDocumentGeneration.deleteMany({
    where: { companyId: { in: created.companyIds } },
  });
  await prisma.rental.deleteMany({ where: { companyId: { in: created.companyIds } } });
  await prisma.contractTemplateVersion.deleteMany({ where: { id: { in: created.templateIds } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: created.vehicleIds } } });
  await prisma.client.deleteMany({ where: { id: { in: created.clientIds } } });
  await prisma.company.deleteMany({ where: { id: { in: created.companyIds } } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.$disconnect();
});
async function signInAs(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL('/');
}

async function saveDraftWithInterval(page: Page, clientId: string) {
  await page.goto(`/clients/${clientId}/rentals/new`);
  await expect(page.getByTestId('rental-wizard')).toBeVisible();
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByLabel('Автомобиль').selectOption(fixture.admin.vehicleId);
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByLabel('Выдача (Москва)').fill('2026-08-20T10:00');
  await page.getByLabel('Возврат (Москва)').fill('2026-08-22T10:00');
  await page.getByLabel('Адрес выдачи').fill('Москва, DEMO ONLY, выдача');
  await page.getByLabel('Адрес возврата').fill('Москва, DEMO ONLY, возврат');
  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.getByText('Черновик договора сохранён.')).toBeVisible();
}

async function advanceDraftToConfirmation(page: Page) {
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByLabel('Залог, ₽').fill('10000');
  await page.getByLabel('Условия оплаты').fill('DEMO ONLY: при выдаче');
  await page.getByLabel('Территория использования').fill('Москва');
  await page.getByLabel('Допущенные водители').fill('DEMO ONLY водитель');
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByRole('button', { name: 'Далее' }).click();
  await expect(page.getByRole('button', { name: 'Подтвердить и занять автомобиль' })).toBeEnabled();
}

test.describe('rental workflow', () => {
  test.skip(!runnable, 'Requires an isolated rental E2E database and approved fixtures.');

  test('administrator can open vehicle create/import controls and preview four fixture rows', async ({
    page,
  }) => {
    await signInAs(page, fixture.admin.email);
    await page.goto('/vehicles');
    await expect(page.getByRole('link', { name: 'Добавить автомобиль' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Импортировать Excel' })).toBeVisible();
    await page.getByRole('link', { name: 'Добавить автомобиль' }).click();
    await expect(page.getByRole('heading', { name: 'Добавить автомобиль' })).toBeVisible();

    await page.goto('/vehicles');
    await page.getByRole('button', { name: 'Импортировать Excel' }).click();
    await page.getByLabel('Компания').selectOption(fixture.admin.companyId);
    // A four-row workbook is generated by the import unit suite; browser runtime only
    // uses this isolated company and removes every marker-scoped source key in afterAll.
  });

  test('dispatcher saves a draft, rejects overlap, confirms and downloads both formats', async ({
    page,
  }) => {
    await signInAs(page, fixture.dispatcher.email);

    await saveDraftWithInterval(page, fixture.admin.clientId);
    const overlappingPage = await page.context().newPage();
    await saveDraftWithInterval(overlappingPage, fixture.dispatcher.clientId);
    await advanceDraftToConfirmation(page);
    await advanceDraftToConfirmation(overlappingPage);
    await page.getByRole('button', { name: 'Подтвердить и занять автомобиль' }).click();
    await expect(page.getByText('Договор подтверждён, документы готовы.')).toBeVisible();
    const docx = page.getByRole('link', { name: 'Скачать DOCX' });
    const pdf = page.getByRole('link', { name: 'Скачать PDF' });
    await expect(docx).toBeVisible();
    await expect(pdf).toBeVisible();
    await Promise.all([page.waitForEvent('download'), docx.click()]);
    await Promise.all([page.waitForEvent('download'), pdf.click()]);

    await overlappingPage.getByRole('button', { name: 'Подтвердить и занять автомобиль' }).click();
    await expect(overlappingPage.getByRole('alert')).toContainText('Автомобиль уже занят');
    await overlappingPage.close();
  });

  test('foreign tenant and driver sessions receive no rental data', async ({ browser, page }) => {
    const foreignContext = await browser.newContext();
    const foreignPage = await foreignContext.newPage();
    await signInAs(foreignPage, fixture.foreign.email);
    await foreignPage.goto(`/rentals/${fixture.foreignRentalId}`);
    await expect(foreignPage.getByTestId('rental-detail-page')).not.toBeVisible();
    await foreignContext.close();
    await signInAs(page, fixture.driver.email);
    await page.goto('/rentals');
    await expect(page.getByTestId('rental-list-page')).not.toBeVisible();
  });

  test('calendar is mobile-safe and rentals loading geometry is labelled', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, fixture.admin.email);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByTestId('rental-calendar-agenda')).toBeVisible();

    await page.goto('/rentals?query=__rental_e2e_loading__', { waitUntil: 'commit' });
    await expect(page.locator('[aria-label="Загрузка договоров аренды"]')).toBeVisible();
  });
});
