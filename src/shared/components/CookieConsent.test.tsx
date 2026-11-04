// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { CookieConsent } from './CookieConsent';

beforeEach(() => localStorage.clear());
afterEach(cleanup);
it.each([
  ['Принять', 'accepted'],
  ['Отклонить', 'declined'],
])('persists %s without repeating the banner', async (button, value) => {
  const user = userEvent.setup();
  const view = render(<CookieConsent />);
  expect(screen.getByRole('region', { name: 'Cookie' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: button }));
  expect(localStorage.getItem('pilot-cookie-choice-v1')).toBe(value);
  expect(screen.queryByRole('region', { name: 'Cookie' })).toBeNull();
  view.unmount();
  render(<CookieConsent />);
  expect(screen.queryByRole('region', { name: 'Cookie' })).toBeNull();
});
it('explains essential cookies without claiming analytics are running', async () => {
  render(<CookieConsent />);
  await userEvent.click(screen.getByRole('button', { name: 'Подробнее' }));
  expect(screen.getByText(/Аналитические cookie сейчас не используются/)).toBeTruthy();
});
