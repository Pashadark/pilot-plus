const DAY = 86_400_000;
export function dayKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function calendarDays(start: string, count = 7) {
  const anchor = new Date(`${start}T00:00:00+03:00`).getTime();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(anchor + index * DAY);
    return {
      key: dayKey(date),
      label: new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: 'numeric',
        month: 'short',
      })
        .format(date)
        .replace('.', ''),
      weekday: new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        weekday: 'short',
      }).format(date),
    };
  });
}
export function shiftDay(key: string, offset: number) {
  return dayKey(new Date(new Date(`${key}T00:00:00+03:00`).getTime() + offset * DAY));
}
export function rentalPlacement(start: string, end: string, anchor: string, count: number) {
  const a = new Date(`${anchor}T00:00:00+03:00`).getTime();
  const from = Math.max(0, Math.floor((new Date(start).getTime() - a) / DAY));
  const to = Math.min(count, Math.ceil((new Date(end).getTime() - a) / DAY));
  return to > from ? { start: from, span: to - from } : null;
}
