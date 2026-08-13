import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import type { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

const maxConverterOutputBytes = 64 * 1024;
const defaultMaxDocumentBytes = 15 * 1024 * 1024;
const defaultTimeoutMs = 45_000;

export class PdfConversionError extends Error {
  constructor() {
    super('Не удалось сформировать PDF договора.');
    this.name = 'PdfConversionError';
  }
}

export type PdfConverter = (docx: Uint8Array) => Promise<Uint8Array>;

type Spawn = (
  executable: string,
  arguments_: readonly string[],
  options: { cwd: string; shell: false; windowsHide: true; stdio: ['ignore', 'pipe', 'pipe'] },
) => ChildProcess;

export type LibreOfficeConverterOptions = {
  executable?: string;
  timeoutMs?: number;
  maxDocumentBytes?: number;
  spawn?: Spawn;
};

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function configuredExecutable() {
  const defaultExecutable =
    process.platform === 'win32'
      ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
      : '/usr/bin/soffice';
  const executable = process.env.RENTAL_DOCUMENT_CONVERTER_EXECUTABLE?.trim() || defaultExecutable;
  if (!isAbsolute(executable) || executable.includes('\u0000')) throw new PdfConversionError();
  return executable;
}

function hasDocxCentralDirectory(bytes: Uint8Array) {
  const source = Buffer.from(bytes);
  if (
    source.byteLength < 22 ||
    source[0] !== 0x50 ||
    source[1] !== 0x4b ||
    source[2] !== 0x03 ||
    source[3] !== 0x04
  ) {
    return false;
  }
  const directoryOffset = source.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (directoryOffset < 0 || directoryOffset + 22 > source.byteLength) return false;
  const entries = source.readUInt16LE(directoryOffset + 10);
  let offset = source.readUInt32LE(directoryOffset + 16);
  if (offset >= source.byteLength) return false;
  const names = new Set<string>();
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > source.byteLength || source.readUInt32LE(offset) !== 0x02014b50) return false;
    const nameLength = source.readUInt16LE(offset + 28);
    const extraLength = source.readUInt16LE(offset + 30);
    const commentLength = source.readUInt16LE(offset + 32);
    const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > source.byteLength) return false;
    names.add(source.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'));
    offset = entryEnd;
  }
  return names.has('[Content_Types].xml') && names.has('word/document.xml');
}

function assertDocx(bytes: Uint8Array, maxDocumentBytes: number) {
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > maxDocumentBytes ||
    !hasDocxCentralDirectory(bytes)
  ) {
    throw new PdfConversionError();
  }
}

function outputStream(stream: Readable | null, onOverflow: () => void) {
  let bytes = 0;
  stream?.on('data', (chunk: Buffer | string) => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > maxConverterOutputBytes) onOverflow();
  });
}

async function runConverter(
  spawn: Spawn,
  executable: string,
  arguments_: readonly string[],
  workingDirectory: string,
  timeoutMs: number,
) {
  await new Promise<void>((resolve, reject) => {
    let completed = false;
    let rejected = false;
    let process: ChildProcess | undefined;
    const finish = (error?: Error) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    const terminate = () => {
      if (rejected) return;
      rejected = true;
      process?.kill('SIGKILL');
      finish(new PdfConversionError());
    };
    const timeout = setTimeout(terminate, timeoutMs);
    try {
      process = spawn(executable, arguments_, {
        cwd: workingDirectory,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      finish(new PdfConversionError());
      return;
    }
    outputStream(process.stdout, terminate);
    outputStream(process.stderr, terminate);
    process.once('error', () => finish(new PdfConversionError()));
    process.once('close', (code) => {
      if (rejected || code !== 0) finish(new PdfConversionError());
      else finish();
    });
  });
}

/** Converts exactly one generated DOCX byte stream in an isolated LibreOffice profile. */
export function createLibreOfficePdfConverter(
  options: LibreOfficeConverterOptions = {},
): PdfConverter {
  const executable = options.executable ?? configuredExecutable();
  if (!isAbsolute(executable) || executable.includes('\u0000')) throw new PdfConversionError();
  const timeoutMs =
    options.timeoutMs ??
    boundedInteger(
      process.env.RENTAL_DOCUMENT_CONVERTER_TIMEOUT_MS,
      defaultTimeoutMs,
      1_000,
      120_000,
    );
  const maxDocumentBytes =
    options.maxDocumentBytes ??
    boundedInteger(
      process.env.RENTAL_DOCUMENT_MAX_BYTES,
      defaultMaxDocumentBytes,
      1024,
      50 * 1024 * 1024,
    );
  const spawn =
    options.spawn ?? ((command, args, spawnOptions) => nodeSpawn(command, args, spawnOptions));

  return async (docx) => {
    assertDocx(docx, maxDocumentBytes);
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'pilot-rental-pdf-'));
    const profileDirectory = join(temporaryDirectory, 'profile');
    const outputDirectory = join(temporaryDirectory, 'output');
    const inputPath = join(temporaryDirectory, 'contract.docx');
    const outputPath = join(outputDirectory, 'contract.pdf');
    try {
      await mkdir(profileDirectory, { recursive: true, mode: 0o700 });
      await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
      await writeFile(inputPath, docx, { flag: 'wx', mode: 0o600 });
      await runConverter(
        spawn,
        executable,
        [
          '--headless',
          '--nologo',
          '--nodefault',
          '--nofirststartwizard',
          '--nolockcheck',
          '--norestore',
          `-env:UserInstallation=${pathToFileURL(profileDirectory).href}`,
          '--convert-to',
          'pdf:writer_pdf_Export',
          '--outdir',
          outputDirectory,
          inputPath,
        ],
        temporaryDirectory,
        timeoutMs,
      );
      const info = await stat(outputPath);
      if (!info.isFile() || info.size === 0 || info.size > maxDocumentBytes)
        throw new PdfConversionError();
      const pdf = new Uint8Array(await readFile(outputPath));
      if (
        pdf.byteLength === 0 ||
        pdf.byteLength > maxDocumentBytes ||
        !Buffer.from(pdf).subarray(0, 5).equals(Buffer.from('%PDF-'))
      ) {
        throw new PdfConversionError();
      }
      return pdf;
    } catch (error) {
      if (error instanceof PdfConversionError) throw error;
      throw new PdfConversionError();
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true }).catch(() => undefined);
    }
  };
}

export const convertDocxToPdf = createLibreOfficePdfConverter();
