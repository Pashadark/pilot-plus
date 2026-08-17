import { describe, expect, it } from 'vitest';

import { canCreateClientComment, canHideClientComment } from './access';

describe('RBAC внутренних комментариев клиента', () => {
  it('разрешает управление администратору и диспетчеру, но не водителю или наблюдателю', () => {
    expect(canCreateClientComment('COMPANY_ADMIN')).toBe(true);
    expect(canCreateClientComment('DISPATCHER')).toBe(true);
    expect(canCreateClientComment('DRIVER')).toBe(false);
    expect(canCreateClientComment('VIEWER')).toBe(false);
  });

  it('диспетчер скрывает только свой комментарий', () => {
    expect(canHideClientComment('DISPATCHER', 'user-1', 'user-1')).toBe(true);
    expect(canHideClientComment('DISPATCHER', 'user-1', 'user-2')).toBe(false);
    expect(canHideClientComment('COMPANY_ADMIN', 'user-1', 'user-2')).toBe(true);
  });
});
