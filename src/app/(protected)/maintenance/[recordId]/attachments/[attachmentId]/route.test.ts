import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getAuthenticatedSession: vi.fn() }));
const repository = vi.hoisted(() => ({
  maintenanceAttachment: { findFirst: vi.fn() },
}));
const storage = vi.hoisted(() => ({ openPrivate: vi.fn() }));

vi.mock('@/services/auth/session', () => auth);
vi.mock('@/database/prisma/client', () => ({ prisma: repository }));
vi.mock('@/services/storage/local-private-storage', () => ({
  LocalPrivateStorage: { create: vi.fn().mockResolvedValue(storage) },
}));

import { GET } from './route';

const context = {
  params: Promise.resolve({ recordId: 'repair-1', attachmentId: 'photo-1' }),
};

describe('maintenance attachment route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRIVATE_STORAGE_ROOT = 'C:\\pilot-private-test';
    auth.getAuthenticatedSession.mockResolvedValue({ user: { id: 'user-1' } });
    repository.maintenanceAttachment.findFirst.mockResolvedValue({
      id: 'photo-1',
      storageKey: 'companies/company-1/vehicles/vehicle-1/maintenance/repair-1/photo-1.jpg',
      originalName: 'Повреждение.jpg',
      verifiedMime: 'image/jpeg',
    });
    storage.openPrivate.mockResolvedValue(Readable.from(Buffer.from('image')));
  });

  it('streams an authorised image inline without exposing its storage key', async () => {
    const response = await GET(new Request('https://supapro.ru/x'), context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('content-disposition')).toContain('inline');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(repository.maintenanceAttachment.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'photo-1',
        maintenanceRecordId: 'repair-1',
        maintenanceRecord: {
          vehicle: { company: { members: { some: { userId: 'user-1' } } } },
        },
      },
      select: expect.any(Object),
    });
    expect(await response.text()).toBe('image');
  });

  it('returns 404 before touching storage when the user has no session', async () => {
    auth.getAuthenticatedSession.mockResolvedValue(null);

    const response = await GET(new Request('https://supapro.ru/x'), context);

    expect(response.status).toBe(404);
    expect(repository.maintenanceAttachment.findFirst).not.toHaveBeenCalled();
    expect(storage.openPrivate).not.toHaveBeenCalled();
  });
});
