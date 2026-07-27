import { describe, expect, it } from 'vitest';

import { canUpdateFirmware } from './firmware';

describe('canUpdateFirmware', () => {
  it('разрешает только более новую версию из трёх числовых сегментов', () => {
    expect(canUpdateFirmware('1.4.9', '1.5.0')).toBe(true);
    expect(canUpdateFirmware('1.4.9', '2.0.0')).toBe(true);
  });

  it('не разрешает текущую или более старую версию', () => {
    expect(canUpdateFirmware('1.5.0', '1.5.0')).toBe(false);
    expect(canUpdateFirmware('1.5.0', '1.4.99')).toBe(false);
  });

  it('отклоняет версии не из ровно трёх числовых сегментов', () => {
    expect(canUpdateFirmware('1.5', '1.5.1')).toBe(false);
    expect(canUpdateFirmware('1.5.0', 'v1.5.1')).toBe(false);
    expect(canUpdateFirmware('1.5.0', '1.5.1.0')).toBe(false);
    expect(canUpdateFirmware('1.5.0', '1.5.beta')).toBe(false);
  });
});
