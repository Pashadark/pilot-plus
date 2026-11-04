export function parseDepositReturnInput(input: {
  collectedMinor: bigint;
  returnedRubles: string;
  reason: string;
}) {
  const normalized = input.returnedRubles.trim().replace(/\s/gu, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/u.test(normalized)) {
    throw new Error('Укажите корректную возвращённую сумму.');
  }
  const [rubles, kopecks = ''] = normalized.split('.');
  const returnedMinor = BigInt(rubles) * BigInt(100) + BigInt(kopecks.padEnd(2, '0'));
  if (returnedMinor > input.collectedMinor) {
    throw new Error('Возвращённая сумма не может быть больше внесённого залога.');
  }
  const withheldMinor = input.collectedMinor - returnedMinor;
  const reason = input.reason.trim();
  if (withheldMinor > BigInt(0) && !reason) {
    throw new Error('Укажите причину удержания залога.');
  }
  return {
    status:
      withheldMinor === BigInt(0)
        ? ('RETURNED' as const)
        : returnedMinor === BigInt(0)
          ? ('WITHHELD' as const)
          : ('PARTIALLY_WITHHELD' as const),
    returnedMinor,
    withheldMinor,
    reason,
  };
}

export function planDepositReturnLedger(input: {
  cashMinor: bigint;
  reservedMinor: bigint;
  withheldMinor: bigint;
  returnedMinor: bigint;
}) {
  const cashAfterReturn = input.cashMinor - input.returnedMinor;
  if (cashAfterReturn < 0n) {
    throw new Error('Возвращённая сумма больше фактического остатка залога.');
  }

  const securedBeforeReturn = input.reservedMinor + input.withheldMinor;
  const overAllocated =
    securedBeforeReturn > cashAfterReturn ? securedBeforeReturn - cashAfterReturn : 0n;
  const reservationDebtMinor =
    overAllocated < input.reservedMinor ? overAllocated : input.reservedMinor;
  const remainingReservedMinor = input.reservedMinor - reservationDebtMinor;
  const additionalWithheldMinor =
    cashAfterReturn - input.withheldMinor - remainingReservedMinor;

  if (additionalWithheldMinor < 0n) {
    throw new Error(
      'Часть залога уже удержана. Сначала исправьте удержания перед возвратом клиенту.',
    );
  }

  return { reservationDebtMinor, additionalWithheldMinor };
}
