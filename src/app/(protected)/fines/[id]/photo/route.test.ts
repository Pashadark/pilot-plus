import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getFinePhotoResponse } from './photo-response';

describe('protected fine photo route', () => {
  it('does not contact Driver Helper when tenant authorization fails', async () => {
    const loadAuthorizedFine = vi.fn().mockResolvedValue(null);
    const fetchPhoto = vi.fn();

    const response = await getFinePhotoResponse('foreign-fine', {
      loadAuthorizedFine,
      fetchPhoto,
    });

    expect(response.status).toBe(404);
    expect(fetchPhoto).not.toHaveBeenCalled();
  });

  it('returns a private nosniff image for an authorized fine', async () => {
    const response = await getFinePhotoResponse('fine-a', {
      loadAuthorizedFine: vi.fn().mockResolvedValue({ externalId: '91', companyId: 'company-a' }),
      fetchPhoto: vi
        .fn()
        .mockResolvedValue({ mime: 'image/jpeg', bytes: new Uint8Array([255, 216, 255]) }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
