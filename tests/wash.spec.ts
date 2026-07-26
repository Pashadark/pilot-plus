import { expect, test, type Locator } from '@playwright/test';

import { openAuthenticatedRoute } from './helpers/auth';
import {
  closeToastAndWait,
  expectExactCalendarUrl,
  submitOperationForm,
} from './helpers/operations-calendar';
import { cleanupE2EWashRecords, E2E_WASH_PROVIDER_PREFIX } from './helpers/wash';

function formatMoscowDate(value: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localDateTimeToday() {
  return `${formatMoscowDate(new Date())}T12:00`;
}

function localDateTimeTomorrow() {
  return `${formatMoscowDate(new Date(Date.now() + 24 * 60 * 60 * 1000))}T12:00`;
}

function localDateTimeInDays(days: number) {
  return `${formatMoscowDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000))}T12:00`;
}

function formatMoscowMonth(value = new Date()) {
  return formatMoscowDate(value).slice(0, 7);
}

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
}

const calendarDayFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  weekday: 'long',
  year: 'numeric',
});

function calendarEventAccessibleName(
  localDateTime: string,
  title: string,
  vehicle: string,
  status: string,
) {
  const [datePart, time] = localDateTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  const dayLabel = calendarDayFormatter.format(date);
  const capitalizedDayLabel = `${dayLabel[0]?.toUpperCase() ?? ''}${dayLabel.slice(1)}`;

  return `${capitalizedDayLabel}, ${time}, ${title}, ${vehicle}, статус: ${status}`;
}

test.afterAll(async () => {
  await cleanupE2EWashRecords();
});

