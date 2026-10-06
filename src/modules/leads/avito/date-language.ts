const months = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/** Normalize syntax only. The calendar parser still validates dates and refuses past ranges. */
export function normalizeDateLanguage(text: string, now: Date) {
  const month = new Date(now.getTime() + 10800000).toISOString().slice(5, 7);
  const named = text
    .replace(/деакабря/giu, 'декабря')
    .replace(
      /(?<!\d)(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(20\d{2}))?(?!\p{L})/giu,
      (_, day: string, name: string, year: string | undefined) =>
        `${day}.${String(months.indexOf(name.toLowerCase()) + 1).padStart(2, '0')}${year ? '.' + year : ''}`,
    );
  return named.replace(
    /(?<!\p{L})с\s+(\d{1,2})(?:[./](\d{1,2})(?:[./](\d{4}))?)?\s+(?:по|до)\s+(\d{1,2})(?:[./](\d{1,2})(?:[./](\d{4}))?)?(?![\d./])/giu,
    (
      _,
      d1: string,
      m1: string | undefined,
      y1: string | undefined,
      d2: string,
      m2: string | undefined,
      y2: string | undefined,
    ) =>
      `с ${d1}.${m1 ?? m2 ?? month}${y1 ? '.' + y1 : ''} по ${d2}.${m2 ?? m1 ?? month}${y2 ? '.' + y2 : ''}`,
  );
}
