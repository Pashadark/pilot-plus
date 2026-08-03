import { FiActivity, FiCheckCircle, FiDatabase, FiRadio, FiServer, FiSlash } from 'react-icons/fi';

import { Badge, Card, CardContent, CardHeader, PageHeader } from '@/shared/ui';
import type { BadgeTone } from '@/shared/ui/Badge';

import type { ServiceHealth, ServiceHealthState } from './types';

const statusPresentation: Record<
  ServiceHealthState,
  { label: string; tone: BadgeTone; icon: typeof FiCheckCircle }
> = {
  healthy: { label: 'Работает', tone: 'success', icon: FiCheckCircle },
  unavailable: { label: 'Недоступен', tone: 'danger', icon: FiSlash },
  unconfigured: { label: 'Не настроен', tone: 'warning', icon: FiSlash },
};

const serviceIcons: Record<ServiceHealth['key'], typeof FiDatabase> = {
  api: FiActivity,
  postgresql: FiDatabase,
  redis: FiServer,
  mqtt: FiRadio,
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'medium',
});

export function SystemHealthPage({ services }: { services: ServiceHealth[] }) {
  return (
    <section
      aria-labelledby="system-health-title"
      className="grid min-w-0 gap-5 p-4 sm:p-6"
      data-testid="system-health-page"
    >
      <PageHeader
        eyebrow="Инфраструктура"
        title="Состояние системы"
        titleId="system-health-title"
        description="Текущая доступность основных сервисов Pilot+. Результаты одной проверки не скрывают состояние остальных сервисов."
      />

      <section
        aria-label="Состояние сервисов"
        className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4"
      >
        {services.map((service) => {
          const ServiceIcon = serviceIcons[service.key];
          const presentation = statusPresentation[service.status];
          const StatusIcon = presentation.icon;

          return (
            <Card key={service.key} className="min-w-0" data-testid="service-health-card">
              <CardHeader className="flex min-w-0 flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <ServiceIcon aria-hidden="true" className="size-5" />
                  </span>
                  <h2 className="min-w-0 text-base font-bold break-words">{service.label}</h2>
                </div>
                <Badge
                  tone={presentation.tone}
                  className="shrink-0 gap-1.5"
                  data-testid="service-health-status"
                >
                  <StatusIcon aria-hidden="true" className="size-3.5" />
                  {presentation.label}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  {service.message}
                </p>
                <dl className="grid gap-2 border-t pt-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--color-text-secondary)]">Задержка</dt>
                    <dd className="font-semibold tabular-nums">{service.latencyMs} мс</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-[var(--color-text-secondary)]">Проверено</dt>
                    <dd className="min-w-0 font-medium">
                      <time dateTime={service.checkedAt} className="break-words">
                        {dateFormatter.format(new Date(service.checkedAt))}
                      </time>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </section>
  );
}
