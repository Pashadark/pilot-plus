import { describe, expect, it } from 'vitest';

import type { ClientAccess } from '@/modules/clients/access';

import { createRentalConstructorBootstrap } from './bootstrap';

const access: ClientAccess = {
  user: {
    id: 'user-1',
    email: 'owner@supapro.ru',
    name: 'Павел',
    role: 'SUPER_ADMIN',
    canAccessAdmin: true,
  },
  scope: 'SYSTEM',
  companyIds: [],
  canManage: true,
};

describe('rental constructor bootstrap', () => {
  it('keeps the preferred client inside the selected company', async () => {
    const bootstrap = createRentalConstructorBootstrap({
      listCompanies: async () => [
        { id: 'company-a', name: 'СУПА ПРО Москва' },
        { id: 'company-b', name: 'СУПА ПРО Казань' },
      ],
      listClients: async () => [
        {
          id: 'client-a',
          companyId: 'company-a',
          fullName: 'Щапова Анна Петровна',
          phone: '+7 950 080-99-08',
          status: 'VERIFIED',
        },
      ],
      getClient: async () => ({
        id: 'client-b',
        companyId: 'company-b',
        fullName: 'Чужой клиент',
        phone: null,
        status: 'NEW',
      }),
      listVehicles: async () => [],
      getTemplate: async () => ({ id: 'template-a' }),
      listDocuments: async () => [
        {
          id: 'passport-a',
          clientId: 'client-a',
          category: 'PASSPORT',
          title: 'Паспорт',
          status: 'CLEAN',
          currentVersion: 1,
          originalName: null,
          verifiedMime: null,
          bytes: null,
          createdAt: '2026-11-15T09:00:00.000Z',
          updatedAt: '2026-11-15T09:00:00.000Z',
        },
      ],
      getCompany: async () => ({
        id: 'company-a',
        name: 'СУПА ПРО Москва',
        contractCity: 'Москва',
      }),
    });

    const result = await bootstrap(access, {
      preferredCompanyId: 'company-a',
      preferredClientId: 'client-b',
    });

    expect(result.companyId).toBe('company-a');
    expect(result.userId).toBe('user-1');
    expect(result.company.contractCity).toBe('Москва');
    expect(result.preferredClient).toBeNull();
    expect(result.clients.every((client) => client.companyId === 'company-a')).toBe(true);
    expect(result.documentsByClientId['client-a']).toHaveLength(1);
  });

  it('uses the only permitted company for a company user', async () => {
    const bootstrap = createRentalConstructorBootstrap({
      listCompanies: async () => [{ id: 'company-a', name: 'СУПА ПРО Москва' }],
      listClients: async () => [],
      getClient: async () => null,
      listVehicles: async () => [],
      getTemplate: async () => null,
      listDocuments: async () => [],
      getCompany: async () => ({
        id: 'company-a',
        name: 'СУПА ПРО Москва',
        contractCity: null,
      }),
    });

    const result = await bootstrap(
      { ...access, scope: 'COMPANY', companyIds: ['company-a'] },
      { preferredCompanyId: 'company-b' },
    );

    expect(result.companyId).toBe('company-a');
  });
});
