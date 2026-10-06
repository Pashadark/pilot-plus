import 'server-only';
import { prisma } from '@/database/prisma/client';
import { addPilotBusinessDays } from '@/shared/business-time';
import { resolveRentalDepositState } from '@/modules/rentals/deposit-state';
import type { SearchResult } from './query';

type Scope = { scope: string; companyIds: readonly string[] } | null;
const whereScope = (s: Exclude<Scope, null>) =>
  s.scope === 'SYSTEM' ? {} : { companyId: { in: [...s.companyIds] } };
const fmt = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  dateStyle: 'short',
  timeStyle: 'short',
});
export async function searchDates(
  range: { from: string; to: string },
  userId: string,
  rentals: Scope,
  leads: Scope,
): Promise<SearchResult[]> {
  const from = new Date(range.from),
    to = new Date(range.to),
    window = { gte: from, lt: to };
  const inRange = (d: Date) => d >= from && d < to;
  const results: SearchResult[] = [];
  const [contracts, service, tasks, requests] = await Promise.all([
    rentals
      ? prisma.rental.findMany({
          where: {
            ...whereScope(rentals),
            OR: [
              { startsAt: window },
              { endsAt: window },
              { completedAt: { gte: new Date(from.getTime() - 60 * 86400000), lt: to } },
            ],
          },
          select: {
            id: true,
            contractNumber: true,
            startsAt: true,
            endsAt: true,
            completedAt: true,
            status: true,
            depositMinor: true,
            vehicle: { select: { model: true, registrationNumber: true } },
            operations: {
              where: { status: 'COMMITTED' },
              select: { id: true, type: true, status: true, occurredAt: true, depositStatus: true },
            },
            payments: { select: { kind: true, status: true, amountMinor: true } },
          },
          take: 200,
          orderBy: { startsAt: 'asc' },
        })
      : [],
    prisma.maintenanceRecord.findMany({
      where: { vehicle: { company: { members: { some: { userId } } } }, scheduledAt: window },
      select: { id: true, title: true, scheduledAt: true },
      take: 10,
      orderBy: { scheduledAt: 'asc' },
    }),
    rentals
      ? prisma.operationsTask.findMany({
          where: { ...whereScope(rentals), dueAt: window },
          select: { id: true, title: true, dueAt: true },
          take: 10,
          orderBy: { dueAt: 'asc' },
        })
      : [],
    leads
      ? prisma.lead.findMany({
          where: { ...whereScope(leads), nextContactAt: window },
          select: { id: true, name: true, nextContactAt: true },
          take: 10,
          orderBy: { nextContactAt: 'asc' },
        })
      : [],
  ]);
  for (const r of contracts) {
    const subtitle = [r.contractNumber, r.vehicle.model, r.vehicle.registrationNumber]
      .filter(Boolean)
      .join(' · ');
    const add = (kind: string, date: Date) =>
      results.push({
        id: `${kind}-${r.id}`,
        group: 'По датам',
        title: `${kind} · ${fmt.format(date)}`,
        subtitle,
        href: `/rentals/${r.id}`,
      });
    if (inRange(r.startsAt)) add('Выдача', r.startsAt);
    if (inRange(r.endsAt)) add('Возврат автомобиля', r.endsAt);
    if (r.status === 'COMPLETED') {
      const returned =
        r.operations
          .filter((o) => o.type === 'RETURN')
          .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0]?.occurredAt ??
        r.completedAt ??
        r.endsAt;
      const due = addPilotBusinessDays(returned, 21);
      if (
        inRange(due) &&
        resolveRentalDepositState({
          expectedMinor: r.depositMinor,
          operations: r.operations,
          payments: r.payments,
        }) === 'COLLECTED'
      )
        add('Вернуть депозит', due);
    }
  }
  const localDate = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  results.splice(20);
  results.push(
    ...service.map((s) => ({
      id: `service-${s.id}`,
      group: 'ТО',
      title: s.title,
      subtitle: `Плановое ТО · ${fmt.format(s.scheduledAt!)}`,
      href: `/maintenance?view=calendar&month=${localDate(s.scheduledAt!).slice(0, 7)}`,
    })),
    ...tasks.map((t) => ({
      id: `task-${t.id}`,
      group: 'Задачи',
      title: t.title,
      subtitle: `Срок · ${fmt.format(t.dueAt)}`,
      href: '/?from=' + localDate(t.dueAt) + '&to=' + localDate(t.dueAt),
    })),
    ...requests.map((l) => ({
      id: `lead-${l.id}`,
      group: 'Заявки',
      title: l.name,
      subtitle: `Связаться · ${fmt.format(l.nextContactAt!)}`,
      href: `/leads#lead-${l.id}`,
    })),
  );
  return results.slice(0, 50);
}
