import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ForbiddenState } from './ForbiddenState';

describe('ForbiddenState', () => {
  it('предоставляет готовое русское состояние 403 со щитом и действием на главную', () => {
    const markup = renderToStaticMarkup(createElement(ForbiddenState));

    expect(markup).toContain('403');
    expect(markup).toContain('Доступ ограничен');
    expect(markup).toContain('У вас нет прав для просмотра этого раздела.');
    expect(markup).toContain('data-testid="forbidden-shield-icon"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain('На главную');
    expect(markup).toContain('var(--color-warning)');
  });
});
