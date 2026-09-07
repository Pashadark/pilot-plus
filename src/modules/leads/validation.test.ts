import { describe, expect, it } from 'vitest';

import { parseLeadInput, parseLeadStatus } from './validation';

describe('lead validation', () => {
  it('normalizes a valid call request', () => {
    const formData = new FormData();
    formData.set('companyId', 'company-1');
    formData.set('name', '  Анна Иванова  ');
    formData.set('phone', '+7 (999) 123-45-67');
    formData.set('lastName', '  Петрова  ');
    formData.set('source', 'Телефон');
    formData.set('comment', 'Нужна машина завтра');
    formData.set('nextContactAt', '2026-09-07T15:30');

    expect(parseLeadInput(formData)).toEqual({
      ok: true,
      data: {
        companyId: 'company-1',
        name: 'Анна Иванова',
        phone: '+7 (999) 123-45-67',
        lastName: 'Петрова',
        source: 'Телефон',
        comment: 'Нужна машина завтра',
        nextContactAt: new Date('2026-09-07T15:30:00'),
      },
    });
  });

  it('keeps surname and next contact optional', () => {
    const formData = new FormData();
    formData.set('companyId', 'company-1');
    formData.set('name', 'Анна');
    formData.set('phone', '+7 (999) 123-45-67');

    expect(parseLeadInput(formData)).toMatchObject({
      ok: true,
      data: { lastName: '', nextContactAt: null },
    });
  });

  it('rejects an invalid phone and status', () => {
    const formData = new FormData();
    formData.set('companyId', 'company-1');
    formData.set('name', 'Анна');
    formData.set('phone', '123');
    formData.set('nextContactAt', 'not-a-date');

    expect(parseLeadInput(formData)).toMatchObject({
      ok: false,
      fieldErrors: {
        phone: 'Укажите российский номер телефона.',
        nextContactAt: 'Укажите корректные дату и время.',
      },
    });
    expect(parseLeadStatus('DONE')).toBeNull();
    expect(parseLeadStatus('CONTACTED')).toBe('CONTACTED');
  });
});
