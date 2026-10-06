export type SearchResult = {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  href: string;
};
export type SearchResponse = { results: SearchResult[]; error?: string };
export function normalizeSearchPlate(value: string) {
  const map: Record<string, string> = {
    A: 'А',
    B: 'В',
    E: 'Е',
    K: 'К',
    M: 'М',
    H: 'Н',
    O: 'О',
    P: 'Р',
    C: 'С',
    T: 'Т',
    Y: 'У',
    X: 'Х',
  };
  return value
    .toUpperCase()
    .replace(/\s/g, '')
    .replace(/[ABEKMHOPCTYX]/g, (c) => map[c]);
}
export function parseSearchQuery(
  value: string,
  now = new Date(),
): { text: string; range?: { from: string; to: string }; error?: string } {
  const text = value.trim().slice(0, 120);
  const current = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const year = Number(current.slice(0, 4));
  if (/^(сегодня|завтра)$/i.test(text)) {
    const from =
      new Date(`${current}T00:00:00+03:00`).getTime() + (/завтра/i.test(text) ? 86400000 : 0);
    return {
      text,
      range: { from: new Date(from).toISOString(), to: new Date(from + 86400000).toISOString() },
    };
  }
  const match = text.match(
    /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?(?:\s*[-–—]\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?)?$/,
  );
  if (!match)
    return /^\d{1,2}\.\d/.test(text)
      ? { text, error: 'Дата: 22.09.2026 или 22.09–25.09.2026' }
      : { text };
  const day = (d: string, m: string, y: number) => {
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const date = new Date(`${iso}T00:00:00+03:00`);
    return !Number.isNaN(date.getTime()) &&
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date) === iso
      ? date.getTime()
      : NaN;
  };
  const from = day(match[1], match[2], Number(match[3] ?? match[6] ?? year));
  const end = match[4] ? day(match[4], match[5], Number(match[6] ?? match[3] ?? year)) : from;
  if (!Number.isFinite(from) || !Number.isFinite(end) || end < from || end - from > 365 * 86400000)
    return { text, error: 'Проверьте даты: начало не позже окончания, диапазон — до года.' };
  return {
    text,
    range: { from: new Date(from).toISOString(), to: new Date(end + 86400000).toISOString() },
  };
}
