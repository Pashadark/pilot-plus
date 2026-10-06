import 'server-only';
import { prisma } from '@/database/prisma/client';
import { readSession } from '@/services/auth/session';
import { getClientAccess } from '@/modules/clients/access';
import { getRentalAccess } from '@/modules/rentals/server/access';
import { getFineAccessForUser } from '@/modules/fines/access';
import { blindIndex } from '@/services/security/field-encryption';
import { normalizeRussianPhone } from '@/shared/utils/phone';
import {
  parseSearchQuery,
  normalizeSearchPlate,
  type SearchResponse,
  type SearchResult,
} from './query';
import { searchDates } from './server-dates';

export function searchScope(access: { scope: string; companyIds: readonly string[] }) {
  return access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } };
}
export async function globalSearch(raw: string): Promise<SearchResponse> {
  const user = await readSession();
  if (!user) throw new Error('UNAUTHORIZED');
  const query = parseSearchQuery(raw);
  if (query.error) return { results: [], error: query.error };
  if (query.text.length < 2) return { results: [] };
  const [clients, leads, rentals, finesAccess] = await Promise.all([
    getClientAccess('VIEW_CLIENTS'),
    getClientAccess('MANAGE_CLIENTS'),
    getRentalAccess(),
    getFineAccessForUser(user),
  ]);
  if (query.range) return { results: await searchDates(query.range, user.id, rentals, leads) };
  const contains = { contains: query.text, mode: 'insensitive' as const };
  const phone = normalizeRussianPhone(query.text);
  const phoneIndex = /^7\d{10}$/.test(phone)
    ? blindIndex(phone, process.env.CLIENT_SEARCH_KEY ?? '', normalizeRussianPhone)
    : null;
  const tokens = query.text.split(/\s+/).slice(0, 5);
  const decreeQuery = query.text.replace(/^№\s*/u, '').replace(/\s+/gu, '');
  const [cars, people, contracts, requests, fines] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        archivedAt: null,
        company: { members: { some: { userId: user.id } } },
        OR: [
          { registrationNumberNormalized: { contains: normalizeSearchPlate(query.text) } },
          { registrationNumber: contains },
          { internalNumber: contains },
          { vin: contains },
          { model: contains },
          { make: contains },
        ],
      },
      select: { id: true, model: true, registrationNumber: true, internalNumber: true },
      take: 12,
      orderBy: { internalNumber: 'asc' },
    }),
    clients
      ? prisma.client.findMany({
          where: {
            ...searchScope(clients),
            archivedAt: null,
            ...(phoneIndex
              ? { phoneIndex }
              : {
                  AND: tokens.map((t) => ({
                    OR: [
                      { firstName: { contains: t, mode: 'insensitive' as const } },
                      { lastName: { contains: t, mode: 'insensitive' as const } },
                      { middleName: { contains: t, mode: 'insensitive' as const } },
                    ],
                  })),
                }),
          },
          select: { id: true, firstName: true, lastName: true, middleName: true },
          take: 8,
          orderBy: { lastName: 'asc' },
        })
      : [],
    rentals
      ? prisma.rental.findMany({
          where: { ...searchScope(rentals), contractNumber: contains },
          select: {
            id: true,
            contractNumber: true,
            vehicle: { select: { model: true, registrationNumber: true } },
          },
          take: 8,
          orderBy: { startsAt: 'desc' },
        })
      : [],
    leads
      ? prisma.lead.findMany({
          where: {
            ...searchScope(leads),
            ...(phoneIndex
              ? { phoneIndex }
              : { OR: [{ id: contains }, { name: contains }, { lastName: contains }] }),
          },
          select: { id: true, name: true, lastName: true, source: true },
          take: 8,
          orderBy: { createdAt: 'desc' },
        })
      : [],
    finesAccess && /^\d{2,}$/u.test(decreeQuery)
      ? prisma.fine.findMany({
          where: { ...searchScope(finesAccess), decreeNumber: { contains: decreeQuery } },
          select: {
            id: true,
            companyId: true,
            decreeNumber: true,
            vehicle: { select: { model: true, registrationNumber: true } },
          },
          take: 8,
          orderBy: [{ offenseAt: 'desc' }, { id: 'asc' }],
        })
      : [],
  ]);
  const results: SearchResult[] = [
    ...fines.map((fine) => ({
      id: `fine-${fine.id}`,
      group: 'Штрафы',
      title: fine.decreeNumber,
      subtitle:
        [fine.vehicle?.model, fine.vehicle?.registrationNumber].filter(Boolean).join(' · ') ||
        'Постановление',
      href: `/fines?${new URLSearchParams({ companyId: fine.companyId, query: fine.decreeNumber })}#fine-${fine.id}`,
    })),
    ...cars.map((c) => ({
      id: `vehicle-${c.id}`,
      group: 'Автомобили',
      title: c.model,
      subtitle: [c.registrationNumber, c.internalNumber].filter(Boolean).join(' · '),
      href: `/vehicles/${c.id}`,
    })),
    ...people.map((c) => ({
      id: `client-${c.id}`,
      group: 'Клиенты',
      title: [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' '),
      subtitle: 'Карточка клиента',
      href: `/clients/${c.id}`,
    })),
    ...contracts.map((c) => ({
      id: `rental-${c.id}`,
      group: 'Договоры',
      title: c.contractNumber ?? 'Договор',
      subtitle: [c.vehicle.model, c.vehicle.registrationNumber].filter(Boolean).join(' · '),
      href: `/rentals/${c.id}`,
    })),
    ...requests.map((c) => ({
      id: `lead-${c.id}`,
      group: 'Заявки',
      title: [c.name, c.lastName].filter(Boolean).join(' '),
      subtitle: c.source ?? 'Заявка',
      href: `/leads#lead-${c.id}`,
    })),
  ];
  const needle = normalizeSearchPlate(query.text);
  const exact = (r: SearchResult) =>
    [r.title, ...r.subtitle.split(' · ')].some((v) => normalizeSearchPlate(v) === needle) ? 1 : 0;
  results.sort((a, b) => exact(b) - exact(a));
  return { results };
}
