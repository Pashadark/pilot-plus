// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ClientPhoto } from './ClientPhoto';

describe('ClientPhoto', () => {
  afterEach(cleanup);

  it('prefers a local photo over a confirmed messenger avatar', () => {
    render(
      <ClientPhoto
        name="Анна Воронова"
        localPhotoUrl="/uploads/clients/anna.webp"
        confirmedMessengerAvatarUrl="https://cdn.example.test/anna.webp"
      />,
    );

    expect(screen.getByTestId('client-photo').getAttribute('data-source')).toBe('local');
    expect(
      screen.getByRole('img', { name: 'Фото клиента Анна Воронова' }).getAttribute('src'),
    ).toBe('/uploads/clients/anna.webp');
  });

  it('accepts only the protected same-origin client photo route', () => {
    render(<ClientPhoto name="Анна Воронова" localPhotoUrl="/clients/client-1/photo?v=m1abc" />);

    expect(screen.getByTestId('client-photo').getAttribute('data-source')).toBe('local');
    expect(screen.getByRole('img').getAttribute('src')).toBe('/clients/client-1/photo?v=m1abc');
  });

  it('recovers from a failed protected photo when its opaque revision changes', () => {
    const { rerender } = render(
      <ClientPhoto name="Анна Воронова" localPhotoUrl="/clients/client-1/photo?v=revision1" />,
    );

    fireEvent.error(screen.getByRole('img'));

    const photo = screen.getByTestId('client-photo');
    expect(photo.getAttribute('data-source')).toBe('placeholder');
    expect(photo.querySelector('img')).toBeNull();
    expect(
      screen.getByRole('img', { name: 'Фото клиента Анна Воронова пока не добавлено' }),
    ).not.toBeNull();

    rerender(
      <ClientPhoto name="Анна Воронова" localPhotoUrl="/clients/client-1/photo?v=revision2" />,
    );
    expect(photo.getAttribute('data-source')).toBe('local');
    expect(photo.querySelector('img')?.getAttribute('src')).toBe(
      '/clients/client-1/photo?v=revision2',
    );
  });

  it.each([
    '//evil.example/avatar.webp',
    'https://evil.example/avatar.webp',
    '/clients/client-1/photo?v=unsafe%2Fpath',
  ])('rejects an unapproved local path and never renders a remote messenger avatar: %s', (url) => {
    render(
      <ClientPhoto
        name="Анна Воронова"
        localPhotoUrl={url}
        confirmedMessengerAvatarUrl="https://messenger.example/avatar.webp"
      />,
    );

    expect(screen.getByTestId('client-photo').getAttribute('data-source')).toBe('placeholder');
    expect(document.body.innerHTML).not.toContain('messenger.example');
    expect(document.body.innerHTML).not.toContain('evil.example');
  });
});
