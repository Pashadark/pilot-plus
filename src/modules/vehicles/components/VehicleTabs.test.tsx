import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    scroll,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { scroll?: boolean }) =>
    createElement('a', { ...props, 'data-scroll': String(scroll) }),
}));

import { VehicleTabs } from './VehicleTabs';

describe('VehicleTabs navigation', () => {
  it('сохраняет позицию прокрутки при переключении вкладок', () => {
    const markup = renderToStaticMarkup(
      createElement(VehicleTabs, { vehicleId: 'vehicle-1', activeTab: 'overview' }),
    );

    expect(markup.match(/data-scroll="false"/g)).toHaveLength(9);
  });
});
