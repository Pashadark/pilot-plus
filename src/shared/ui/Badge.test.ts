import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Badge } from './Badge';

describe('Badge', () => {
  it('поддерживает размеры дизайн-системы', () => {
    const html = renderToStaticMarkup(createElement(Badge, { size: 'lg' }, 'В движении'));

    expect(html).toContain('min-h-9');
    expect(html).toContain('В движении');
  });

  it('поддерживает фирменный сервисный тон в обеих темах через токены', () => {
    const html = renderToStaticMarkup(createElement(Badge, { tone: 'service' }, 'В сервисе'));

    expect(html).toContain('--color-service-soft');
    expect(html).toContain('--color-service');
  });
});
