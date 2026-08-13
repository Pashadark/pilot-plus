import { describe, expect, it, vi } from 'vitest';

import { reconcileStaleRentalDocumentGenerations } from './reconcile-rental-document-generations';

describe('reconcileStaleRentalDocumentGenerations', () => {
  it('removes both stale temporary/final artifacts and marks the generation ERROR', async () => {
    const removeUploadArtifacts = vi.fn().mockResolvedValue(0);
    const removePrivate = vi.fn().mockResolvedValue(undefined);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const result = await reconcileStaleRentalDocumentGenerations({
      now: new Date('2026-08-13T12:00:00.000Z'),
      database: {
        rentalDocumentGeneration: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'generation-1',
              companyId: 'company-1',
              rentalId: 'rental-1',
              status: 'PROMOTED',
              retryCount: 0,
              docxQuarantineKey: 'docx-upload',
              pdfQuarantineKey: 'pdf-upload',
              docxStorageKey: 'companies/company-1/docx',
              pdfStorageKey: 'companies/company-1/pdf',
            },
          ]),
          updateMany,
        },
      },
      storage: { removeUploadArtifacts, removePrivate },
    });

    expect(removeUploadArtifacts).toHaveBeenCalledWith('docx-upload');
    expect(removeUploadArtifacts).toHaveBeenCalledWith('pdf-upload');
    expect(removePrivate).toHaveBeenCalledWith('companies/company-1/docx');
    expect(removePrivate).toHaveBeenCalledWith('companies/company-1/pdf');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ERROR', leaseExpiresAt: null }),
        where: expect.objectContaining({ status: 'CLEANING', claimToken: expect.any(String) }),
      }),
    );
    expect(result).toEqual({ reconciled: 1, retryPending: 0 });
  });

  it('does not delete a selected stale candidate when generator renewal wins the atomic claim', async () => {
    const removeUploadArtifacts = vi.fn();
    const removePrivate = vi.fn();
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });

    await expect(
      reconcileStaleRentalDocumentGenerations({
        now: new Date('2026-08-13T12:00:00.000Z'),
        database: {
          rentalDocumentGeneration: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'generation-1',
                companyId: 'company-1',
                rentalId: 'rental-1',
                status: 'PROMOTED',
                retryCount: 0,
                docxQuarantineKey: 'docx-upload',
                pdfQuarantineKey: 'pdf-upload',
                docxStorageKey: 'companies/company-1/docx',
                pdfStorageKey: 'companies/company-1/pdf',
              },
            ]),
            // A generator renews/commits after candidate selection, so exact expired-status CAS loses.
            updateMany,
          },
        },
        storage: { removeUploadArtifacts, removePrivate },
      }),
    ).resolves.toEqual({ reconciled: 0, retryPending: 0 });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CLEANING' }) }),
    );
    expect(removeUploadArtifacts).not.toHaveBeenCalled();
    expect(removePrivate).not.toHaveBeenCalled();
  });
});
