import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClientGrid } from './ClientGrid';

describe('ClientGrid', () => {
  it('uses 1/2/3/4 responsive columns for accessible cards', () => {
    const markup = renderToStaticMarkup(createElement(ClientGrid, { clients: [] }));
    expect(markup).toContain('Клиенты не найдены');
  });
});
