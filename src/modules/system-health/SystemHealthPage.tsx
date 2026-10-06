import Link from 'next/link';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiDatabase,
  FiFileText,
  FiImage,
  FiMapPin,
  FiRadio,
  FiRefreshCw,
  FiSend,
  FiServer,
  FiShield,
  FiSlash,
} from 'react-icons/fi';

import { Badge, Card, CardContent, CardHeader, PageHeader } from '@/shared/ui';
import type { BadgeTone } from '@/shared/ui/Badge';

import type { OperationalHealthItem } from './get-operational-health';
import type { OperationalHealthState } from './operational-health';
import type { ServiceHealth, ServiceHealthState } from './types';

const statusPresentation: Record<
  ServiceHealthState | OperationalHealthState,
  { label: string; tone: BadgeTone; icon: typeof FiCheckCircle }
> = {
  healthy: { label: 'Работает', tone: 'success', icon: FiCheckCircle },
  degraded: { label: 'Есть задержка', tone: 'warning', icon: FiClock },
  unavailable: { label: 'Требует внимания', tone: 'danger', icon: FiAlertTriangle },
  unconfigured: { label: 'Не настроено', tone: 'neutral', icon: FiSlash },
};

const serviceIcons: Record<ServiceHealth['key'], typeof FiDatabase> = {
  api: FiActivity,
  postgresql: FiDatabase,
  redis: FiServer,
  mqtt: FiRadio,
  clamav: FiShield,
};

const operationIcons: Record<OperationalHealthItem['key'], typeof FiDatabase> = {
  glonasssoft: FiMapPin,
  'rental-documents': FiFileText,
  'return-media': FiImage,
  'client-documents': FiShield,
  telegram: FiSend,
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'medium',
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function SystemHealthPage({
  services,
  operations,
}: {
  services: ServiceHealth[];
  operations: OperationalHealthItem[];
}) {
  const components = [...services, ...operations];
  const healthyCount = components.filter((item) => item.status === 'healthy').length;
  const unavailableCount = components.filter((item) => item.status === 'unavailable').length;
  const degradedCount = components.filter((item) => item.status === 'degraded').length;
  const unconfiguredCount = components.filter((item) => item.status === 'unconfigured').length;
  const overall =
    unavailableCount > 0
      ? { label: 'Требуется внимание', tone: 'danger' as const, icon: FiAlertTriangle }
      : degradedCount > 0
        ? { label: 'Есть задержки', tone: 'warning' as const, icon: FiClock }
        : { label: 'Все системы работают', tone: 'success' as const, icon: FiCheckCircle };
  const OverallIcon = overall.icon;

  return (
    <section
      aria-labelledby="system-health-title"
      className="grid min-w-0 gap-5 p-4 sm:p-6"
      data-testid="system-health-page"
    >
      <PageHeader
        eyebrow="Инфраструктура и операции"
        title="Состояние системы"
        titleId="system-health-title"
        description="Единая проверка сервисов, интеграций и фоновых очередей СУПА ПРО без раскрытия технических секретов."
        actions={
          <Link
            href="/system"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-4 text-sm font-semibold transition-colors hover:bg-[var(--color-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            <FiRefreshCw aria-hidden="true" className="size-4" />
            Обновить проверку
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <CardContent className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className={`grid size-12 shrink-0 place-items-center rounded-full ${overall.tone === 'danger' ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]' : overall.tone === 'warning' ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]' : 'bg-[var(--color-success-soft)] text-[var(--color-success)]'}`}
            >
              <OverallIcon aria-hidden="true" className="size-6" />
            </span>
            <div className="min-w-0">
              <Badge tone={overall.tone} size="md" className="gap-2">
                {overall.label}
              </Badge>
              <p className="mt-2 text-lg font-bold">
                {healthyCount} из {components.length} компонентов работают штатно
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                Недоступно: {unavailableCount} · С задержкой: {degradedCount} · Не настроено:{' '}
                {unconfiguredCount}
              </p>
            </div>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] px-4 py-3 text-sm">
            <p className="text-[var(--color-text-secondary)]">Последняя проверка</p>
            <p className="mt-1 font-semibold tabular-nums">
              {components[0] ? formatDate(components[0].checkedAt) : 'Нет данных'}
            </p>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="core-services-title" className="grid gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
            Инфраструктура
          </p>
          <h2 id="core-services-title" className="mt-1 text-xl font-bold">
            Основные сервисы
          </h2>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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
                    <h3 className="min-w-0 text-base font-bold break-words">{service.label}</h3>
                  </div>
                  <Badge tone={presentation.tone} className="shrink-0 gap-1.5">
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
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-[var(--color-text-secondary)]">Проверено</dt>
                      <dd className="text-right font-medium tabular-nums">
                        <time dateTime={service.checkedAt}>{formatDate(service.checkedAt)}</time>
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="operations-health-title" className="grid gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-text-secondary)] uppercase">
            Бизнес-процессы
          </p>
          <h2 id="operations-health-title" className="mt-1 text-xl font-bold">
            Фоновые процессы и очереди
          </h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {operations.map((operation) => {
            const OperationIcon = operationIcons[operation.key];
            const presentation = statusPresentation[operation.status];
            const StatusIcon = presentation.icon;
            return (
              <Card key={operation.key} className="min-w-0 overflow-hidden">
                <CardContent className="grid gap-4">
                  <div className="flex min-w-0 flex-wrap items-start gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                      <OperationIcon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold">{operation.label}</h3>
                      <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
                        {operation.description}
                      </p>
                    </div>
                    <Badge tone={presentation.tone} className="shrink-0 gap-1.5">
                      <StatusIcon aria-hidden="true" className="size-3.5" />
                      {presentation.label}
                    </Badge>
                  </div>

                  <p className="rounded-[var(--radius-md)] bg-[var(--color-elevated)] px-3 py-2.5 text-sm font-medium">
                    {operation.message}
                  </p>

                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {operation.metrics.map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-[var(--radius-md)] border px-3 py-2.5"
                      >
                        <dt className="text-xs text-[var(--color-text-secondary)]">
                          {metric.label}
                        </dt>
                        <dd className="mt-1 text-lg font-bold tabular-nums">{metric.value}</dd>
                      </div>
                    ))}
                    {operation.lastSuccessAt ? (
                      <div className="col-span-2 rounded-[var(--radius-md)] border px-3 py-2.5">
                        <dt className="text-xs text-[var(--color-text-secondary)]">
                          Последний успех
                        </dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums">
                          <time dateTime={operation.lastSuccessAt}>
                            {formatDate(operation.lastSuccessAt)}
                          </time>
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {operation.errorCode ? (
                    <p className="text-xs text-[var(--color-danger)]">
                      Безопасный код последней ошибки: <strong>{operation.errorCode}</strong>
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </section>
  );
}
