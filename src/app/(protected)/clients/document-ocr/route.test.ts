import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/clients/access', () => ({
  getClientAccess: vi.fn().mockResolvedValue({
    scope: 'SYSTEM',
    companyIds: [],
    user: { id: 'user-1', email: 'admin@supapro.ru' },
  }),
}));

vi.mock('@/modules/client-documents/file-validation', () => ({
  maxUploadedFileBytes: 15 * 1024 * 1024,
  validateUploadedFile: vi.fn(() => ({ mime: 'image/png', extension: 'png', bytes: 4 })),
}));

import { POST } from './route';

function request(documentKind?: string) {
  const formData = new FormData();
  formData.set('file', new File([new Uint8Array([1, 2, 3, 4])], 'document.png'));
  if (documentKind) formData.set('documentKind', documentKind);
  return new Request('http://localhost/clients/document-ocr', {
    method: 'POST',
    body: formData,
  });
}

describe('client document OCR route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('отклоняет запрос без типа документа до запуска OCR', async () => {
    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Неизвестный тип документа.' });
  });

  it('отклоняет неизвестный тип документа до запуска OCR', async () => {
    const response = await POST(request('UNKNOWN'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Неизвестный тип документа.' });
  });
});