test('администратор планирует, фильтрует и завершает мойку', async ({ page }) => {
  const currentMonth = formatMoscowMonth();
  await openAuthenticatedRoute(page, '/wash?source=e2e&view=calendar&month=2026-12');

  await expect(page.getByTestId('wash-page')).toBeVisible();
  await expectExactCalendarUrl(page, '/wash', '2026-12');
  await expect(page.getByTestId('app-header')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Мойка автомобилей', level: 1 })).toBeVisible();
  await expect(
    page.getByTestId('wash-today-stat').getByText('Сегодня', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('В работе', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Завершено за месяц', { exact: true })).toBeVisible();
  await expect(page.getByText('Требуют мойки', { exact: true })).toBeVisible();
  await expect(page.getByTestId('operations-calendar-grid')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Календарь' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Следующий месяц' }).click();
  await expectExactCalendarUrl(page, '/wash', '2027-01');
  await page.getByRole('button', { name: 'Предыдущий месяц' }).click();
  await expectExactCalendarUrl(page, '/wash', '2026-12');
  await page.getByRole('button', { name: 'Сегодня' }).click();
  await expectExactCalendarUrl(page, '/wash', currentMonth);
  await page.goto('/wash?source=e2e&view=calendar&month=invalid');
  await expectExactCalendarUrl(page, '/wash', currentMonth);
  await page.getByRole('tab', { name: 'Список' }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(page).toHaveURL(/source=e2e/);
  await expect(page).not.toHaveURL(/month=/);
  await page.getByRole('tab', { name: 'Календарь' }).click();
  await expect(page).toHaveURL(/view=calendar/);
  await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
  await page.getByRole('tab', { name: 'Список' }).click();
  const needsWashStat = page.getByTestId('wash-needs-wash-stat');
  const initialNeedsWashCount = Number(await needsWashStat.locator('strong').textContent());
  expect(Number.isFinite(initialNeedsWashCount)).toBe(true);
  const todayStat = page.getByTestId('wash-today-stat');
  const initialTodayCount = Number(await todayStat.locator('strong').textContent());
  expect(Number.isFinite(initialTodayCount)).toBe(true);
  const scheduledToday = localDateTimeToday();

  const provider = `${E2E_WASH_PROVIDER_PREFIX}desktop-${Date.now()}`;
  await page.getByRole('button', { name: 'Запланировать мойку' }).click();
  const washDialog = page.getByRole('dialog', { name: 'Запланировать мойку' });
  await expect(washDialog).toBeVisible();
  await washDialog.getByLabel('Автомобиль').selectOption({ index: 1 });
  const selectedVehicleLabel = (
    await washDialog.getByLabel('Автомобиль').locator('option:checked').textContent()
  )?.trim();
  if (!selectedVehicleLabel) throw new Error('Не удалось определить выбранный автомобиль.');
  await expect(washDialog.locator('img')).toBeVisible();
  await washDialog.getByLabel('Тип мойки').selectOption('COMPLEX');
  await washDialog.getByLabel('Плановая дата').fill(scheduledToday);
  await washDialog.getByLabel('Мойка или подрядчик').fill(provider);
  const plannedToast = await submitOperationForm({
    page,
    dialog: washDialog,
    pathname: '/wash',
    saveButtonName: 'Сохранить мойку',
    successText: 'Мойка запланирована.',
  });
  await expect(todayStat.getByText(String(initialTodayCount + 1), { exact: true })).toBeVisible();
  await closeToastAndWait(plannedToast);

  await page.getByRole('tab', { name: 'Календарь' }).click();
  await page.getByRole('button', { name: 'Сегодня' }).click();
  const candidateName = calendarEventAccessibleName(
    scheduledToday,
    'Комплексная',
    selectedVehicleLabel,
    'Запланировано',
  );
  const calendarCandidates = page
    .getByTestId('operations-calendar-grid')
    .getByRole('button', { name: candidateName, exact: true });
  const candidateCount = await calendarCandidates.count();
  expect(candidateCount).toBeGreaterThan(0);

  const calendarDialog = page.getByRole('dialog', { name: 'Комплексная', exact: true });
  let matchedProvider = false;
  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    await calendarCandidates.nth(candidateIndex).click();
    await expect(calendarDialog).toBeVisible();
    if (await calendarDialog.getByText(provider, { exact: true }).isVisible()) {
      matchedProvider = true;
      break;
    }
    await calendarDialog.getByRole('button', { name: 'Закрыть' }).click();
    await expect(calendarDialog).toBeHidden();
  }
  expect(matchedProvider).toBe(true);
  await expect(calendarDialog.getByText(provider, { exact: true })).toBeVisible();
  const calendarStatus = calendarDialog.getByText('Запланировано', { exact: true });
  await expect(calendarStatus).toBeVisible();
  await expect(calendarStatus.locator('svg')).toBeVisible();
  await expect(calendarDialog.getByRole('button', { name: 'Начать мойку' })).toBeVisible();
  await calendarDialog.getByRole('button', { name: 'Закрыть' }).click();
  await page.getByRole('tab', { name: 'Список' }).click();

  const cancelledProvider = `${E2E_WASH_PROVIDER_PREFIX}cancel-${Date.now()}`;
  await page.getByRole('button', { name: 'Запланировать мойку' }).click();
  const cancelDialog = page.getByRole('dialog', { name: 'Запланировать мойку' });
  await cancelDialog.getByLabel('Автомобиль').selectOption({ index: 2 });
  await cancelDialog.getByLabel('Тип мойки').selectOption('INTERIOR');
  await cancelDialog.getByLabel('Плановая дата').fill(localDateTimeTomorrow());
  await cancelDialog.getByLabel('Мойка или подрядчик').fill(cancelledProvider);
  const cancelToast = await submitOperationForm({
    page,
    dialog: cancelDialog,
    pathname: '/wash',
    saveButtonName: 'Сохранить мойку',
    successText: 'Мойка запланирована.',
  });
  await closeToastAndWait(cancelToast);

  await page.getByRole('searchbox', { name: 'Поиск по мойке' }).fill(E2E_WASH_PROVIDER_PREFIX);
  await page.getByLabel('Статус').selectOption('PLANNED');
  await page.getByLabel('Вид мойки').selectOption('');

  const record = page.getByTestId('wash-record').filter({ hasText: provider });
  const otherRecord = page.getByTestId('wash-record').filter({ hasText: cancelledProvider });
  await expect(record).toHaveCount(1);
  await expect(otherRecord).toHaveCount(1);
  const plannedBadge = record.getByText('Запланировано', { exact: true });
  await expect(plannedBadge).toBeVisible();
  await expect(plannedBadge.locator('svg')).toBeVisible();
  await expect(record.getByText('Требует мойки', { exact: true })).toBeVisible();

  let releaseTransition = () => {};
  const transitionGate = new Promise<void>((resolve) => {
    releaseTransition = resolve;
  });
  let transitionHeld = false;
  await page.route('**/wash**', async (route) => {
    if (!transitionHeld && route.request().method() === 'POST') {
      transitionHeld = true;
      await transitionGate;
    }
    await route.continue();
  });

  const startTransition = record.getByRole('button', { name: 'Начать мойку' }).click();
  await expect(record.getByRole('button', { name: 'Обновляем…' })).toBeVisible();
  await expect(record.getByRole('button', { name: 'Отменить' })).toBeDisabled();
  await expect(otherRecord.getByText('Обновляем…')).toHaveCount(0);
  await expect(otherRecord.getByRole('button', { name: 'Начать мойку' })).toBeDisabled();
  releaseTransition();
  await startTransition;
  await page.unroute('**/wash**');
  await expect(record).toHaveCount(0);
  const transitionToast = page
    .locator('[data-toast-tone="success"]')
    .filter({ hasText: 'Статус мойки обновлён.' });
  await expect(transitionToast).toBeVisible();
  await page.getByLabel('Статус').selectOption('IN_PROGRESS');
  await expect(record.getByText('В работе', { exact: true })).toBeVisible();
  await expect(todayStat.getByText(String(initialTodayCount + 1), { exact: true })).toBeVisible();

  await closeToastAndWait(transitionToast);
  await record.getByRole('button', { name: 'Завершить мойку' }).click();
  await expect(record).toHaveCount(0);
  await expect(transitionToast).toBeVisible();
  await page.getByLabel('Статус').selectOption('COMPLETED');
  await expect(record.getByText('Завершено', { exact: true })).toBeVisible();
  await expect(record.getByText('Чистый', { exact: true })).toBeVisible();
  await expect(needsWashStat.locator('strong')).toHaveText(String(initialNeedsWashCount - 1));
  await expect(todayStat.getByText(String(initialTodayCount), { exact: true })).toBeVisible();

  await closeToastAndWait(transitionToast);
  await page.getByRole('searchbox', { name: 'Поиск по мойке' }).fill(cancelledProvider);
  await page.getByLabel('Статус').selectOption('PLANNED');
  await page.getByLabel('Вид мойки').selectOption('INTERIOR');
  const cancelledRecord = page.getByTestId('wash-record').filter({ hasText: cancelledProvider });
  await cancelledRecord.getByRole('button', { name: 'Отменить' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Отменить мойку?' });
  await expect(confirmation).toBeVisible();
  await expect(cancelledRecord.getByText('Запланировано', { exact: true })).toBeVisible();
  await expect(transitionToast).toBeHidden();

  await confirmation.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(confirmation).toBeHidden();
  await expect(cancelledRecord).toHaveCount(0);
  await expect(transitionToast).toBeVisible();
  await page.getByLabel('Статус').selectOption('CANCELLED');
  await expect(cancelledRecord.getByText('Отменено', { exact: true })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Поиск по мойке' }).fill('нет-такой-мойки');
  const desktopTable = page.getByTestId('wash-desktop-table');
  await expect(desktopTable.getByText('Записи не найдены', { exact: true })).toBeVisible();
  await expect(
    desktopTable.getByText('Измените поиск или фильтры.', { exact: true }),
  ).toBeVisible();
});

test('мобильная страница мойки не переполняет экран и сохраняет touch targets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAuthenticatedRoute(page, '/wash');

  await expect(page.getByTestId('wash-page')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  const createButton = page.getByRole('button', { name: 'Запланировать мойку' });
  expect((await createButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(page.getByTestId('wash-desktop-table')).toBeHidden();
  await expect(page.getByTestId('wash-mobile-list')).toBeVisible();

  await createButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  for (const control of await dialog
    .locator('input:not([type="hidden"]), select, textarea, button')
    .all()) {
    expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  const provider = `${E2E_WASH_PROVIDER_PREFIX}mobile-${Date.now()}`;
  const scheduledDateTime = localDateTimeInDays(2);
  await page.getByLabel('Автомобиль').selectOption({ index: 1 });
  const selectedVehicleLabel = (
    await page.getByLabel('Автомобиль').locator('option:checked').textContent()
  )?.trim();
  if (!selectedVehicleLabel) throw new Error('Не удалось определить выбранный автомобиль.');
  await expect(dialog.locator('img')).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByLabel('Тип мойки').selectOption('BODY');
  await page.getByLabel('Плановая дата').fill(scheduledDateTime);
  await page.getByLabel('Мойка или подрядчик').fill(provider);
  const firstCreateToast = await submitOperationForm({
    page,
    dialog,
    pathname: '/wash',
    saveButtonName: 'Сохранить мойку',
    successText: 'Мойка запланирована.',
  });
  await closeToastAndWait(firstCreateToast);

  await page.getByRole('searchbox', { name: 'Поиск по мойке' }).fill(provider);
  const record = page.getByTestId('wash-mobile-record').filter({ hasText: provider });
  await expect(record).toBeVisible();
  await expect(record.getByText('Запланировано', { exact: true })).toBeVisible();
  for (const action of await record.getByRole('button').all()) {
    expect((await action.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  for (let index = 2; index <= 4; index += 1) {
    await page.getByRole('button', { name: 'Запланировать мойку' }).click();
    const overflowDialog = page.getByRole('dialog', { name: 'Запланировать мойку' });
    await expect(overflowDialog).toBeVisible();
    await overflowDialog.getByLabel('Автомобиль').selectOption({ index: 1 });
    await overflowDialog.getByLabel('Тип мойки').selectOption('BODY');
    await overflowDialog.getByLabel('Плановая дата').fill(scheduledDateTime);
    await overflowDialog
      .getByLabel('Мойка или подрядчик')
      .fill(`${E2E_WASH_PROVIDER_PREFIX}mobile-${Date.now()}-${index}`);
    const toast = await submitOperationForm({
      page,
      dialog: overflowDialog,
      pathname: '/wash',
      saveButtonName: 'Сохранить мойку',
      successText: 'Мойка запланирована.',
    });
    await closeToastAndWait(toast);
  }

  await page.getByRole('tab', { name: 'Календарь' }).click();
  const scheduledMonth = scheduledDateTime.slice(0, 7);
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('calendar');
  await expect.poll(() => new URL(page.url()).searchParams.get('month')).not.toBeNull();
  const displayedMonth = new URL(page.url()).searchParams.get('month');
  if (displayedMonth !== scheduledMonth) {
    await page
      .getByRole('button', {
        name: scheduledMonth > (displayedMonth ?? '') ? 'Следующий месяц' : 'Предыдущий месяц',
      })
      .click();
  }
  await expect.poll(() => new URL(page.url()).searchParams.get('month')).toBe(scheduledMonth);
  await page.reload();
  const agenda = page.getByTestId('operations-calendar-agenda');
  await expect(agenda).toBeVisible();
  await expect(page.getByTestId('operations-calendar-grid')).toBeHidden();
  const overflowButton = agenda.getByRole('button', { name: 'Ещё 1' });
  await expect(overflowButton).toBeVisible();
  await overflowButton.click();
  await expect(agenda.getByRole('button', { name: 'Скрыть' })).toBeVisible();

  for (const monthControl of [
    page.getByRole('button', { name: 'Предыдущий месяц' }),
    page.getByRole('button', { name: 'Сегодня' }),
    page.getByRole('button', { name: 'Следующий месяц' }),
  ]) {
    await expectTouchTarget(monthControl);
  }

  const candidateName = calendarEventAccessibleName(
    scheduledDateTime,
    'Кузов',
    selectedVehicleLabel,
    'Запланировано',
  );
  const calendarCandidates = agenda.getByRole('button', {
    name: candidateName,
    exact: true,
  });
  const candidateCount = await calendarCandidates.count();
  expect(candidateCount).toBeGreaterThan(0);

  const detailsDialog = page.getByRole('dialog', { name: 'Кузов', exact: true });
  let matchedProvider = false;
  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    const candidate = calendarCandidates.nth(candidateIndex);
    await expectTouchTarget(candidate);
    await candidate.focus();
    await page.keyboard.press('Enter');
    await expect(detailsDialog).toBeVisible();
    if (await detailsDialog.getByText(provider, { exact: true }).isVisible()) {
      matchedProvider = true;
      break;
    }
    await detailsDialog.getByRole('button', { name: 'Закрыть' }).click();
    await expect(detailsDialog).toBeHidden();
  }
  expect(matchedProvider).toBe(true);
  expect(
    await detailsDialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
