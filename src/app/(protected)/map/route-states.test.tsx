// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import OnlineMapError from './error';
import OnlineMapLoading from './loading';

vi.mock('@/shared/components/app-shell/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(cleanup);

it('loading сохраняет геометрию карты, контролов и адаптивной панели', () => {
  render(<OnlineMapLoading />);

  const workspace = screen.getByRole('main', { name: 'Загрузка онлайн-карты' });
  expect(workspace.className).toContain('h-[calc(100dvh-var(--header-height))]');
  expect(workspace.className).toContain('@container');

  const panel = screen.getByRole('complementary', {
    name: 'Загрузка панели выбранного автомобиля',
  });
  expect(panel.className).toContain('right-0');
  expect(panel.className).toContain('@min-[48rem]:w-80');
});

it('error объявляет ошибку, не показывает undefined и запускает повтор', async () => {
  const user = userEvent.setup();
  const unstableRetry = vi.fn();

  render(<OnlineMapError error={new Error('секретная ошибка')} unstable_retry={unstableRetry} />);

  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Не удалось загрузить онлайн-карту' })).toBeTruthy();
  expect(screen.queryByText(/undefined/)).toBeNull();

  await user.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(unstableRetry).toHaveBeenCalledOnce();
});

it('error показывает безопасный код обращения только при наличии digest', () => {
  render(
    <OnlineMapError
      error={Object.assign(new Error('секретная ошибка'), { digest: 'map-123' })}
      unstable_retry={() => undefined}
    />,
  );

  expect(screen.getByText(/Код обращения: map-123/)).toBeTruthy();
});
