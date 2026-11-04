import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink, writeFile } from 'node:fs/promises';

import { NextResponse } from 'next/server';

import {
  validateUploadedFile,
  maxUploadedFileBytes,
} from '@/modules/client-documents/file-validation';
import { getClientAccess } from '@/modules/clients/access';
import {
  extractRussianPassportPortrait,
  preprocessDriverLicenseForOcr,
  preprocessRussianPassportForOcr,
  preprocessRussianPassportSerialForOcr,
} from '@/modules/clients/client-ocr-image';
import { isClientOcrDocumentKind, parseClientDocumentOcr } from '@/modules/clients/document-ocr';

export const runtime = 'nodejs';

function recognize(path: string, options?: { psm?: string; whitelist?: string }) {
  return new Promise<string>((resolve, reject) => {
    const args = [path, 'stdout', '-l', 'rus+eng', '--psm', options?.psm ?? '6'];
    if (options?.whitelist) args.push('-c', `tessedit_char_whitelist=${options.whitelist}`);
    const child = spawn(process.env.TESSERACT_BIN?.trim() || 'tesseract', args, {
      windowsHide: true,
      shell: false,
    });
    let output = '';
    let errorOutput = '';
    const timer = setTimeout(() => child.kill(), 30_000);
    child.stdout.on('data', (chunk) => {
      if (output.length < 2_000_000) output += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      if (errorOutput.length < 4_000) errorOutput += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(`OCR завершился с кодом ${code}: ${errorOutput}`));
    });
  });
}

export async function POST(request: Request) {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return NextResponse.json({ error: 'Доступ запрещён.' }, { status: 403 });

  try {
    const formData = await request.formData();
    const documentKind = formData.get('documentKind');
    if (!isClientOcrDocumentKind(documentKind)) {
      return NextResponse.json({ error: 'Неизвестный тип документа.' }, { status: 400 });
    }
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0 || file.size > maxUploadedFileBytes) {
      return NextResponse.json({ error: 'Выберите изображение до 15 МБ.' }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = validateUploadedFile({ name: file.name, bytes });
    if (!validated.mime.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Для распознавания нужен JPG, PNG или WebP.' },
        { status: 400 },
      );
    }
    const isPassport = documentKind === 'PASSPORT_MAIN';
    const ocrBytes = isPassport
      ? await preprocessRussianPassportForOcr(bytes)
      : documentKind === 'DRIVER_LICENSE'
        ? await preprocessDriverLicenseForOcr(bytes)
        : bytes;
    const extension = isPassport || documentKind === 'DRIVER_LICENSE' ? 'png' : validated.extension;
    const path = join(tmpdir(), `supapro-client-document-${randomUUID()}.${extension}`);
    const serialPath = isPassport
      ? join(tmpdir(), `supapro-passport-serial-${randomUUID()}.png`)
      : null;
    try {
      await writeFile(path, ocrBytes, { flag: 'wx' });
      if (serialPath) {
        await writeFile(serialPath, await preprocessRussianPassportSerialForOcr(bytes), {
          flag: 'wx',
        });
      }
      const [text, serialText] = await Promise.all([
        recognize(path, { psm: isPassport ? '11' : '6' }),
        serialPath
          ? recognize(serialPath, { psm: '7', whitelist: '0123456789' })
          : Promise.resolve(''),
      ]);
      const portrait =
        documentKind === 'PASSPORT_MAIN'
          ? await extractRussianPassportPortrait(bytes)
              .then((value) => `data:image/webp;base64,${value.toString('base64')}`)
              .catch(() => null)
          : null;
      return NextResponse.json({
        fields: parseClientDocumentOcr(documentKind, `${text}\n${serialText}`),
        portrait,
      });
    } finally {
      await unlink(path).catch(() => undefined);
      if (serialPath) await unlink(serialPath).catch(() => undefined);
    }
  } catch {
    return NextResponse.json(
      { error: 'Не удалось распознать документ. Заполните поля вручную.' },
      { status: 422 },
    );
  }
}
