import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Avatar, StatusIndicator } from './DataDisplay';

describe('компоненты отображения данных', () => {
  it('поддерживает компактный аватар', () => {
    const html = renderToStaticMarkup(createElement(Avatar, { name: 'Павел Седов', size: 'sm' }));

    expect(html).toContain('size-9');
    expect(html).toContain('ПС');
  });

  it('показывает основной статус без обязательной подписи', () => {
    const html = renderToStaticMarkup(createElement(StatusIndicator, { tone: 'primary' }));

    expect(html).toContain('var(--color-primary)');
  });
});
