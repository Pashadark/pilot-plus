// Display-only fleet assets. Original vehicle photographs remain unchanged.
const assets: Record<string, string> = {
  cmu6nohbq0001e7adgf3u3vb1: 'bmw-520d-black',
  cmswhnbr50001tup4ixahj9ee: 'kia-ceed-white',
  cmtdfthw3000dtujs3eyq7p71: 'kia-cerato-black',
  cmswho0c10001tu04p3q73aqw: 'kia-cerato-white',
  cmujw9kn1000de7dahhg5kys3: 'kia-k5-black',
  cmswho0cg0005tu04kjypsv1j: 'kia-k5-black',
  cmujw9kok000he7dand2obtcx: 'kia-k5-blue',
  '632a53d1-5480-4f92-85ea-02518b5038f6': 'kia-k5-white',
  cmt1x5x200001tu4wkn0n2q4n: 'kia-rio-white',
  cmtdfthvu0005tujseopdlh4e: 'kia-sorento-gray',
  '03f6b3b5-1bda-4663-b5af-2025e21e3520': 'mercedes-e200-black',
  cmuvrokkp0001e7b8as9pvlgo: 'mercedes-e200-black',
  cmuvrokl20003e7b8v1y86erf: 'mercedes-e220-black',
  cmsw6ncur00eptuq80ic13drz: 'mercedes-e220-2019-black',
  cmtdfthvk0001tujsj7n5tnd9: 'skoda-karoq-gray',
  '6d23990e-a4b3-4676-9a1f-2809064b3f98': 'skoda-octavia-white',
  cmswho0cq0009tu0458y1j14h: 'skoda-octavia-white',
  cmsw6ncun00entuq8p8wal42s: 'skoda-octavia-white',
  cmswho0c70003tu04ygmg6gb3: 'toyota-camry-white',
  'b3e13822-6666-460b-b917-ef1c0cd1995f': 'toyota-camry-black',
  cmu6nojfg000fe7dh9d8zareg: 'toyota-camry-black',
  cmtdgxote000ttu18133knumk: 'toyota-camry-2019-white',
  cmswho0cl0007tu04f1zm6eka: 'volkswagen-polo-white',
  cmsw6ncuu00ertuq858hv20mj: 'volkswagen-polo-white',
};
export function getVehiclePromo(id: string, name: string) {
  const asset = assets[id];
  return asset
    ? { localPath: `/vehicles/promo/${asset}.png`, alt: `${name}, промо-изображение` }
    : null;
}

const fineLabelAssets: readonly [RegExp, string][] = [
  [/\bbmw\s+5(?:20d)?\b/iu, 'bmw-520d-black'],
  [/\bkia\s+cee(?:[’']?d)?\b/iu, 'kia-ceed-white'],
  [/\bkia\s+cerato\b/iu, 'kia-cerato-white'],
  [/\bkia\s+k5\b/iu, 'kia-k5-white'],
  [/\bkia\s+rio\b/iu, 'kia-rio-white'],
  [/\bkia\s+sorento\b/iu, 'kia-sorento-gray'],
  [/\bmercedes(?:-benz)?\s+e\s?200\b/iu, 'mercedes-e200-black'],
  [/\bmercedes(?:-benz)?\s+e\s?220\b/iu, 'mercedes-e220-black'],
  [/\bskoda\s+karoq\b/iu, 'skoda-karoq-gray'],
  [/\bskoda\s+octavia\b/iu, 'skoda-octavia-white'],
  [/\btoyota\s+camry\b/iu, 'toyota-camry-white'],
  [/\bvolkswagen\s+polo\b/iu, 'volkswagen-polo-white'],
];

/** Uses a verified ID first, then an exact model label supplied by a fine provider. */
export function getVehiclePromoForFine(id: string | null | undefined, label: string) {
  if (id) {
    const direct = getVehiclePromo(id, label);
    if (direct) return direct;
  }
  const asset = fineLabelAssets.find(([pattern]) => pattern.test(label))?.[1];
  return asset ? { localPath: `/vehicles/promo/${asset}.png`, alt: `${label}, промо-изображение` } : null;
}
