/** Display name only; registration numbers and other metadata stay separate. */
export function vehicleName(make?: string | null, model?: string | null): string {
  const brand = make?.trim() ?? '';
  const name = model?.trim() ?? '';
  if (!brand) return name;
  if (!name) return brand;
  const prefix = name.slice(0, brand.length);
  if (prefix.toLocaleLowerCase('ru-RU') === brand.toLocaleLowerCase('ru-RU') &&
      (name.length === brand.length || /^[\s·]/u.test(name.slice(brand.length)))) {
    return [brand, name.slice(brand.length).replace(/^[\s·]+/u, '')].filter(Boolean).join(' ');
  }
  return `${brand} ${name}`;
}
