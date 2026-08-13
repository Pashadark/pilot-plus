type LiveDetail = {
  status: string;
  snapshot: unknown;
  clientLabel: string;
  vehicleLabel: string;
  startsAt: string;
  endsAt: string;
  totalPriceMinor: bigint;
};

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : '—';
}
function date(value: unknown) {
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(parsed)
    : '—';
}
function minor(value: unknown, fallback: bigint) {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : Number(fallback);
}

export function rentalDetailPresentation(detail: LiveDetail) {
  const snapshot = object(detail.snapshot);
  const client = object(snapshot?.client);
  const vehicle = object(snapshot?.vehicle);
  const rental = object(snapshot?.rental);
  const issuance = object(snapshot?.issuance);
  const confirmed = detail.status !== 'DRAFT' && Boolean(client && vehicle && rental);
  if (!confirmed || !client || !vehicle || !rental)
    return {
      source: 'Текущие данные черновика',
      client: detail.clientLabel,
      vehicle: detail.vehicleLabel,
      term: `${date(detail.startsAt)} — ${date(detail.endsAt)}`,
      totalMinor: Number(detail.totalPriceMinor),
      issuance: undefined,
    };
  return {
    source: 'Снимок подтверждённого договора',
    client: text(client.fullName),
    vehicle: `${text(vehicle.make)} ${text(vehicle.model)} · ${text(vehicle.registrationNumber)}`,
    term: `${date(rental.startsAt)} — ${date(rental.endsAt)}`,
    totalMinor: minor(rental.agreedTotalMinor, detail.totalPriceMinor),
    pickupAddress: text(rental.pickupAddress),
    returnAddress: text(rental.returnAddress),
    issuance: issuance
      ? Object.fromEntries(
          Object.entries(issuance).filter(
            ([, value]) => value !== null && value !== undefined && value !== '',
          ),
        )
      : undefined,
  };
}
