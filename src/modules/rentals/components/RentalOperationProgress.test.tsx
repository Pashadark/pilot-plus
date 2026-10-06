// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RentalOperationProgress } from './RentalOperationProgress';

describe('RentalOperationProgress', () => {
  it('lists selected evidence and announces the combined upload and close stage', () => {
    render(
      <RentalOperationProgress
        pending
        video={{ name: 'осмотр.mp4', size: 26_214_400 }}
        photo={{ name: 'панель.jpg', size: 2_097_152 }}
      />,
    );

    expect(screen.getByText('осмотр.mp4')).toBeTruthy();
    expect(screen.getByText('25 МБ')).toBeTruthy();
    expect(screen.getByText('панель.jpg')).toBeTruthy();
    expect(screen.getByText('2 МБ')).toBeTruthy();
    expect(screen.getByText('Загружаем файлы')).toBeTruthy();
    expect(screen.getByText('Закрываем аренду')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Не закрывайте страницу');
  });
});
