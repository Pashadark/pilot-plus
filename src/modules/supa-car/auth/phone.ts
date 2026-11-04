export function normalizeOwnerPhone(value: string): string {
  const source = value.trim();
  if (!source || !/^[+\d\s()-]+$/u.test(source)) {
    throw new Error('Некорректный номер телефона.');
  }

  const digits = source.replace(/\D/gu, '');
  const normalizedDigits =
    digits.length === 11 && digits.startsWith('8') ? `7${digits.slice(1)}` : digits;

  if (
    normalizedDigits.length !== 11 ||
    !normalizedDigits.startsWith('7') ||
    source.startsWith('+8')
  ) {
    throw new Error('Некорректный номер телефона.');
  }

  return `+${normalizedDigits}`;
}
