export type PassportOcrFields = {
  lastName?: string;
  firstName?: string;
  middleName?: string;
  birthDate?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedAt?: string;
  passportDivisionCode?: string;
  passportIssuedBy?: string;
};

function isoDate(value: string | undefined) {
  if (!value) return undefined;
  const match = /^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/u.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function cleanedLines(text: string) {
  return text
    .replace(/\r/gu, '')
    .split('\n')
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
}

function valueAfter(lines: string[], label: RegExp) {
  const index = lines.findIndex((line) => label.test(line));
  if (index < 0) return undefined;
  const inline = lines[index]
    ?.replace(label, '')
    .replace(/^[:\s-]+/u, '')
    .trim();
  return inline || lines[index + 1];
}

export function parseRussianPassportOcr(text: string): PassportOcrFields {
  const upper = text.toUpperCase();
  const normalized = upper.replace(/[ОO]/gu, '0');
  const lines = cleanedLines(upper);
  const compact = normalized.replace(/[^А-ЯA-Z0-9.-]+/gu, ' ');
  const passport = /(?:^|\s)(\d{2})\s?(\d{2})\s+(\d{6})(?:\s|$)/u.exec(compact);
  const passportDigits = lines
    .map((line) => line.replace(/\D/gu, ''))
    .find((digits) => digits.length === 10);
  const division = /(\d{3})[-\s](\d{3})/u.exec(compact);
  const datePattern = '(\\d{2})\\s*[.\\-/]\\s*(\\d{2})\\s*[.\\-/]\\s*(\\d{4})';
  const dates = [...upper.matchAll(new RegExp(datePattern, 'gu'))].map(
    (match) => `${match[1]}.${match[2]}.${match[3]}`,
  );
  const issuedDateMatch = new RegExp(`ДАТА\\s+(?:ВЫДАЧИ|ВЫМЕЧИ)\\D{0,24}${datePattern}`, 'u').exec(
    upper.replace(/\s+/gu, ' '),
  );
  const birthDateMatch = new RegExp(
    `ДАТА\\D{0,16}${datePattern}.{0,40}РОЖДЕНИЯ|ДАТА\\s+РОЖДЕНИЯ\\D{0,16}${datePattern}`,
    'u',
  ).exec(upper.replace(/\s+/gu, ' '));
  const issuedAt = issuedDateMatch
    ? isoDate(`${issuedDateMatch[1]}.${issuedDateMatch[2]}.${issuedDateMatch[3]}`)
    : isoDate(dates[0]);
  const birthDate = birthDateMatch
    ? isoDate(
        birthDateMatch[1]
          ? `${birthDateMatch[1]}.${birthDateMatch[2]}.${birthDateMatch[3]}`
          : `${birthDateMatch[4]}.${birthDateMatch[5]}.${birthDateMatch[6]}`,
      )
    : isoDate(dates.find((date) => isoDate(date) !== issuedAt) ?? dates[1]);
  // JavaScript word boundaries do not treat Cyrillic letters as word characters,
  // therefore use explicit whitespace/end look-ahead for Russian labels.
  const surname = valueAfter(lines, /^(?:ФАМИЛИЯ|SURNAME)(?=\s|$)/u);
  const firstName = valueAfter(lines, /^(?:ИМЯ|GIVEN NAMES?)(?=\s|$)/u);
  const middleName = valueAfter(lines, /^(?:ОТЧЕСТВО|PATRONYMIC)(?=\s|$)/u);
  const issuedBy = valueAfter(lines, /^(?:КЕМ ВЫДАН|ВЫДАН)(?=\s|$)/u);

  return {
    ...(surname ? { lastName: surname } : {}),
    ...(firstName ? { firstName } : {}),
    ...(middleName ? { middleName } : {}),
    ...(birthDate ? { birthDate } : {}),
    ...(passport
      ? { passportSeries: `${passport[1]}${passport[2]}` }
      : passportDigits
        ? { passportSeries: passportDigits.slice(0, 4) }
        : {}),
    ...(passport
      ? { passportNumber: passport[3] }
      : passportDigits
        ? { passportNumber: passportDigits.slice(4) }
        : {}),
    ...(issuedAt ? { passportIssuedAt: issuedAt } : {}),
    ...(division ? { passportDivisionCode: `${division[1]}-${division[2]}` } : {}),
    ...(issuedBy ? { passportIssuedBy: issuedBy } : {}),
  };
}
