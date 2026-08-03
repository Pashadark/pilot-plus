// @vitest-environment jsdom

import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Avatar, StatusIndicator } from './DataDisplay';

describe('компоненты отображения данных', () => {
  it('поддерживает компактный аватар', () => {
    const html = renderToStaticMarkup(createElement(Avatar, { name: 'Павел Седов', size: 'sm' }));

    expect(html).toContain('size-9');
    expect(html).toContain('ПС');
  });

  it('строит не более двух инициалов из имени', () => {
    render(createElement(Avatar, { name: 'Павел Александрович Седов' }));

    expect(screen.getByRole('img', { name: 'Павел Александрович Седов' }).textContent).toBe('ПА');
  });

  it('после ошибки фотографии показывает инициалы', () => {
    render(createElement(Avatar, { name: 'Павел Седов', src: '/missing.webp' }));
    expect(screen.getByRole('img', { name: 'Павел Седов' }).querySelector('img')).not.toBeNull();
    fireEvent.error(screen.getByRole('img', { name: 'Павел Седов' }));

    expect(screen.getByRole('img', { name: 'Павел Седов' }).textContent).toBe('ПС');
  });

  it('показывает основной статус без обязательной подписи', () => {
    const html = renderToStaticMarkup(createElement(StatusIndicator, { tone: 'primary' }));

    expect(html).toContain('var(--color-primary)');
  });
});
