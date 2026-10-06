import { parseRussianPassportOcr, type PassportOcrFields } from './passport-ocr';

export const clientOcrDocumentKinds = [
  'PASSPORT_MAIN',
  'PASSPORT_REGISTRATION',
  'DRIVER_LICENSE',
] as const;

export type ClientOcrDocumentKind = (typeof clientOcrDocumentKinds)[number];

export type ClientOcrFields = PassportOcrFields & {
  registrationAddress?: string;
  driverLicense?: string;
  driverLicenseIssuedAt?: string;
  driverLicenseExpiresAt?: string;
};

export function isClientOcrDocumentKind(value: unknown): value is ClientOcrDocumentKind {
  return (
    typeof value === 'string' && clientOcrDocumentKinds.includes(value as ClientOcrDocumentKind)
  );
}

function lines(text: string) {
  return text
    .replace(/\r/gu, '')
    .split('\n')
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
}

function isoDate(value: string | undefined) {
  const match = value ? /^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/u.exec(value) : null;
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function parseRegistration(text: string): ClientOcrFields {
  const documentLines = lines(text.toUpperCase());
  const labelIndex = documentLines.findIndex((line) =>
    /(?:ЗАРЕГИСТРИРОВАН|МЕСТ[ОА]\s+ЖИТЕЛЬСТВА|РЕГИСТРАЦИ)/u.test(line),
  );
  if (labelIndex < 0) return {};

  const inline = documentLines[labelIndex]
    ?.replace(
      /^.*?(?:ЗАРЕГИСТРИРОВАН(?:А)?(?:\s+ПО)?\s+МЕСТУ\s+ЖИТЕЛЬСТВА|АДРЕС\s+РЕГИСТРАЦИИ)\s*[:.-]?\s*/u,
      '',
    )
    .trim();
  const addressParts = [inline, ...documentLines.slice(labelIndex + 1)]
    .filter((line): line is string => Boolean(line))
    .filter((line) => !/^\d{2}[.\-/]\d{2}[.\-/]\d{4}$/u.test(line))
    .filter((line) => !/(?:ПОДПИСЬ|М\.П\.|ПЕЧАТЬ|ОРГАН)/u.test(line))
    .slice(0, 3);
  const registrationAddress = addressParts.join(' ').replace(/\s+/gu, ' ').trim();
  return registrationAddress ? { registrationAddress } : {};
}

function labelledDate(text: string, label: '4a' | '4b') {
  const match = new RegExp(
    `(?:^|\\s)${label.replace('4', '4\\s*')}[).:\\s-]+(\\d{2}[.\\-/]\\d{2}[.\\-/]\\d{4})`,
    'iu',
  ).exec(text);
  return isoDate(match?.[1]);
}

function parseDriverLicense(text: string): ClientOcrFields {
  const compact = text.replace(/\r|\n/gu, ' ').replace(/\s+/gu, ' ');
  const labelledNumber = /(?:^|\s)5[).:\s-]+(\d{2})\s?(\d{2})\s?(\d{6})(?:\s|$)/iu.exec(compact);
  const unlabelledNumber = /(?:^|\D)(\d{2})\s+(\d{2})\s+(\d{6})(?=\D|$)/u.exec(compact);
  const number = labelledNumber ?? unlabelledNumber;
  const dates = [...compact.matchAll(/(?:^|\D)(\d{2}[.\-/]\d{2}[.\-/]\d{4})(?=\D|$)/gu)]
    .map((match) => isoDate(match[1]))
    .filter((value): value is string => Boolean(value));
  const issuedAt = labelledDate(compact, '4a') ?? dates.at(-2);
  const expiresAt = labelledDate(compact, '4b') ?? dates.at(-1);
  return {
    ...(number ? { driverLicense: `${number[1]} ${number[2]} ${number[3]}` } : {}),
    ...(issuedAt ? { driverLicenseIssuedAt: issuedAt } : {}),
    ...(expiresAt ? { driverLicenseExpiresAt: expiresAt } : {}),
  };
}

export function parseClientDocumentOcr(kind: ClientOcrDocumentKind, text: string): ClientOcrFields {
  if (kind === 'PASSPORT_MAIN') return parseRussianPassportOcr(text);
  if (kind === 'PASSPORT_REGISTRATION') return parseRegistration(text);
  return parseDriverLicense(text);
}
