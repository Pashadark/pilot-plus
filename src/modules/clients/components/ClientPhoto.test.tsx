import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClientPhoto } from './ClientPhoto';

describe('ClientPhoto', () => {
  it('prefers a local photo over a confirmed messenger avatar', () => {
    const markup = renderToStaticMarkup(
      createElement(ClientPhoto, {
        name: 'Анна Воронова',
        localPhotoUrl: '/uploads/clients/anna.webp',
        confirmedMessengerAvatarUrl: 'https://cdn.example.test/anna.webp',
      }),
    );
    expect(markup).toContain('data-source="local"');
    expect(markup).toContain('src="/uploads/clients/anna.webp"');
  });

  it.each(['//evil.example/avatar.webp', 'https://evil.example/avatar.webp'])(
    'rejects an unapproved local path and never renders a remote messenger avatar: %s',
    (url) => {
      const markup = renderToStaticMarkup(
        createElement(ClientPhoto, {
          name: 'Анна Воронова',
          localPhotoUrl: url,
          confirmedMessengerAvatarUrl: 'https://messenger.example/avatar.webp',
        }),
      );

      expect(markup).toContain('data-source="placeholder"');
      expect(markup).not.toContain('messenger.example');
      expect(markup).not.toContain('evil.example');
    },
  );
});
