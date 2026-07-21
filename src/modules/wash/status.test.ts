import { describe, expect, it } from 'vitest';

import { canTransitionWash } from './status';

describe('переходы статусов мойки', () => {
  it('разрешает начать запланированную мойку', () => {
    expect(canTransitionWash('PLANNED', 'IN_PROGRESS')).toBe(true);
  });

  it('запрещает отменять завершённую мойку', () => {
    expect(canTransitionWash('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('разрешает только предусмотренные переходы из работы', () => {
    expect(canTransitionWash('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransitionWash('IN_PROGRESS', 'CANCELLED')).toBe(true);
    expect(canTransitionWash('IN_PROGRESS', 'PLANNED')).toBe(false);
  });
});
