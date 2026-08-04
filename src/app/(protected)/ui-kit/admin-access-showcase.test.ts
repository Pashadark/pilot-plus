import { describe, expect, it } from 'vitest';

import { adminAccessRoles } from './admin-access-showcase';

describe('контракт административного доступа UI-kit', () => {
  it('публикует реальные русские названия ролей', () => {
    expect(adminAccessRoles.map(({ label }) => label)).toEqual([
      'Суперадминистратор',
      'Администратор компании',
      'Диспетчер',
      'Водитель',
      'Наблюдатель',
    ]);
  });
});
