import 'server-only';
import { prisma } from '@/database/prisma/client';
import { decryptField } from '@/services/security/field-encryption';
import { DriverHelperClient } from '../integrations/driver-helper/client';
import { mapTollDebt, parseTollDate, type TollTrip } from '../tolls';

// Caller must obtain these company IDs from getFineAccess, never from raw query parameters.
export async function loadTollDebts(companyIds: string[]) {
  const items: NonNullable<ReturnType<typeof mapTollDebt>>[] = [];
  if (!companyIds.length) return { items, unavailable: false };
  const integrations = await prisma.fineIntegration.findMany({
    where: { companyId: { in: companyIds }, enabled: true },
    select: { companyId: true, tokenEncrypted: true },
  });
  let unavailable = false;
  for (const integration of integrations) {
    try {
      const key = process.env.CLIENT_DATA_ENCRYPTION_KEY;
      if (!key) throw new Error('KEY_MISSING');
      const client = new DriverHelperClient({
        token: decryptField(integration.tokenEncrypted, key),
        timeoutMs: 5000,
      });
      const trips = new Map<string, TollTrip>();
      const start = Date.now();
      for (let page = 1; page <= 20; page++) {
        if (Date.now() - start > 15000) throw new Error('TIME_BUDGET');
        const result = await client.listTollDebts(page);
        if (result.current !== page) throw new Error('PAGE_MISMATCH');
        for (const trip of result.items) trips.set(String(trip.id), trip);
        if (page >= result.last) break;
        if (page === 20) throw new Error('PAGE_LIMIT');
      }
      const dates = [...trips.values()]
        .map((t) => parseTollDate(t.travelDate))
        .filter((d): d is Date => d !== null);
      if (!dates.length) {
        if (trips.size) unavailable = true;
        continue;
      }
      const vehicles = await prisma.vehicle.findMany({
        where: { companyId: integration.companyId },
        select: { id: true, companyId: true, registrationNumber: true },
      });
      const rentals = await prisma.rental.findMany({
        where: {
          companyId: integration.companyId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          startsAt: { lte: new Date(Math.max(...dates.map((d) => d.getTime()))) },
          OR: [
            { endsAt: { gte: new Date(Math.min(...dates.map((d) => d.getTime()))) } },
            { completedAt: { gte: new Date(Math.min(...dates.map((d) => d.getTime()))) } },
          ],
        },
        select: {
          id: true,
          companyId: true,
          vehicleId: true,
          clientId: true,
          contractNumber: true,
          startsAt: true,
          endsAt: true,
          activatedAt: true,
          completedAt: true,
          client: { select: { lastName: true, firstName: true, middleName: true } },
        },
      });
      for (const trip of trips.values()) {
        const item = mapTollDebt(integration.companyId, trip, vehicles, rentals);
        if (item) items.push(item);
        else unavailable = true;
      }
    } catch {
      unavailable = true;
    }
  }
  return { items, unavailable };
}
