export const violationIconNames = [
  'speed',
  'road-sign',
  'parking',
  'bus-lane',
  'seatbelt',
  'traffic-light',
  'toll',
  'general',
] as const;

export type ViolationIconName = (typeof violationIconNames)[number];

const patterns: ReadonlyArray<readonly [RegExp, ViolationIconName]> = [
  [/мсд|цкад|скоростн.*диаметр|платн.*дорог|неуплата за проезд/iu, 'toll'],
  [/скорост/iu, 'speed'],
  [/ремн|мотошлем/iu, 'seatbelt'],
  [/маршрутн|полос/iu, 'bus-lane'],
  [/парковк|стоянк/iu, 'parking'],
  [/светофор|регулировщик/iu, 'traffic-light'],
  [/знак|разметк|остановк/iu, 'road-sign'],
];

export function getViolationIcon(description: string | null | undefined): ViolationIconName {
  const text = description?.trim() ?? '';
  return patterns.find(([pattern]) => pattern.test(text))?.[1] ?? 'general';
}

export const violationIconPosition: Record<ViolationIconName, string> = {
  speed: '0% 0%',
  'road-sign': '33.333% 0%',
  parking: '66.667% 0%',
  'bus-lane': '100% 0%',
  seatbelt: '0% 100%',
  'traffic-light': '33.333% 100%',
  toll: '66.667% 100%',
  general: '100% 100%',
};
