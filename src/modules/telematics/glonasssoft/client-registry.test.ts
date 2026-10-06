import { describe, expect, it, vi } from 'vitest';

import { createGlonassSoftClientRegistry } from './client-registry';

describe('GLONASSSoft client registry', () => {
  it('reuses one client for the same company and credentials', () => {
    const createClient = vi.fn(() => ({ getLastData: vi.fn() }));
    const registry = createGlonassSoftClientRegistry(createClient);
    const configuration = {
      baseUrl: 'https://gs.sputnik.vision/api/v3',
      username: 'user',
      password: 'password',
    };

    const first = registry.get('company-a', configuration);
    const second = registry.get('company-a', configuration);

    expect(second).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('replaces the client when integration credentials change', () => {
    const createClient = vi.fn(() => ({ getLastData: vi.fn() }));
    const registry = createGlonassSoftClientRegistry(createClient);

    const first = registry.get('company-a', {
      baseUrl: 'https://gs.sputnik.vision/api/v3',
      username: 'user',
      password: 'old-password',
    });
    const second = registry.get('company-a', {
      baseUrl: 'https://gs.sputnik.vision/api/v3',
      username: 'user',
      password: 'new-password',
    });

    expect(second).not.toBe(first);
    expect(createClient).toHaveBeenCalledTimes(2);
  });
});
