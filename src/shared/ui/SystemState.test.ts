import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { safeErrorReference, SystemState } from './SystemState';

describe('SystemState', () => {
  it('показывает семантический заголовок, русское описание и оба действия', () => {
    const markup = renderToStaticMarkup(
      createElement(SystemState, {
        code: '404',
        tone: 'primary',
        title: 'Страница не найдена',
        description: 'Проверьте адрес или вернитесь к работе с автопарком.',
        primaryAction: createElement('a', { href: '/' }, 'На главную'),
        secondaryAction: createElement('button', { type: 'button' }, 'Назад'),
      }),
    );

    expect(markup).toContain('<h1');
    expect(markup).toContain('Страница не найдена</h1>');
    expect(markup).toContain('Проверьте адрес или вернитесь к работе с автопарком.');
    expect(markup).toContain('На главную');
    expect(markup).toContain('Назад');
    expect(markup).toContain('[&amp;&gt;*]:inline-flex');
    expect(markup).toContain('[&amp;&gt;*]:items-center');
    expect(markup).toContain('[&amp;&gt;*]:justify-center');
    expect(markup).toContain('[&amp;&gt;*]:min-h-11');
    expect(markup).toContain('[&amp;&gt;*]:min-w-11');
    expect(markup).not.toContain('role="alert"');
  });

  it('использует alert только для опасного состояния', () => {
    const markup = renderToStaticMarkup(
      createElement(SystemState, {
        code: '500',
        tone: 'danger',
        title: 'Сервис временно недоступен',
        description: 'Повторите попытку позже.',
      }),
    );

    expect(markup).toContain('role="alert"');
  });
});

describe('safeErrorReference', () => {
  it('возвращает только непустой digest и не раскрывает сообщение ошибки', () => {
    expect(safeErrorReference({ message: 'DATABASE_URL=secret', digest: 'abc-123' })).toBe(
      'abc-123',
    );
    expect(safeErrorReference({ message: 'secret' })).toBeUndefined();
    expect(safeErrorReference({ digest: '   ' })).toBeUndefined();
  });
});
