export type PassportDetails = {
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssuedAt: string;
  passportDivisionCode: string;
};

const emptyPassportDetails: PassportDetails = {
  passportSeries: '',
  passportNumber: '',
  passportIssuedBy: '',
  passportIssuedAt: '',
  passportDivisionCode: '',
};

export function parsePassportDetails(value: string | null | undefined): PassportDetails {
  if (!value) return { ...emptyPassportDetails };

  const parts = value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const identity = parts[0] ?? '';
  const identityMatch = identity.match(/^(.+?)\s+(\d{6,7})$/);
  const details: PassportDetails = {
    ...emptyPassportDetails,
    passportSeries: identityMatch?.[1]?.trim() ?? '',
    passportNumber: identityMatch?.[2] ?? '',
  };

  for (const part of parts.slice(1)) {
    if (/^Выдан:/i.test(part)) details.passportIssuedBy = part.replace(/^Выдан:\s*/i, '');
    if (/^Дата выдачи:/i.test(part)) {
      details.passportIssuedAt = part.replace(/^Дата выдачи:\s*/i, '');
    }
    if (/^Код подразделения:/i.test(part)) {
      details.passportDivisionCode = part.replace(/^Код подразделения:\s*/i, '');
    }
  }

  return details;
}

export function composePassportDetails(
  fallback: string,
  details: PassportDetails,
): string | null {
  const hasStructuredData = Object.values(details).some((value) => value.trim().length > 0);
  if (!hasStructuredData) return fallback.trim() || null;

  return [
    [details.passportSeries.trim(), details.passportNumber.trim()].filter(Boolean).join(' '),
    details.passportIssuedBy.trim() ? `Выдан: ${details.passportIssuedBy.trim()}` : '',
    details.passportIssuedAt.trim() ? `Дата выдачи: ${details.passportIssuedAt.trim()}` : '',
    details.passportDivisionCode.trim()
      ? `Код подразделения: ${details.passportDivisionCode.trim()}`
      : '',
  ]
    .filter(Boolean)
    .join('; ');
}
