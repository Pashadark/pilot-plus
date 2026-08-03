// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('отрисовывает определённые необязательные ReactNode, включая ноль', () => {
    render(<PageHeader eyebrow={0} title="Заголовок" description={0} actions={0} />);

    expect(screen.getAllByText('0')).toHaveLength(3);
  });
});
