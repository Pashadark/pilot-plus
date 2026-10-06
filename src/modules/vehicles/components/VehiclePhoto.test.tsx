// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { VehiclePhoto } from './VehiclePhoto';

afterEach(cleanup);

describe('VehiclePhoto', () => {
  it('загружает защищённое фото напрямую с пользовательской сессией', () => {
    render(
      <VehiclePhoto
        image={{ localPath: '/vehicles/vehicle-1/images/image-1', alt: 'Kia Rio' }}
        model="Kia Rio"
        city="Москва"
        sizes="100vw"
      />,
    );

    const source = screen.getByRole('img', { name: 'Kia Rio' }).getAttribute('src');
    expect(source).not.toContain('/_next/image');
    expect(new URL(source ?? '', 'http://localhost').pathname).toBe(
      '/vehicles/vehicle-1/images/image-1',
    );
    expect(screen.getByRole('img', { name: 'Kia Rio' }).className).not.toContain('group-hover');
  });
});
