export function validServiceInterval(last: string, next: string) {
  return (
    last.trim() !== '' &&
    next.trim() !== '' &&
    Number.isFinite(Number(last)) &&
    Number.isFinite(Number(next)) &&
    Number(last) >= 0 &&
    Number(next) > Number(last) &&
    Number(next) <= 10_000_000
  );
}

export function serviceMeter(current: number | null, last: number | null, next: number | null) {
  if (
    current === null ||
    last === null ||
    next === null ||
    ![current, last, next].every(Number.isFinite) ||
    last < 0 ||
    next <= last ||
    current < last
  )
    return null;
  return {
    remaining: next - current,
    percent: Math.max(0, Math.min(100, ((next - current) / (next - last)) * 100)),
  };
}

export function meterColor(percent: number) {
  const p = Math.max(0, Math.min(100, percent));
  return `hsl(${(p * 1.35).toFixed(2)} 55% 48%)`;
}
