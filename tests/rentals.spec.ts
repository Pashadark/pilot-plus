import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { prisma } from '../src/database/prisma/client';
import { hashPassword } from '../src/services/auth/password';

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
const safePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAE/wJ/lx2lWQAAAABJRU5ErkJggg==',
  'base64',
);
function canonicalFourWorkbook(): Buffer {
  const xml = `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Марка</t></is></c><c r="B1" t="inlineStr"><is><t>Модель</t></is></c><c r="C1" t="inlineStr"><is><t>Госномер</t></is></c><c r="D1" t="inlineStr"><is><t>Год</t></is></c></row>${[
    ['Kia', "Cee'd", 'А429АУ97', 2020],
    ['Skoda', 'Octavia', 'Е435АН997', 2019],
    ['Mercedes-Benz', 'E 220 d 4MATIC', 'М283АМ997', 2019],
    ['Volkswagen', 'Polo', 'А156АХ997', 2020],
  ]
    .map(
      (row, index) =>
        `<row r="${index + 2}">${row.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${index + 2}"${typeof value === 'string' ? ' t="inlineStr"' : ''}>${typeof value === 'string' ? `<is><t>${value}</t></is>` : `<v>${value}</v>`}</c>`).join('')}</row>`,
    )
    .join('')}</sheetData></worksheet>`;
  const files: Record<string, string> = {
    '[Content_Types].xml': '<Types/>',
    'xl/workbook.xml':
      '<workbook><sheets><sheet name="Автомобили" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': xml,
  };
  const out: Buffer[] = [];
  const dir: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const path = Buffer.from(name);
    const body = Buffer.from(text);
    const local = Buffer.alloc(30 + path.length + body.length);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(path.length, 26);
    path.copy(local, 30);
    body.copy(local, 30 + path.length);
    out.push(local);
    const central = Buffer.alloc(46 + path.length);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(path.length, 28);
    central.writeUInt32LE(offset, 42);
    path.copy(central, 46);
    dir.push(central);
    offset += local.length;
  }
  const directory = Buffer.concat(dir);
  const tail = Buffer.alloc(22);
  tail.writeUInt32LE(0x06054b50);
  tail.writeUInt16LE(dir.length, 8);
  tail.writeUInt16LE(dir.length, 10);
  tail.writeUInt32LE(directory.length, 12);
  tail.writeUInt32LE(offset, 16);
  return Buffer.concat([...out, directory, tail]);
}
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
      driverLicenseExpiresAt: new Date('2030-01-01'),
      birthDate: new Date('1990-01-01'),
      driverCategories: [],
      createdByUserId: userId,
    },
  });
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
  const storageRoot = process.env.PRIVATE_STORAGE_ROOT?.trim();
  if (storageRoot) {
    const root = resolve(storageRoot);
    for (const companyId of created.companyIds) {
      const companyStorage = resolve(root, 'companies', companyId);
      const withinRoot = relative(root, companyStorage);
      if (!withinRoot.startsWith('..') && !isAbsolute(withinRoot)) {
        await rm(companyStorage, { recursive: true, force: true });
      }
    }
  }
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
  await page.getByLabel('Выдача (Москва)').fill('2026-09-10T10:00');
  await page.getByLabel('Возврат (Москва)').fill('2026-09-12T10:00');
  await page.getByLabel('Адрес выдачи').fill('Москва, DEMO ONLY, выдача');
  await page.getByLabel('Адрес возврата').fill('Москва, DEMO ONLY, возврат');
  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.getByText('Черновик договора сохранён.')).toBeVisible();
}

async function uploadRequiredClientDocuments(page: Page, clientId: string) {
  await page.goto(`/clients/${clientId}?tab=documents`);
  await expect(page.getByTestId('client-documents-panel')).toBeVisible();
  for (const [category, title] of [
    ['PASSPORT', 'E2E паспорт'],
    ['DRIVER_LICENSE', 'E2E водительское удостоверение'],
  ] as const) {
    await page.getByLabel(/Категория документа/u).selectOption(category);
    await page.getByLabel(/Название документа/u).fill(title);
    await page.getByLabel('Файл документа').setInputFiles({
      name: `${category.toLowerCase()}.png`,
      mimeType: 'image/png',
      buffer: safePng,
    });
    await page.getByRole('button', { name: 'Загрузить документ' }).click();
    await expect(
      page.locator('article[data-document-status]').filter({ hasText: title }),
    ).toContainText('Проверен');
  }
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
    await page.getByLabel('Файл Excel').setInputFiles({
      name: 'canonical-four.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: canonicalFourWorkbook(),
    });
    await page.getByRole('button', { name: 'Подготовить предпросмотр' }).click();
    const preview = page.getByRole('table');
    await expect(preview.locator('tbody tr')).toHaveCount(4);
    await page.getByRole('button', { name: 'Применить импорт' }).click();
    await expect(page.getByRole('status')).toContainText(/Импорт завершён/u);
  });

  test('dispatcher проходит полный путь от документов клиента до выдачи', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Полный mutation-flow выполняется один раз.');
    await signInAs(page, fixture.dispatcher.email);
    await uploadRequiredClientDocuments(page, fixture.admin.clientId);

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

    const pdfHref = await pdf.getAttribute('href');
    const rentalId = pdfHref?.match(/\/rentals\/([^/]+)\/documents/u)?.[1];
    expect(rentalId).toBeTruthy();
    const rental = await prisma.rental.findUniqueOrThrow({
      where: { id: rentalId },
      select: { totalPriceMinor: true, depositMinor: true },
    });
    await page.goto(`/rentals/${rentalId}`);

    const paymentForm = page.locator('form').filter({
      has: page.getByRole('heading', { name: 'Записать оплату' }),
    });
    await paymentForm.locator('select[name="kind"]').selectOption('RENT');
    await paymentForm
      .locator('input[name="amountRubles"]')
      .fill(String(Number(rental.totalPriceMinor) / 100));
    await paymentForm.getByRole('button', { name: 'Записать оплату' }).click();
    await expect(paymentForm.getByRole('status')).toHaveText('Оплата записана.');
    await paymentForm.locator('select[name="kind"]').selectOption('DEPOSIT');
    await paymentForm
      .locator('input[name="amountRubles"]')
      .fill(String(Number(rental.depositMinor ?? BigInt(0)) / 100));
    await paymentForm.getByRole('button', { name: 'Записать оплату' }).click();
    await expect(paymentForm.getByRole('status')).toHaveText('Оплата записана.');

    const signatureForm = page.locator('form').filter({
      has: page.getByRole('heading', { name: 'Отметить подпись' }),
    });
    for (const party of ['CLIENT', 'COMPANY'] as const) {
      await signatureForm.locator('select[name="party"]').selectOption(party);
      await signatureForm.locator('input[name="signedByName"]').fill(`E2E ${party}`);
      await signatureForm.getByRole('button', { name: 'Отметить подпись' }).click();
      await expect(signatureForm.getByRole('status')).toHaveText('Статус подписи сохранён.');
    }

    const handoverButton = page
      .getByTestId('rental-action-rail')
      .getByRole('button', { name: 'Выдать / Подать' });
    await expect(handoverButton).toBeEnabled();
    await handoverButton.click();
    await page.getByLabel('Пробег, км').fill('10000');
    await page.getByLabel('Топливо, %').fill('80');
    await page.getByLabel('Причина отсутствия фиксации').fill('E2E без медиа');
    await page.getByLabel('Сумма залога, коп.').fill(String(rental.depositMinor ?? BigInt(0)));
    await page
      .getByRole('dialog', { name: 'Выдать / Подать автомобиль' })
      .getByRole('button', { name: 'Сохранить' })
      .click();
    await expect(page.getByRole('dialog', { name: 'Выдать / Подать автомобиль' })).toHaveCount(0);
    await expect
      .poll(async () => prisma.rental.count({ where: { id: rentalId, status: 'ACTIVE' } }))
      .toBe(1);

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
    await page.goto('/rentals');
    await expect(page.getByTestId('rental-list-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Договоры аренды' })).toBeVisible();
    await expect(page.getByLabel('Договоры, требующие внимания')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.goto('/rentals?view=calendar&month=2026-08');
    await expect(page.getByTestId('rental-calendar-agenda')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByTestId('rental-calendar-agenda')).toBeVisible();

    await page.goto('/rentals?query=__rental_e2e_loading__', { waitUntil: 'commit' });
    await expect(page.locator('[aria-label="Загрузка договоров аренды"]')).toBeVisible();
  });
});
