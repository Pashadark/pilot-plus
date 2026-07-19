const currencySymbols: Record<string, string> = { RUB: '₽', THB: '฿' };

export function formatDailyPrice(minor: number, currency: string) {
  const amount = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(minor / 100);
  return `${amount}\u00a0${currencySymbols[currency] ?? currency}/сутки`;
}

export function formatOptionalMetric(value: number | null, suffix: string) {
  if (value === null) return 'Нет данных';
  return `${new Intl.NumberFormat('ru-RU').format(value)} ${suffix}`;
}
