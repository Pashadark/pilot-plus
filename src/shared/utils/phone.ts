export function normalizeRussianPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return /^8\d{10}$/.test(digits) ? `7${digits.slice(1)}` : digits;
}
