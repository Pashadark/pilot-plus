import { parseCalendarMonth } from './calendar-model';

export type OperationsCalendarView = 'list' | 'calendar';

export interface CanonicalOperationsCalendarQuery {
  changed: boolean;
  month: string;
  query: string;
  view: OperationsCalendarView;
}

export function canonicalizeOperationsCalendarQuery(
  searchParams: URLSearchParams,
  now = new Date(),
): CanonicalOperationsCalendarQuery {
  const originalQuery = searchParams.toString();
  const params = new URLSearchParams(originalQuery);
  const view: OperationsCalendarView =
    searchParams.get('view') === 'calendar' ? 'calendar' : 'list';
  const month = parseCalendarMonth(view === 'calendar' ? searchParams.get('month') : null, now);

  params.set('view', view);
  if (view === 'calendar') {
    params.set('month', month);
  } else {
    params.delete('month');
  }

  const query = params.toString();
  return { changed: query !== originalQuery, month, query, view };
}
