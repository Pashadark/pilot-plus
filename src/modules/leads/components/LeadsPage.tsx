import { FiPhoneCall } from 'react-icons/fi';

import { Badge, Card, CardContent, CardHeader, PageHeader } from '@/shared/ui';

import { updateLeadStatusAction } from '../actions';
import { leadStatusLabels, leadStatuses, type LeadItem } from '../types';
import { LeadCreateForm } from './LeadCreateForm';

const formatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Moscow',
});
const tones = {
  NEW: 'primary',
  CONTACTED: 'info',
  QUALIFIED: 'warning',
  BOOKED: 'success',
  LOST: 'neutral',
} as const;

export function LeadsPage({
  leads,
  companies,
}: {
  leads: readonly LeadItem[];
  companies: readonly { id: string; name: string }[];
}) {
  const active = leads.filter((lead) => lead.status !== 'BOOKED' && lead.status !== 'LOST');
  const leadName = (lead: LeadItem) => [lead.name, lead.lastName].filter(Boolean).join(' ');
  return (
    <main className="grid min-w-0 gap-5 p-4 sm:p-6">
      <PageHeader
        eyebrow="Продажи"
        title="Заявки"
        description="Первичный звонок или обращение до создания клиента и договора."
      />
      <Card>
        <CardHeader>
          <h2 className="font-bold">Новая заявка</h2>
        </CardHeader>
        <CardContent>
          <LeadCreateForm companies={companies} />
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">В работе</h2>
        <Badge tone="primary" size="lg">
          {active.length}
        </Badge>
      </div>
      <section className="grid gap-3 xl:grid-cols-2" aria-label="Заявки в работе">
        {active.map((lead) => (
          <Card key={lead.id} id={`lead-${lead.id}`} className="scroll-mt-24 overflow-hidden">
            <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{leadName(lead)}</h3>
                  <Badge tone={tones[lead.status]}>{leadStatusLabels[lead.status]}</Badge>
                </div>
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="mt-2 inline-flex items-center gap-2 font-semibold text-[var(--color-primary)]"
                  >
                    <FiPhoneCall aria-hidden="true" />
                    {lead.phone}
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    Телефон не указан
                  </p>
                )}
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  {lead.companyName} · {lead.source ?? 'Источник не указан'}
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Следующий контакт:{' '}
                  <strong className="text-[var(--color-text)]">
                    {lead.nextContactAt
                      ? formatter.format(new Date(lead.nextContactAt))
                      : 'Время не назначено'}
                  </strong>
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Создана: {formatter.format(new Date(lead.createdAt))}
                </p>
                {lead.comment ? (
                  <p className="mt-2 text-sm whitespace-pre-wrap">{lead.comment}</p>
                ) : null}
                {lead.assignedToName ? (
                  <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                    Ответственный: {lead.assignedToName}
                  </p>
                ) : null}
              </div>
              <form action={updateLeadStatusAction} className="flex items-end gap-2 sm:flex-col">
                <input type="hidden" name="leadId" value={lead.id} />
                <select
                  name="status"
                  defaultValue={lead.status}
                  aria-label={`Статус заявки ${leadName(lead)}`}
                  className="min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm"
                >
                  {leadStatuses.map((status) => (
                    <option key={status} value={status}>
                      {leadStatusLabels[status]}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="min-h-11 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white"
                >
                  Сохранить
                </button>
              </form>
            </CardContent>
          </Card>
        ))}
        {active.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Активных заявок пока нет.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </section>
      {leads.length > active.length ? (
        <details className="rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-4">
          <summary className="cursor-pointer font-semibold">
            Завершённые заявки ({leads.length - active.length})
          </summary>
          <div className="mt-3 grid gap-2">
            {leads
              .filter((lead) => lead.status === 'BOOKED' || lead.status === 'LOST')
              .map((lead) => (
                <div
                  key={lead.id}
                  id={`lead-${lead.id}`}
                  className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm"
                >
                  <span>
                    {leadName(lead)} · {lead.phone}
                  </span>
                  <Badge tone={tones[lead.status]}>{leadStatusLabels[lead.status]}</Badge>
                </div>
              ))}
          </div>
        </details>
      ) : null}
    </main>
  );
}
