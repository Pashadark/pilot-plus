// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CompanyProfileCard } from './CompanyProfileCard';

afterEach(cleanup);

const company = {
  id: 'company-1',
  name: 'ООО «Север Транс Мониторинг»',
  inn: '2465357184',
  kpp: '246501001',
  ogrn: '1242400017356',
  directorName: 'Александр Сергеевич Лебедев',
  legalAddress: 'Красноярск, ул. Карла Маркса, д. 93',
  actualAddress: 'Красноярск, ул. Шахтёров, д. 33',
  phone: '+7 (391) 205-17-40',
  email: 'office@sever-trans.demo',
  isDemo: true,
  team: [],
} as const;

describe('CompanyProfileCard', () => {
  it('показывает реквизиты demo-компании', () => {
    render(<CompanyProfileCard company={company} />);

    expect(screen.getByRole('heading', { name: 'ООО «Север Транс Мониторинг»' })).toBeTruthy();
    expect(screen.getByText('Демо')).toBeTruthy();
    expect(screen.getByText('2465357184')).toBeTruthy();
    expect(screen.getByText('Александр Сергеевич Лебедев')).toBeTruthy();
  });

  it('показывает честное пустое состояние реквизитов', () => {
    render(
      <CompanyProfileCard
        company={{
          ...company,
          inn: null,
          kpp: null,
          ogrn: null,
          directorName: null,
          legalAddress: null,
          actualAddress: null,
          phone: null,
          email: null,
          isDemo: false,
        }}
      />,
    );

    expect(screen.getByText('Реквизиты компании пока не заполнены')).toBeTruthy();
  });
});
