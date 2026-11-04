// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OnlineFleetMapClient } from './OnlineFleetMapClient';
import type { OnlineFleetMapProps } from './OnlineFleetMap';

vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, options: { loading: () => React.ReactNode }) => options.loading,
}));

describe('OnlineFleetMapClient loading backdrop', () => {
  it('показывает общий точечный паттерн, пока загружается модуль карты', () => {
    render(<OnlineFleetMapClient {...({} as OnlineFleetMapProps)} />);

    const backdrop = screen.getByRole('status', { name: 'Карта загружается' });
    expect(backdrop.className).toContain('mapLoadingPattern');
  });

  it('использует утверждённые цвета светлой и тёмной темы', () => {
    const css = readFileSync(
      resolve('src/modules/online-map/components/OnlineFleetMap.module.css'),
      'utf8',
    ).toLowerCase();

    expect(css).toContain('--map-loading-background: #e0efff');
    expect(css).toContain('--map-loading-background: #343438');
    expect(css).toContain('--map-loading-accent: #0067ff');
  });
});
