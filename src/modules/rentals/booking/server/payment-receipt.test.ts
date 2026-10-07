import { describe, expect, it, vi } from 'vitest';

import { admitBookingReceipt } from './payment-receipt';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x01]);

function fixture() {
  const storage = {
    putQuarantine: vi.fn().mockResolvedValue(undefined),
    openQuarantine: vi.fn(),
    removeQuarantine: vi.fn(),
    promote: vi.fn(),
    openPrivate: vi.fn(),
    removePrivate: vi.fn().mockResolvedValue(undefined),
    removeUploadArtifacts: vi.fn().mockResolvedValue(0),
    reserveQuarantine: vi.fn(),
    privateUsageBytes: vi.fn(),
  };
  const scanner = {
    getMetadata: vi.fn(),
    scanStream: vi.fn(),
  };
  const scan = vi.fn().mockResolvedValue({
    status: 'CLEAN',
    audit: {
      sha256: 'receipt-sha256',
      verdict: 'CLEAN',
      engine: 'ClamAV',
      signatureVersion: '1.2.3',
    },
  });
  return { storage, scanner, scan };
}

describe('admitBookingReceipt', () => {
  it('rejects a non-image receipt before touching quarantine storage', async () => {
    const { storage, scanner, scan } = fixture();

    await expect(
      admitBookingReceipt({
        companyId: 'company-1',
        rentalId: 'rental-1',
        file: { name: 'receipt.pdf', bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]) },
        storage,
        scanner,
        scan,
        randomId: () => 'upload-1',
        now: () => new Date('2026-10-07T12:00:00.000Z'),
      }),
    ).rejects.toThrow('Фотография чека должна быть изображением JPEG, PNG или WebP.');
    expect(storage.putQuarantine).not.toHaveBeenCalled();
  });

  it('stores a clean JPEG receipt under the tenant rental prefix', async () => {
    const { storage, scanner, scan } = fixture();

    await expect(
      admitBookingReceipt({
        companyId: 'company-1',
        rentalId: 'rental-1',
        file: { name: 'receipt.jpg', bytes: jpeg },
        storage,
        scanner,
        scan,
        randomId: () => 'upload-1',
        now: () => new Date('2026-10-07T12:00:00.000Z'),
      }),
    ).resolves.toEqual({
      uploadId: 'upload-1',
      storageKey:
        'companies/company-1/rentals/rental-1/rental-payment-receipts/upload-1.jpg',
      originalName: 'receipt.jpg',
      verifiedMime: 'image/jpeg',
      bytes: 4,
      sha256: 'receipt-sha256',
      scanEngine: 'ClamAV',
      signatureVersion: '1.2.3',
      scannedAt: new Date('2026-10-07T12:00:00.000Z'),
    });
    expect(storage.putQuarantine).toHaveBeenCalledWith('upload-1', jpeg);
    expect(scan).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadId: 'upload-1',
        storageKey:
          'companies/company-1/rentals/rental-1/rental-payment-receipts/upload-1.jpg',
      }),
    );
  });

  it('rejects and cleans a receipt that fails malware scanning', async () => {
    const { storage, scanner, scan } = fixture();
    scan.mockResolvedValue({
      status: 'BLOCKED',
      audit: { sha256: 'blocked', verdict: 'BLOCKED', engine: 'ClamAV' },
    });

    await expect(
      admitBookingReceipt({
        companyId: 'company-1',
        rentalId: 'rental-1',
        file: { name: 'receipt.jpg', bytes: jpeg },
        storage,
        scanner,
        scan,
        randomId: () => 'upload-1',
        now: () => new Date('2026-10-07T12:00:00.000Z'),
      }),
    ).rejects.toThrow('Фотография чека не прошла антивирусную проверку.');
    expect(storage.removeUploadArtifacts).toHaveBeenCalledWith('upload-1');
  });
});
