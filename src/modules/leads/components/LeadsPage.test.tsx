import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LeadsPage } from './LeadsPage';

describe('LeadsPage', () => {
  it('offers optional surname and follow-up fields plus the new sources', () => {
    const markup = renderToStaticMarkup(
      createElement(LeadsPage, {
        companies: [{ id: 'company-1', name: 'СУПА ПРО' }],
        leads: [],
      }),
    );

    expect(markup).toContain('>Фамилия<');
    expect(markup).toContain('name="lastName"');
    expect(markup).not.toMatch(/name="lastName"[^>]*required/u);
    expect(markup).toContain('>Следующий контакт<');
    expect(markup).toContain('name="nextContactAt"');
    expect(markup).toContain('<option>Авито</option>');
    expect(markup).toContain('<option>ВКонтакте</option>');
  });

  it('shows full name and an explicit unscheduled state', () => {
    const markup = renderToStaticMarkup(
      createElement(LeadsPage, {
        companies: [{ id: 'company-1', name: 'СУПА ПРО' }],
        leads: [
          {
            id: 'lead-1',
            companyName: 'СУПА ПРО',
            name: 'Анна',
            lastName: 'Петрова',
            phone: '+7 999 123-45-67',
            source: 'Авито',
            comment: null,
            status: 'NEW',
            assignedToName: 'Павел Седов',
            nextContactAt: null,
            createdAt: '2026-09-07T08:00:00.000Z',
          },
        ],
      }),
    );

    expect(markup).toContain('Анна Петрова');
    expect(markup).toContain('Время не назначено');
  });
});
