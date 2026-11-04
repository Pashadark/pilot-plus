export function dateInputValue(value: string | null | undefined) {
  return value?.match(/^\d{4}-\d{2}-\d{2}/u)?.[0] ?? '';
}
