const DAY = 86_400_000;
const MOSCOW = 3 * 3_600_000;
export type StatisticsPayment = {
  kind: string;
  status: string;
  currency: string;
  amountMinor: bigint;
  recordedAt: Date;
};
export type StatisticsRental = {
  status: string;
  startsAt: Date;
  endsAt: Date;
  activatedAt?: Date | null;
  completedAt?: Date | null;
  operations: Array<{ type: string; occurredAt: Date; mileageKm: number | null }>;
};
export type StatisticsVisit = {
  id: string;
  enteredAt: Date;
  latitude: number;
  longitude: number;
  name: string;
};
export type StatisticsInput = {
  from: Date;
  to: Date;
  payments: StatisticsPayment[];
  rentals: StatisticsRental[];
  costs: Array<{ costMinor: bigint; completedAt: Date }>;
  visits: StatisticsVisit[];
};
export function statisticsWindow(period?: string, now = new Date()) {
  const days = period === '7' ? 7 : period === '90' ? 90 : 30;
  const today = Math.floor((now.getTime() + MOSCOW) / DAY) * DAY - MOSCOW;
  return { days, from: new Date(today - (days - 1) * DAY), to: new Date(today + DAY) };
}
export function aggregateStatistics(input: StatisticsInput) {
  const start = input.from.getTime();
  const end = input.to.getTime();
  const within = (date: Date) => date.getTime() >= start && date.getTime() < end;
  const bucketDays = Math.max(1, Math.ceil((end - start) / DAY / 10));
  const buckets = Array.from(
    { length: Math.ceil((end - start) / DAY / bucketDays) },
    (_, index) => ({
      date: new Date(start + index * bucketDays * DAY),
      incomeMinor: 0n,
      costMinor: 0n,
    }),
  );
  const bucketFor = (date: Date) =>
    buckets[Math.floor((date.getTime() - start) / DAY / bucketDays)];
  let incomeMinor = 0n;
  let costMinor = 0n;
  let excludedPayments = 0;
  for (const payment of input.payments) {
    if (!within(payment.recordedAt) || payment.kind !== 'RENT') continue;
    if (
      payment.status === 'PARTIALLY_REFUNDED' ||
      (payment.status === 'CONFIRMED' && payment.currency !== 'RUB')
    )
      excludedPayments++;
    if (payment.status !== 'CONFIRMED' || payment.currency !== 'RUB' || payment.amountMinor < 0n)
      continue;
    incomeMinor += payment.amountMinor;
    bucketFor(payment.recordedAt).incomeMinor += payment.amountMinor;
  }
  for (const cost of input.costs) {
    if (!within(cost.completedAt) || cost.costMinor < 0n) continue;
    costMinor += cost.costMinor;
    bucketFor(cost.completedAt).costMinor += cost.costMinor;
  }
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  const intervals: Array<[number, number]> = [];
  let rentalKm = 0;
  let returnedRentals = 0;
  let distanceCoveredRentals = 0;
  for (const rental of input.rentals) {
    if (rental.status !== 'ACTIVE' && rental.status !== 'COMPLETED') continue;
    const effectiveStart = rental.activatedAt ?? rental.startsAt;
    const effectiveEnd = rental.completedAt ?? rental.endsAt;
    const a = Math.max(start, effectiveStart.getTime());
    const b = Math.min(end, effectiveEnd.getTime());
    if (b > a) intervals.push([a, b]);
    if (within(effectiveStart))
      weekdays[(new Date(effectiveStart.getTime() + MOSCOW).getUTCDay() + 6) % 7]++;
    const operations = [...rental.operations].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    );
    const handover = operations.find((operation) => operation.type === 'HANDOVER');
    const returned = operations.find((operation) => operation.type === 'RETURN');
    if (rental.status !== 'COMPLETED' || !returned || !within(returned.occurredAt)) continue;
    returnedRentals++;
    if (
      !handover ||
      handover.mileageKm === null ||
      returned.mileageKm === null ||
      handover.occurredAt > returned.occurredAt
    )
      continue;
    const distance = returned.mileageKm - handover.mileageKm;
    if (!Number.isFinite(distance) || handover.mileageKm < 0 || distance < 0) continue;
    rentalKm += distance;
    distanceCoveredRentals++;
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let utilizedMs = 0;
  let lastEnd = start;
  for (const [a, b] of intervals) {
    utilizedMs += Math.max(0, b - Math.max(lastEnd, a));
    lastEnd = Math.max(lastEnd, b);
  }
  const visitIds = new Set<string>();
  const locations = new Map<
    string,
    { latitude: number; longitude: number; name: string; count: number }
  >();
  for (const visit of input.visits) {
    if (
      !within(visit.enteredAt) ||
      visitIds.has(visit.id) ||
      !Number.isFinite(visit.latitude) ||
      !Number.isFinite(visit.longitude)
    )
      continue;
    visitIds.add(visit.id);
    const key = `${visit.latitude.toFixed(4)},${visit.longitude.toFixed(4)}`;
    const location = locations.get(key) ?? {
      latitude: visit.latitude,
      longitude: visit.longitude,
      name: visit.name,
      count: 0,
    };
    location.count++;
    locations.set(key, location);
  }
  return {
    incomeMinor,
    costMinor,
    excludedPayments,
    buckets,
    weekdays,
    utilizedDays: utilizedMs / DAY,
    utilizationPercent: (utilizedMs * 100) / (end - start),
    rentalKm,
    returnedRentals,
    distanceCoveredRentals,
    visitCount: visitIds.size,
    locations: [...locations.values()].sort((a, b) => b.count - a.count),
  };
}
