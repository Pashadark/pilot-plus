import type { ClientQueryFilters, ClientStatus } from '../types';

const statuses = new Set<ClientStatus>([
  'DRAFT',
  'NEW',
  'VERIFYING',
  'VERIFIED',
  'REGULAR',
  'BLOCKED',
  'ARCHIVED',
]);
const documentValues = new Set(['present', 'missing'] as const);

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function normalizeClientSearchParams(params: SearchParams): ClientQueryFilters {
  const q = single(params.q)?.trim();
  const status = single(params.status);
  const documents = single(params.documents);
  const license = single(params.license);
  const rawPage = Number(single(params.page));

  return {
    ...(q ? { q } : {}),
    ...(status && statuses.has(status as ClientStatus) ? { status: status as ClientStatus } : {}),
    ...(documents && documentValues.has(documents as 'present' | 'missing')
      ? { documents: documents as 'present' | 'missing' }
      : {}),
    ...(license && documentValues.has(license as 'present' | 'missing')
      ? { license: license as 'present' | 'missing' }
      : {}),
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function clientQueryHref(
  current: { toString(): string },
  updates: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  return query ? `/clients?${query}` : '/clients';
}
