import { Badge, Card, CardContent, CardHeader } from '@/shared/ui';

import type { AdminCompanyProfile } from './types';

const details = [
  { label: 'ИНН', key: 'inn' },
  { label: 'КПП', key: 'kpp' },
  { label: 'ОГРН', key: 'ogrn' },
  { label: 'Руководитель', key: 'directorName' },
  { label: 'Юридический адрес', key: 'legalAddress' },
  { label: 'Фактический адрес', key: 'actualAddress' },
  { label: 'Телефон', key: 'phone' },
  { label: 'Email', key: 'email' },
] as const satisfies ReadonlyArray<{ label: string; key: keyof AdminCompanyProfile }>;

function hasDetails(company: AdminCompanyProfile) {
  return details.some(({ key }) => company[key] !== null);
}

export function CompanyProfileCard({ company }: { company: AdminCompanyProfile }) {
  const filled = hasDetails(company);

  return (
    <Card className="min-w-0" data-testid="admin-company-profile">
      <CardHeader className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--color-text-secondary)]">Компания</p>
          <h3 className="mt-1 text-base font-bold break-words">{company.name}</h3>
        </div>
        {company.isDemo ? <Badge tone="info">Демо</Badge> : null}
      </CardHeader>
      <CardContent>
        {filled ? (
          <dl className="grid min-w-0 gap-x-5 gap-y-4 sm:grid-cols-2">
            {details.map(({ label, key }) => (
              <div key={key} className="min-w-0">
                <dt className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</dt>
                <dd className="mt-1 text-sm leading-5 break-words text-[var(--color-text)]">
                  {company[key] ?? 'Не указано'}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            Реквизиты компании пока не заполнены
          </p>
        )}
      </CardContent>
    </Card>
  );
}
