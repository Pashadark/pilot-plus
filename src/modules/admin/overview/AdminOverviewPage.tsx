import Link from 'next/link';
import { FiActivity, FiCpu, FiGrid, FiTruck, FiUsers } from 'react-icons/fi';

import { Badge, Card, CardContent, CardHeader, PageHeader } from '@/shared/ui';

import { CompanyProfileCard } from './CompanyProfileCard';
import { TeamList } from './TeamList';
import type { AdminOverview } from './types';

const scopeLabel = {
  SYSTEM: 'Системный уровень',
  COMPANY: 'Уровень компании',
} as const;

const actionLinkClass =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

const auditActionLabel = {
  CREATE: 'Создание',
  UPDATE: 'Изменение',
  ASSIGN: 'Назначение',
  BLOCK: 'Блокировка',
  ARCHIVE: 'Архивирование',
  DELETE: 'Удаление',
  VIEW: 'Просмотр',
  DOWNLOAD: 'Скачивание',
  SCAN: 'Проверка',
} as const;

export function AdminOverviewPage({ overview }: { overview: AdminOverview }) {
  const kpis = [
    { label: 'Компании', value: overview.companies, icon: FiGrid },
    { label: 'Пользователи', value: overview.users, icon: FiUsers },
    { label: 'Автомобили', value: overview.vehicles, icon: FiTruck },
    { label: 'Устройства', value: overview.devices, icon: FiCpu },
  ];

  return (
    <section aria-labelledby="admin-overview-title" className="grid min-w-0 gap-5 p-4 sm:p-6">
      <PageHeader
        eyebrow="Администрирование"
        title="Центр управления"
        titleId="admin-overview-title"
        description="Сводка доступных компаний, пользователей и ресурсов Pilot+."
        actions={
          <Badge tone="primary" size="lg">
            {scopeLabel[overview.scope]}
          </Badge>
        }
      />

      <section
        aria-label="Основные показатели"
        className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-4"
      >
        {kpis.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="min-w-0" data-testid="admin-overview-kpi">
            <CardContent className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <dl className="min-w-0">
                <dt className="text-sm text-[var(--color-text-secondary)]">{label}</dt>
                <dd className="text-2xl font-bold tabular-nums">{value}</dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="admin-companies-title" className="grid min-w-0 gap-4">
        <div>
          <h2 id="admin-companies-title" className="text-lg font-bold">
            Компании и команда
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
            Реквизиты доступных компаний и назначенные корпоративные роли.
          </p>
        </div>

        {overview.companyProfiles.length === 0 ? (
          <Card className="min-w-0">
            <CardContent>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                Доступные компании пока не найдены
              </p>
            </CardContent>
          </Card>
        ) : (
          overview.companyProfiles.map((company) => (
            <div
              key={company.id}
              className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]"
            >
              <CompanyProfileCard company={company} />
              <TeamList team={company.team} />
            </div>
          ))
        )}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <h2 className="text-base font-bold">Последние действия</h2>
          </CardHeader>
          <CardContent>
            {overview.recentAudit.length === 0 ? (
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                Действий пока нет
              </p>
            ) : (
              <ul className="grid divide-y">
                {overview.recentAudit.map((item) => (
                  <li key={item.id} className="grid min-w-0 gap-1 py-3 first:pt-0 last:pb-0">
                    <p className="min-w-0 font-semibold break-words">{item.actorLabel}</p>
                    <p className="min-w-0 text-sm break-words text-[var(--color-text-secondary)]">
                      {auditActionLabel[item.action]} · {item.entityLabel ?? item.entityType}
                      {item.companyLabel ? ` · ${item.companyLabel}` : ''}
                    </p>
                    <time
                      className="text-xs text-[var(--color-text-secondary)]"
                      dateTime={item.createdAt}
                    >
                      {new Intl.DateTimeFormat('ru-RU', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(item.createdAt))}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex items-center gap-2">
            <FiActivity aria-hidden="true" className="size-5 text-[var(--color-primary)]" />
            <h2 className="text-base font-bold">Быстрые действия</h2>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/vehicles" className={actionLinkClass}>
              Открыть автопарк
            </Link>
            <Link href="/devices" className={actionLinkClass}>
              Открыть устройства
            </Link>
            <Link href="/system" className={actionLinkClass}>
              Проверить систему
            </Link>
          </CardContent>
        </Card>
      </section>
    </section>
  );
}
