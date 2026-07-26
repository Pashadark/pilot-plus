import { expect, type Locator, type Page } from '@playwright/test';

export async function expectExactCalendarUrl(
  page: Page,
  pathname: '/maintenance' | '/wash',
  month: string,
) {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return `${url.pathname}?${url.searchParams.toString()}`;
    })
    .toBe(`${pathname}?source=e2e&view=calendar&month=${month}`);
}

export async function submitOperationForm({
  page,
  dialog,
  pathname,
  saveButtonName,
  successText,
}: {
  page: Page;
  dialog: Locator;
  pathname: '/maintenance' | '/wash';
  saveButtonName: 'Сохранить ТО' | 'Сохранить мойку';
  successText: 'ТО запланировано.' | 'Мойка запланирована.';
}) {
  await expect(dialog).toBeVisible();
  const saveButton = dialog.getByRole('button', { name: saveButtonName });
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled();

  const serverActionResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === 'POST' &&
      new URL(response.url()).pathname === pathname &&
      Boolean(request.headers()['next-action'])
    );
  });

  await saveButton.click();
  const response = await serverActionResponse;
  expect(response.ok()).toBe(true);
  await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
  await expect(dialog).toBeHidden();

  const toast = page.locator('[data-toast-tone="success"]').filter({ hasText: successText });
  await expect(toast).toHaveCount(1);
  await expect(toast).toBeVisible();
  return toast;
}

export async function closeToastAndWait(toast: Locator) {
  await toast.getByRole('button', { name: 'Закрыть уведомление' }).click();
  await expect(toast).toHaveCount(0);
}
