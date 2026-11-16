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
  if (!match) return undefined;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
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

function repairDriverIssuedDate(value: string | undefined, expiresAt: string | undefined) {
  const issued = value ? /^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/u.exec(value) : null;
  const expires = expiresAt ? /^(\d{4})-(\d{2})-(\d{2})$/u.exec(expiresAt) : null;
  if (!issued || !expires) return undefined;

  const issuedYear = Number(issued[3]);
  const expiresYear = Number(expires[1]);
  if (expiresYear - issuedYear !== 10 || issued[2] !== expires[2]) return undefined;

  return `${issued[3]}-${expires[2]}-${expires[3]}`;
}

function driverLicenseSeries(text: string) {
  const compact = text.replace(/\r|\n/gu, ' ').replace(/\s+/gu, ' ');
  const match = /(?:^|\s)5[).:\s-]+(\d{2})\s*(\d{2})(?=\D|$)/iu.exec(compact);
  return match ? `${match[1]} ${match[2]}` : undefined;
}

function parseDriverLicense(text: string): ClientOcrFields {
  const compact = text.replace(/\r|\n/gu, ' ').replace(/\s+/gu, ' ');
  const labelledNumber = /(?:^|\s)5[).:\s-]+(\d{2})\s?(\d{2})\s?(\d{6})(?:\s|$)/iu.exec(compact);
  const unlabelledNumber = /(?:^|\D)(\d{2})\s+(\d{2})\s+(\d{6})(?=\D|$)/u.exec(compact);
  const number = labelledNumber ?? unlabelledNumber;
  const dates = [
    ...compact.matchAll(/(?:^|\D)(\d{2}[.\-/]\d{2}[.\-/]\d{4})(?=\D|$)/gu),
  ].map((match) => match[1]);
  const expiresAt = labelledDate(compact, '4b') ?? isoDate(dates.at(-1));
  const issuedCandidate = dates.at(-2);
  const issuedAt =
    labelledDate(compact, '4a') ??
    isoDate(issuedCandidate) ??
    repairDriverIssuedDate(issuedCandidate, expiresAt);
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

export type ClientOcrTextCandidate = {
  rotation: number;
  text: string;
};

export type ClientOcrImageCandidate = {
  rotation: number;
  bytes: Uint8Array;
};

function hasEnoughClientOcrFields(kind: ClientOcrDocumentKind, fields: ClientOcrFields) {
  if (kind === 'PASSPORT_MAIN') return Object.keys(fields).length >= 5;
  if (kind === 'PASSPORT_REGISTRATION') return Boolean(fields.registrationAddress);
  return Boolean(
    fields.driverLicense && fields.driverLicenseIssuedAt && fields.driverLicenseExpiresAt,
  );
}

export function selectBestClientOcrCandidate(
  kind: ClientOcrDocumentKind,
  candidates: ClientOcrTextCandidate[],
) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      fields: parseClientDocumentOcr(kind, candidate.text),
    }))
    .reduce((best, candidate) =>
      Object.keys(candidate.fields).length > Object.keys(best.fields).length ? candidate : best,
    );
}

export function mergeClientOcrSupplementalTexts(
  kind: ClientOcrDocumentKind,
  primaryText: string,
  supplementalTexts: string[],
) {
  const merged: ClientOcrFields = { ...parseClientDocumentOcr(kind, primaryText) };
  const writable = merged as Record<string, string | undefined>;
  for (const text of supplementalTexts) {
    const fields = parseClientDocumentOcr(kind, `${primaryText}\n${text}`) as Record<
      string,
      string | undefined
    >;
    for (const [key, value] of Object.entries(fields)) {
      if (!writable[key] && value) writable[key] = value;
    }
  }

  if (kind === 'DRIVER_LICENSE' && merged.driverLicense) {
    const series = driverLicenseSeries(primaryText);
    const number = /^(\d{2})\s(\d{2})\s(\d{6})$/u.exec(merged.driverLicense);
    if (series && number) merged.driverLicense = `${series} ${number[3]}`;
  }
  return merged;
}

export async function recognizeBestClientOcrCandidate(
  kind: ClientOcrDocumentKind,
  candidates: ClientOcrImageCandidate[],
  recognize: (candidate: ClientOcrImageCandidate) => Promise<string>,
) {
  const recognized: ClientOcrTextCandidate[] = [];
  for (const candidate of candidates) {
    recognized.push({ rotation: candidate.rotation, text: await recognize(candidate) });
    const best = selectBestClientOcrCandidate(kind, recognized);
    if (hasEnoughClientOcrFields(kind, best.fields)) return best;
  }
  return selectBestClientOcrCandidate(kind, recognized);
}
