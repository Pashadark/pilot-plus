import { EventEmitter } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { buildRentalSnapshot } from '../../domain/build-snapshot';
import { generateRentalDocx } from '../docx/generate-docx';
import { createLibreOfficePdfConverter, PdfConversionError } from './convert-docx-to-pdf';

const snapshot = buildRentalSnapshot({
  confirmedReady: true,
  company: {
    id: 'company',
    legalName: 'ООО Пилот',
    inn: '7700000000',
    address: 'Москва',
    signatoryName: 'Иван Петров',
    signatoryAuthority: 'Устав',
    contractCity: 'Москва',
    defaultPickupAddress: 'Москва',
    defaultReturnAddress: 'Москва',
  },
  client: {
    id: 'client',
    fullName: 'Иван Иванов',
    phone: '+79990000000',
    passport: '45 01 123456',
    birthDate: '2000-01-01',
    registrationAddress: 'Москва',
    licenseNumber: '77 01 123456',
  },
  vehicle: {
    id: 'vehicle',
    make: 'Volkswagen',
    model: 'Polo',
    registrationNumber: 'А156АХ997',
    vin: 'VIN',
    dailyMinor: 470000,
    depositMinor: 1000000,
  },
  rental: {
    id: 'rental',
    startsAt: new Date('2026-08-12T09:00:00.000Z'),
    endsAt: new Date('2026-08-13T09:00:00.000Z'),
    calculatedTotalMinor: 470000,
    agreedTotalMinor: 470000,
    currency: 'RUB',
  },
});

describe('createLibreOfficePdfConverter', () => {
  it('rejects malformed DOCX before launching any process', async () => {
    const spawn = vi.fn();
    const convert = createLibreOfficePdfConverter({
      executable: 'C:\\LibreOffice\\soffice.exe',
      spawn: spawn as never,
    });

    await expect(convert(new Uint8Array([0x50, 0x4b, 3, 4]))).rejects.toBeInstanceOf(
      PdfConversionError,
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it('uses a fixed executable and isolated arguments without a shell', async () => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(),
    });
    const spawn = vi.fn((_executable: string, args: readonly string[]) => {
      const outputDirectory = args[args.indexOf('--outdir') + 1];
      queueMicrotask(async () => {
        await writeFile(join(outputDirectory!, 'contract.pdf'), Buffer.from('%PDF-1.7\n'));
        child.emit('close', 0);
      });
      return child;
    });
    const convert = createLibreOfficePdfConverter({
      executable: 'C:\\LibreOffice\\soffice.exe',
      spawn: spawn as never,
    });
    const docx = await generateRentalDocx(snapshot, { contractNumber: 'ME-2026-0001-BK' });

    await expect(convert(docx)).resolves.toEqual(new Uint8Array(Buffer.from('%PDF-1.7\n')));
    expect(spawn).toHaveBeenCalledWith(
      'C:\\LibreOffice\\soffice.exe',
      expect.arrayContaining([
        '--headless',
        '--convert-to',
        'pdf:writer_pdf_Export',
        expect.stringMatching(/^-env:UserInstallation=file:/u),
      ]),
      expect.objectContaining({ shell: false, windowsHide: true }),
    );
  });
});
