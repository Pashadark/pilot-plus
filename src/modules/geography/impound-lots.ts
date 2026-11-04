export type ImpoundLot = Readonly<{
  id: string;
  city: 'Москва' | 'Санкт-Петербург';
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  sourceUrl: string;
  verifiedAt: string;
}>;

type Coordinate = Readonly<{ latitude: number; longitude: number }>;

type TimedImpoundPoint = Coordinate &
  Readonly<{
    speedKph: number | null;
    recordedAt: Date;
  }>;

export type ConfirmedImpoundStay = Readonly<{
  lot: ImpoundLot;
  enteredAt: Date;
}>;

const IMPOUND_CONFIRMATION_MS = 30 * 60_000;
const IMPOUND_MAX_CONFIRMATION_SPEED_KPH = 3;
const IMPOUND_MAX_POINT_GAP_MS = 20 * 60_000;
const IMPOUND_MAX_POSITION_DRIFT_METERS = 30;
const IMPOUND_MIN_CONFIRMATION_SAMPLES = 3;

const MOSCOW_SOURCE = 'https://parking.mos.ru/evacuation/special-parking/';
const SPB_SOURCE = 'https://www.gov.spb.ru/gov/terr/reg_primorsk/news/31701/';

export const IMPOUND_LOTS: readonly ImpoundLot[] = [
  [
    'moscow-podolskikh-kursantov-7a',
    'Москва',
    'улица Подольских Курсантов, вл. 7а',
    55.607911,
    37.624418,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-vagonoremontnaya-4a',
    'Москва',
    'Вагоноремонтная улица, вл. 4а',
    55.899855,
    37.53287,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-odoevskogo-3',
    'Москва',
    'проезд Одоевского, напротив вл. 3',
    55.600396,
    37.507424,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-dubovoy-roshchi-7a',
    'Москва',
    'проезд Дубовой Рощи, вл. 7а',
    55.814887,
    37.608329,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-entuziastov-3',
    'Москва',
    'проезд Энтузиастов, вл. 3',
    55.761264,
    37.722415,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-kaskadnaya-28',
    'Москва',
    'Каскадная улица, вл. 28',
    55.708048,
    37.880954,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-checherskiy-31',
    'Москва',
    'Чечёрский проезд, вл. 31',
    55.528084,
    37.521672,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-vostryakovskiy-20',
    'Москва',
    'Востряковский проезд, вл. 20',
    55.574347,
    37.652359,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-pokhodnyy-2',
    'Москва',
    'Походный проезд, напротив вл. 2',
    55.831927,
    37.408217,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-otkrytoe-14g-1',
    'Москва',
    'Открытое шоссе, вл. 14Г, стр. 1',
    55.813876,
    37.737733,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-simferopolskoe-3',
    'Москва',
    'Симферопольское шоссе, напротив вл. 3',
    55.56975,
    37.600269,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-egorevskiy-8-14',
    'Москва',
    'Егорьевский проезд, вл. 8, стр. 14',
    55.671521,
    37.735137,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-grayvoronovskaya-40a',
    'Москва',
    'Грайвороновская улица, вл. 40а',
    55.722375,
    37.739567,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-verkhnie-polya-61-5',
    'Москва',
    'улица Верхние Поля, вл. 61, стр. 5',
    55.658079,
    37.800835,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-volskaya-22',
    'Москва',
    '1-я Вольская улица, напротив вл. 22, корп. 1, стр. 13',
    55.67854,
    37.931092,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-varshavskoe-166',
    'Москва',
    'Варшавское шоссе, напротив вл. 166, стр. 1',
    55.568143,
    37.598235,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-varshavskoe-219-3',
    'Москва',
    'Варшавское шоссе, вл. 219, стр. 3',
    55.518045,
    37.578356,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-serednikovskaya-11b',
    'Москва',
    'Середниковская улица, вл. 11Б',
    55.958442,
    37.188654,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-sosenskoe-quarter-7',
    'Москва',
    'поселение Сосенское, квартал № 7, вл. 1, стр. 1, напротив',
    55.608476,
    37.431204,
    200,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-nizhnie-mnevniki-19-1',
    'Москва',
    'улица Нижние Мнёвники, д. 19, стр. 1',
    55.75188428010732,
    37.47500396867001,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'moscow-leningradskoe-71g-2',
    'Москва',
    'Ленинградское шоссе, вл. 71Г, стр. 2',
    55.87405666619147,
    37.44625703788748,
    180,
    MOSCOW_SOURCE,
  ],
  [
    'spb-stepana-razina-13',
    'Санкт-Петербург',
    'улица Степана Разина, д. 13',
    59.9094757,
    30.2619511,
    180,
    SPB_SOURCE,
  ],
  [
    'spb-shkiperskiy-16a',
    'Санкт-Петербург',
    'Шкиперский проток, д. 16а',
    59.9329077,
    30.2222396,
    180,
    SPB_SOURCE,
  ],
  [
    'spb-rustaveli-35',
    'Санкт-Петербург',
    'улица Руставели, д. 35',
    60.011799,
    30.4366749,
    180,
    SPB_SOURCE,
  ],
  [
    'spb-avtovskaya-33',
    'Санкт-Петербург',
    'Автовская улица, д. 33',
    59.8762418,
    30.2791847,
    180,
    SPB_SOURCE,
  ],
  [
    'spb-kolpino-zavodskoy-2',
    'Санкт-Петербург',
    'Колпино, Заводской проспект, участок 2',
    59.7324491,
    30.5869575,
    220,
    SPB_SOURCE,
  ],
  [
    'spb-shaumyana-20',
    'Санкт-Петербург',
    'проспект Шаумяна, участок 20, у д. 9а',
    59.9401843,
    30.4139853,
    220,
    SPB_SOURCE,
  ],
  [
    'spb-zastavskaya-4',
    'Санкт-Петербург',
    'Заставская улица, д. 4',
    59.886805,
    30.3417789,
    180,
    SPB_SOURCE,
  ],
  [
    'spb-petergof-ozerkovaya-47',
    'Санкт-Петербург',
    'Петергоф, Озерковая улица, д. 47',
    59.8711802,
    29.8960903,
    220,
    SPB_SOURCE,
  ],
  [
    'spb-strelna-griboedova-7a',
    'Санкт-Петербург',
    'Стрельна, улица Грибоедова, д. 7а',
    59.850495,
    30.0212571,
    220,
    SPB_SOURCE,
  ],
  [
    'spb-mebelnaya-40',
    'Санкт-Петербург',
    'Мебельная улица, участок 40',
    59.9885803,
    30.2511472,
    220,
    SPB_SOURCE,
  ],
  [
    'spb-shkolnaya-39',
    'Санкт-Петербург',
    'Школьная улица, д. 39',
    59.9868,
    30.2763,
    220,
    SPB_SOURCE,
  ],
  [
    'spb-pushkin-sapernaya-65',
    'Санкт-Петербург',
    'Пушкин, Сапёрная улица, д. 65',
    59.6994262,
    30.378602,
    220,
    SPB_SOURCE,
  ],
  [
    'spb-salova-samoylovoy',
    'Санкт-Петербург',
    'перекрёсток улиц Салова и Самойловой',
    59.8967342,
    30.3665391,
    220,
    SPB_SOURCE,
  ],
  [
    'spb-moiseенко-24',
    'Санкт-Петербург',
    'улица Моисеенко, д. 24',
    59.9378136,
    30.3900637,
    180,
    SPB_SOURCE,
  ],
].map(([id, city, address, latitude, longitude, radiusMeters, sourceUrl]) => ({
  id: id as string,
  city: city as ImpoundLot['city'],
  address: address as string,
  latitude: latitude as number,
  longitude: longitude as number,
  radiusMeters: radiusMeters as number,
  sourceUrl: sourceUrl as string,
  verifiedAt: '2026-10-23',
}));

