export interface FleetImportRow {
  sourceKey: string;
  model: string;
  city: string;
  office: string | null;
  transmission: string;
  engineLiters: number;
  fuelType: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'OTHER';
  seats: number;
  dailyPriceMinor: number;
  currency: 'RUB' | 'THB';
  originalPrice: string;
  features: string[];
}

const enginePattern = /^\d+(?:[.,]\d+)? л$/;
const seatsPattern = /^\d+ мест$/;
const pricePattern = /^[\d ]+ [₽฿]$/;

function normalizeComparable(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru-RU');
}

function parseFuelType(value: string): FleetImportRow['fuelType'] {
  if (value === 'Бензин') return 'PETROL';
  if (value === 'Дизель') return 'DIESEL';
  if (value === 'Электричество') return 'ELECTRIC';
  if (value === 'Гибрид') return 'HYBRID';
  return 'OTHER';
}

function parseCard(card: string[], index: number): FleetImportRow {
  const cardNumber = index + 1;
  const lines = card.map((line) => line.trim()).filter(Boolean);

  if (index === 0 && lines[0] === 'Автопарк' && /^\d+ авто$/.test(lines[1] ?? '')) {
    lines.splice(0, 2);
  }

  const engineIndex = lines.findIndex((line) => enginePattern.test(line));
  const model = lines[0];
  const city = lines[1];
  const transmission = lines[engineIndex - 1];
  const engine = lines[engineIndex];
  const fuel = lines[engineIndex + 1];
  const seats = lines[engineIndex + 2];
  const price = lines[engineIndex + 3];

  if (
    !model ||
    !city ||
    engineIndex < 3 ||
    !transmission ||
    !enginePattern.test(engine ?? '') ||
    !fuel ||
    !seatsPattern.test(seats ?? '') ||
    !pricePattern.test(price ?? '')
  ) {
    throw new Error(`Карточка ${cardNumber}: не удалось распознать обязательные поля.`);
  }

  const descriptiveLines = lines.slice(2, engineIndex - 1);
  const repeatedModelIndex = descriptiveLines.findIndex(
    (line) => normalizeComparable(line) === normalizeComparable(model),
  );

  if (repeatedModelIndex < 0) {
    throw new Error(`Карточка ${cardNumber}: не найдено повторное название модели.`);
  }

  const currency = price.endsWith('₽') ? 'RUB' : 'THB';
  const priceMajor = Number.parseInt(price.replace(/\D/g, ''), 10);

  return {
    sourceKey: `fleet-${String(cardNumber).padStart(3, '0')}`,
    model,
    city,
    office: descriptiveLines.slice(0, repeatedModelIndex).join(' · ') || null,
    transmission,
    engineLiters: Number.parseFloat(engine.replace(',', '.')),
    fuelType: parseFuelType(fuel),
    seats: Number.parseInt(seats, 10),
    dailyPriceMinor: priceMajor * 100,
    currency,
    originalPrice: price,
    features: descriptiveLines.slice(repeatedModelIndex + 1),
  };
}

export function parseFleetSource(source: string): FleetImportRow[] {
  const normalized = source.replace(/\r\n?/g, '\n');
  const cards: string[][] = [];
  let current: string[] = [];

  for (const line of normalized.split('\n')) {
    if (line.trim() === 'Забронировать') {
      cards.push(current);
      current = [];
      continue;
    }

    current.push(line);
  }

  if (cards.length === 0 && current.some((line) => line.trim())) {
    cards.push(current);
  }

  return cards.map(parseCard);
}
