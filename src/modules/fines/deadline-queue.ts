interface DeadlineFine {
  status: string;
  discountExpiresAt?: string | null;
  currentAmountMinor: string;
  originalAmountMinor: string;
  toBailiff?: boolean;
}
export function deadlineDay(value: string) {
  return new Date(Date.parse(value) + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function activeDiscount(fine: DeadlineFine, now: string) {
  return fine.status !== 'PAID' && fine.status !== 'CANCELLED' &&
    fine.discountExpiresAt && Date.parse(fine.discountExpiresAt) >= Date.parse(now) &&
    BigInt(fine.currentAmountMinor) < BigInt(fine.originalAmountMinor);
}
export function deadlineGroup(fine: DeadlineFine, now: string): 0 | 1 | 2 {
  if (fine.status === 'PAID' || fine.status === 'CANCELLED') return 2;
  if (fine.status === 'OVERDUE' || fine.toBailiff) return 0;
  if (!activeDiscount(fine, now)) return 2;
  const day = deadlineDay(fine.discountExpiresAt!);
  const today = deadlineDay(now);
  if (day === today) return 0;
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return day <= end.toISOString().slice(0, 10) ? 1 : 2;
}
export function deadlineWeek(fines: readonly DeadlineFine[], now: string) {
  const today = deadlineDay(now);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const day = date.toISOString().slice(0, 10);
    const matches = fines.filter(fine => activeDiscount(fine, now) && deadlineDay(fine.discountExpiresAt!) === day);
    return { day, count: matches.length, amountMinor: matches.reduce((sum, fine) => sum + BigInt(fine.currentAmountMinor), 0n).toString() };
  });
}