function distanceMeters(a: Coordinate, b: Coordinate) {
  const earthRadiusMeters = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const firstLatitude = radians(a.latitude);
  const secondLatitude = radians(b.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

function validCoordinate(point: Coordinate) {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

export function findImpoundLot(latitude: number, longitude: number): ImpoundLot | null {
  const point = { latitude, longitude };
  if (!validCoordinate(point)) return null;
  return IMPOUND_LOTS.find((lot) => distanceMeters(point, lot) <= lot.radiusMeters) ?? null;
}

export function detectImpoundEntry(
  previous: Coordinate | null,
  current: Coordinate,
): ImpoundLot | null {
  const currentLot = findImpoundLot(current.latitude, current.longitude);
  if (!currentLot) return null;
  if (!previous) return currentLot;
  const previousLot = findImpoundLot(previous.latitude, previous.longitude);
  return previousLot?.id === currentLot.id ? null : currentLot;
}

export function detectConfirmedImpoundStay(
  points: readonly TimedImpoundPoint[],
): ConfirmedImpoundStay | null {
  if (points.length < 2) return null;
  const current = points.at(-1)!;
  const currentTime = current.recordedAt.getTime();
  const currentLot = findImpoundLot(current.latitude, current.longitude);
  if (
    !currentLot ||
    !Number.isFinite(currentTime) ||
    current.speedKph === null ||
    !Number.isFinite(current.speedKph) ||
    current.speedKph > IMPOUND_MAX_CONFIRMATION_SPEED_KPH
  ) {
    return null;
  }

  let enteredAt = current.recordedAt;
  let nextPoint = current;
  let stationarySamples = 1;
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const point = points[index];
    const pointTime = point.recordedAt.getTime();
    const gapMs = nextPoint.recordedAt.getTime() - pointTime;
    const lot = findImpoundLot(point.latitude, point.longitude);
    if (
      !Number.isFinite(pointTime) ||
      gapMs <= 0 ||
      gapMs > IMPOUND_MAX_POINT_GAP_MS ||
      lot?.id !== currentLot.id ||
      point.speedKph === null ||
      !Number.isFinite(point.speedKph) ||
      point.speedKph > IMPOUND_MAX_CONFIRMATION_SPEED_KPH ||
      distanceMeters(point, nextPoint) > IMPOUND_MAX_POSITION_DRIFT_METERS
    ) {
      break;
    }
    enteredAt = point.recordedAt;
    nextPoint = point;
    stationarySamples += 1;
  }

  return stationarySamples >= IMPOUND_MIN_CONFIRMATION_SAMPLES &&
    currentTime - enteredAt.getTime() >= IMPOUND_CONFIRMATION_MS
    ? { lot: currentLot, enteredAt }
    : null;
}
